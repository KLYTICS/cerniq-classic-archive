import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { TickerDto, CreateTickerDto, UpdateTickerDto, TickerListQueryDto } from './dto/ticker.dto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class TickerService {
    private readonly logger = new Logger(TickerService.name);
    private supabase: SupabaseClient;

    constructor() {
        // Initialize Supabase client
        const supabaseUrl = process.env.SUPABASE_URL || process.env.DATABASE_URL;
        const supabaseKey = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || 'dummy-key';

        if (supabaseUrl) {
            this.supabase = createClient(supabaseUrl, supabaseKey);
            this.logger.log('Supabase client initialized');
        } else {
            this.logger.warn('No database connection configured - using in-memory storage');
        }
    }

    /**
     * Get a single ticker by symbol
     */
    async getTicker(symbol: string): Promise<TickerDto> {
        if (!this.supabase) {
            throw new NotFoundException('Database not configured');
        }

        const { data, error } = await this.supabase
            .from('tickers')
            .select('*')
            .eq('ticker', symbol.toUpperCase())
            .single();

        if (error || !data) {
            throw new NotFoundException(`Ticker ${symbol} not found`);
        }

        return this.mapToTickerDto(data);
    }

    /**
     * List tickers with filtering and pagination
     */
    async listTickers(query: TickerListQueryDto): Promise<{ tickers: TickerDto[]; total: number; page: number; limit: number }> {
        if (!this.supabase) {
            return { tickers: [], total: 0, page: 1, limit: 10 };
        }

        const page = query.page || 1;
        const limit = query.limit || 50;
        const offset = (page - 1) * limit;

        let queryBuilder = this.supabase
            .from('tickers')
            .select('*', { count: 'exact' });

        // Apply filters
        if (query.assetType) {
            queryBuilder = queryBuilder.eq('asset_type', query.assetType);
        }
        if (query.sector) {
            queryBuilder = queryBuilder.eq('sector', query.sector);
        }
        if (query.isActive !== undefined) {
            queryBuilder = queryBuilder.eq('is_active', query.isActive);
        }
        if (query.search) {
            queryBuilder = queryBuilder.or(
                `ticker.ilike.%${query.search}%,name.ilike.%${query.search}%`
            );
        }

        // Pagination
        queryBuilder = queryBuilder
            .range(offset, offset + limit - 1)
            .order('ticker', { ascending: true });

        const { data, error, count } = await queryBuilder;

        if (error) {
            this.logger.error(`Failed to list tickers: ${error.message}`);
            return { tickers: [], total: 0, page, limit };
        }

        const tickers = (data || []).map(this.mapToTickerDto);

        return {
            tickers,
            total: count || 0,
            page,
            limit,
        };
    }

    /**
     * Create a new ticker
     */
    async createTicker(createDto: CreateTickerDto): Promise<TickerDto> {
        if (!this.supabase) {
            throw new Error('Database not configured');
        }

        const { data, error } = await this.supabase
            .from('tickers')
            .insert({
                ticker: createDto.ticker.toUpperCase(),
                name: createDto.name,
                sector: createDto.sector,
                industry: createDto.industry,
                asset_type: createDto.assetType,
                exchange: createDto.exchange,
                country: createDto.country,
                market_cap: createDto.marketCap,
                metadata: createDto.metadata || {},
                is_active: true,
            })
            .select()
            .single();

        if (error) {
            this.logger.error(`Failed to create ticker: ${error.message}`);
            throw new Error(`Failed to create ticker: ${error.message}`);
        }

        this.logger.log(`Created ticker: ${createDto.ticker}`);
        return this.mapToTickerDto(data);
    }

    /**
     * Update an existing ticker
     */
    async updateTicker(symbol: string, updateDto: UpdateTickerDto): Promise<TickerDto> {
        if (!this.supabase) {
            throw new Error('Database not configured');
        }

        const updates: any = {
            last_updated: new Date().toISOString(),
        };

        if (updateDto.name) updates.name = updateDto.name;
        if (updateDto.sector) updates.sector = updateDto.sector;
        if (updateDto.industry) updates.industry = updateDto.industry;
        if (updateDto.exchange) updates.exchange = updateDto.exchange;
        if (updateDto.country) updates.country = updateDto.country;
        if (updateDto.marketCap !== undefined) updates.market_cap = updateDto.marketCap;
        if (updateDto.isActive !== undefined) updates.is_active = updateDto.isActive;
        if (updateDto.metadata) updates.metadata = updateDto.metadata;

        const { data, error } = await this.supabase
            .from('tickers')
            .update(updates)
            .eq('ticker', symbol.toUpperCase())
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to update ticker: ${error.message}`);
        }

        this.logger.log(`Updated ticker: ${symbol}`);
        return this.mapToTickerDto(data);
    }

    /**
     * Delete a ticker (soft delete by setting is_active to false)
     */
    async deleteTicker(symbol: string): Promise<void> {
        if (!this.supabase) {
            throw new Error('Database not configured');
        }

        const { error } = await this.supabase
            .from('tickers')
            .update({ is_active: false, last_updated: new Date().toISOString() })
            .eq('ticker', symbol.toUpperCase());

        if (error) {
            throw new Error(`Failed to delete ticker: ${error.message}`);
        }

        this.logger.log(`Deleted ticker: ${symbol}`);
    }

    /**
     * Enrich ticker metadata from external sources
     */
    async enrichTicker(symbol: string): Promise<TickerDto> {
        // This would fetch additional data from market data service
        // For now, just return the existing ticker
        return this.getTicker(symbol);
    }

    /**
     * Map database row to TickerDto
     */
    private mapToTickerDto(data: any): TickerDto {
        return {
            ticker: data.ticker,
            name: data.name,
            sector: data.sector,
            industry: data.industry,
            assetType: data.asset_type,
            exchange: data.exchange,
            country: data.country,
            marketCap: data.market_cap,
            isActive: data.is_active,
            firstAdded: new Date(data.first_added),
            lastUpdated: new Date(data.last_updated),
            metadata: data.metadata || {},
        };
    }
}
