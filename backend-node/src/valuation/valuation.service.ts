import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  ValuationRequestDto,
  CyclicalValuationDto,
  CompounderValuationDto,
  FrontierValuationDto,
  KPIScoreDto,
  ScreenerRequestDto,
  ScreenerResultDto,
} from './dto/valuation.dto';
import { CyclicalValuationEngine } from './engines/cyclical.engine';
import { CompounderValuationEngine } from './engines/compounder.engine';
import { FrontierValuationEngine } from './engines/frontier.engine';
import { KPIScoringEngine } from './engines/kpi-scoring.engine';
import { MarketDataService } from '../market-data/market-data.service';
import { TickerService } from '../ticker/ticker.service';

@Injectable()
export class ValuationService {
  private readonly logger = new Logger(ValuationService.name);

  constructor(
    private readonly cyclicalEngine: CyclicalValuationEngine,
    private readonly compounderEngine: CompounderValuationEngine,
    private readonly frontierEngine: FrontierValuationEngine,
    private readonly kpiEngine: KPIScoringEngine,
    private readonly marketDataService: MarketDataService,
    private readonly tickerService: TickerService,
  ) {}

  /**
   * Get valuation for a ticker (auto-detects best method)
   */
  async getValuation(request: ValuationRequestDto): Promise<any> {
    const { ticker, valuationType = 'auto' } = request;

    // Fetch market data
    const quote = await this.marketDataService.getQuote(ticker);
    let fundamentals: any;

    try {
      fundamentals = await this.marketDataService.getFundamentals(ticker);
    } catch (error) {
      this.logger.warn(
        `Fundamentals not available for ${ticker}, using defaults`,
      );
      fundamentals = {};
    }

    // Auto-detect valuation type if not specified
    const selectedType =
      valuationType === 'auto'
        ? this.detectValuationType(ticker, fundamentals)
        : valuationType;

    this.logger.log(`Using ${selectedType} valuation for ${ticker}`);

    switch (selectedType) {
      case 'cyclical':
        return this.cyclicalEngine.calculate(ticker, quote.price, fundamentals);
      case 'compounder':
        return this.compounderEngine.calculate(
          ticker,
          quote.price,
          fundamentals,
        );
      case 'frontier':
        return this.frontierEngine.calculate(ticker, quote.price, fundamentals);
      default:
        throw new NotFoundException(`Invalid valuation type: ${selectedType}`);
    }
  }

  /**
   * Get KPI score for a ticker
   */
  async getKPIScore(ticker: string): Promise<KPIScoreDto> {
    const quote = await this.marketDataService.getQuote(ticker);
    let fundamentals: any;

    try {
      fundamentals = await this.marketDataService.getFundamentals(ticker);
    } catch (error) {
      fundamentals = {};
    }

    return this.kpiEngine.calculate(ticker, fundamentals, {
      price: quote.price,
    });
  }

  /**
   * Run valuation screener
   */
  async runScreener(request: ScreenerRequestDto): Promise<ScreenerResultDto[]> {
    this.logger.log('Running valuation screener');

    // Get tickers from database
    const tickersResponse = await this.tickerService.listTickers({
      assetType: request.assetType,
      sector: request.sector,
      isActive: true,
      limit: request.limit || 50,
      page: 1,
    });

    const results: ScreenerResultDto[] = [];

    // Calculate valuations for each ticker
    for (const tickerData of tickersResponse.tickers.slice(0, 20)) {
      try {
        const quote = await this.marketDataService.getQuote(tickerData.ticker);
        const kpiScore = await this.getKPIScore(tickerData.ticker);

        // Determine valuation type
        const valuationType =
          request.valuationType ||
          this.detectValuationType(tickerData.ticker, {});

        // Get valuation
        const valuation: any = await this.getValuation({
          ticker: tickerData.ticker,
          valuationType: valuationType as any,
        });

        // Filter by minimum score
        if (request.minScore && kpiScore.overallScore < request.minScore) {
          continue;
        }

        results.push({
          ticker: tickerData.ticker,
          name: tickerData.name,
          currentPrice: quote.price,
          fairValue:
            valuation.fairValue || valuation.probabilityWeightedValue || 0,
          upside: valuation.upside || 0,
          score: kpiScore.overallScore,
          valuationType: valuationType as any,
          sector: tickerData.sector || 'Unknown',
          marketCap: tickerData.marketCap || 0,
        });
      } catch (error) {
        this.logger.warn(
          `Failed to value ${tickerData.ticker}: ${error.message}`,
        );
      }
    }

    // Sort results
    const sortBy = request.sortBy || 'score';
    results.sort((a, b) => {
      if (sortBy === 'upside') return b.upside - a.upside;
      if (sortBy === 'marketCap') return b.marketCap - a.marketCap;
      return b.score - a.score;
    });

    return results;
  }

  /**
   * Auto-detect appropriate valuation methodology
   */
  private detectValuationType(
    ticker: string,
    fundamentals: any,
  ): 'cyclical' | 'compounder' | 'frontier' {
    // Industry-based detection (simplified)
    const cyclicalSectors = ['Materials', 'Energy', 'Industrials'];
    const compounderSectors = [
      'Technology',
      'Consumer Discretionary',
      'Healthcare',
    ];

    // Check ticker patterns
    if (
      ticker.includes('SEMI') ||
      ticker.includes('ASML') ||
      ticker.includes('LRCX')
    ) {
      return 'cyclical'; // Semiconductor equipment
    }

    if (
      ticker.includes('AI') ||
      ticker.includes('NVDA') ||
      fundamentals?.sector === 'AI'
    ) {
      return 'frontier'; // High-growth AI
    }

    // Default to compounder for quality businesses
    return 'compounder';
  }
}
