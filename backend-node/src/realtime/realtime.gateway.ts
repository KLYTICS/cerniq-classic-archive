import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody, ConnectedSocket, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { MarketDataService } from '../market-data/market-data.service';
import { OptionsService } from '../options/options.service';
import { PortfolioService } from '../portfolio/portfolio.service';
import { OptionType } from '../options/dto/options.dto';

interface SubscriptionPayload {
    ticker: string;
    userId?: string;
}

interface GreeksSubscriptionPayload {
    ticker: string;
    strike: number;
    maturity: string;
    optionType: OptionType;
    riskFreeRate?: number;
}

interface PortfolioPnLPayload {
    portfolioId: string;
    userId: string;
}

@WebSocketGateway({
    cors: {
        origin: '*', // Configure appropriately for production
        credentials: true,
    },
    namespace: 'market-data',
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(RealtimeGateway.name);
    private priceIntervals: Map<string, NodeJS.Timeout> = new Map();
    private greeksIntervals: Map<string, NodeJS.Timeout> = new Map();
    private pnlIntervals: Map<string, NodeJS.Timeout> = new Map();
    private readonly UPDATE_INTERVAL_MS = 2000; // 2 second updates for demo

    constructor(
        private readonly marketDataService: MarketDataService,
        private readonly optionsService: OptionsService,
        private readonly portfolioService: PortfolioService,
    ) { }

    handleConnection(client: Socket) {
        this.logger.log(`Client connected: ${client.id}`);
    }

    handleDisconnect(client: Socket) {
        this.logger.log(`Client disconnected: ${client.id}`);
        this.cleanupClientSubscriptions(client.id);
    }

    /**
     * Subscribe to real-time price updates for a ticker
     */
    @SubscribeMessage('subscribe-ticker')
    async handleTickerSubscription(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: SubscriptionPayload,
    ) {
        const { ticker } = payload;
        const roomName = `ticker:${ticker}`;

        this.logger.log(`Client ${client.id} subscribing to ${ticker}`);
        client.join(roomName);

        // Start price stream if not already running
        if (!this.priceIntervals.has(ticker)) {
            await this.startPriceStream(ticker);
        }

        // Send immediate update
        try {
            const quote = await this.marketDataService.getQuote(ticker);
            client.emit('price-update', {
                ticker,
                price: quote.price,
                change: quote.change,
                changePercent: quote.changePercent,
                volume: quote.volume,
                timestamp: new Date(),
            });
        } catch (error) {
            this.logger.error(`Error fetching initial quote for ${ticker}:`, error);
            client.emit('error', { message: `Failed to fetch quote for ${ticker}` });
        }

        return { success: true, ticker, message: `Subscribed to ${ticker}` };
    }

    /**
     * Unsubscribe from ticker updates
     */
    @SubscribeMessage('unsubscribe-ticker')
    handleTickerUnsubscription(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: SubscriptionPayload,
    ) {
        const { ticker } = payload;
        const roomName = `ticker:${ticker}`;

        this.logger.log(`Client ${client.id} unsubscribing from ${ticker}`);
        client.leave(roomName);

        // Stop stream if no more clients
        const room = this.server.of('/market-data').adapter.rooms.get(roomName);
        if (!room || room.size === 0) {
            this.stopPriceStream(ticker);
        }

        return { success: true, ticker, message: `Unsubscribed from ${ticker}` };
    }

    /**
     * Subscribe to live Greeks calculations
     */
    @SubscribeMessage('subscribe-greeks')
    async handleGreeksSubscription(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: GreeksSubscriptionPayload,
    ) {
        const { ticker, strike, maturity, optionType, riskFreeRate = 0.045 } = payload;
        const greeksKey = `greeks:${ticker}:${strike}:${maturity}:${optionType}`;

        this.logger.log(`Client ${client.id} subscribing to Greeks for ${greeksKey}`);
        client.join(greeksKey);

        // Start Greeks calculation stream
        if (!this.greeksIntervals.has(greeksKey)) {
            await this.startGreeksStream(ticker, strike, maturity, optionType, riskFreeRate);
        }

        // Send immediate calculation
        try {
            const quote = await this.marketDataService.getQuote(ticker);
            const timeToMaturity = this.calculateTimeToMaturity(maturity);

            const greeks = await this.optionsService.calculateGreeks({
                underlying: quote.price,
                strike,
                timeToExpiry: timeToMaturity,
                volatility: 0.25, // Default, should fetch from market
                riskFreeRate,
                optionType,
            });

            client.emit('greeks-update', {
                ticker,
                strike,
                maturity,
                optionType,
                underlyingPrice: quote.price,
                greeks,
                timestamp: new Date(),
            });
        } catch (error) {
            this.logger.error(`Error calculating Greeks for ${greeksKey}:`, error);
            client.emit('error', { message: `Failed to calculate Greeks` });
        }

        return { success: true, message: `Subscribed to Greeks` };
    }

    /**
     * Subscribe to portfolio P&L updates
     */
    @SubscribeMessage('subscribe-portfolio-pnl')
    async handlePortfolioPnLSubscription(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: PortfolioPnLPayload,
    ) {
        const { portfolioId, userId } = payload;
        const pnlKey = `pnl:${portfolioId}`;

        this.logger.log(`Client ${client.id} subscribing to P&L for portfolio ${portfolioId}`);
        client.join(pnlKey);

        // Start P&L calculation stream
        if (!this.pnlIntervals.has(pnlKey)) {
            await this.startPnLStream(portfolioId, userId);
        }

        return { success: true, message: `Subscribed to portfolio P&L` };
    }

    /**
     * Start streaming price updates for a ticker
     */
    private async startPriceStream(ticker: string) {
        const roomName = `ticker:${ticker}`;

        const interval = setInterval(async () => {
            try {
                const quote = await this.marketDataService.getQuote(ticker);

                // Add small random variation for live simulation
                const variation = (Math.random() - 0.5) * 0.002; // ±0.2%
                const simulatedPrice = quote.price * (1 + variation);
                const simulatedChange = quote.change + (simulatedPrice - quote.price);
                const simulatedChangePercent = (simulatedChange / quote.previousClose) * 100;

                this.server.to(roomName).emit('price-update', {
                    ticker,
                    price: Number(simulatedPrice.toFixed(2)),
                    change: Number(simulatedChange.toFixed(2)),
                    changePercent: Number(simulatedChangePercent.toFixed(2)),
                    volume: quote.volume,
                    timestamp: new Date(),
                });
            } catch (error) {
                this.logger.error(`Error in price stream for ${ticker}:`, error);
            }
        }, this.UPDATE_INTERVAL_MS);

        this.priceIntervals.set(ticker, interval);
        this.logger.log(`Started price stream for ${ticker}`);
    }

    /**
     * Stop price stream for a ticker
     */
    private stopPriceStream(ticker: string) {
        const interval = this.priceIntervals.get(ticker);
        if (interval) {
            clearInterval(interval);
            this.priceIntervals.delete(ticker);
            this.logger.log(`Stopped price stream for ${ticker}`);
        }
    }

    /**
     * Start streaming Greeks calculations
     */
    private async startGreeksStream(
        ticker: string,
        strike: number,
        maturity: string,
        optionType: OptionType,
        riskFreeRate: number,
    ) {
        const greeksKey = `greeks:${ticker}:${strike}:${maturity}:${optionType}`;

        const interval = setInterval(async () => {
            try {
                const quote = await this.marketDataService.getQuote(ticker);
                const variation = (Math.random() - 0.5) * 0.002;
                const simulatedPrice = quote.price * (1 + variation);
                const timeToMaturity = this.calculateTimeToMaturity(maturity);

                const greeks = await this.optionsService.calculateGreeks({
                    underlying: simulatedPrice,
                    strike,
                    timeToExpiry: timeToMaturity,
                    volatility: 0.25,
                    riskFreeRate,
                    optionType,
                });

                this.server.to(greeksKey).emit('greeks-update', {
                    ticker,
                    strike,
                    maturity,
                    optionType,
                    underlyingPrice: simulatedPrice,
                    greeks,
                    timestamp: new Date(),
                });
            } catch (error) {
                this.logger.error(`Error in Greeks stream for ${greeksKey}:`, error);
            }
        }, this.UPDATE_INTERVAL_MS);

        this.greeksIntervals.set(greeksKey, interval);
        this.logger.log(`Started Greeks stream for ${greeksKey}`);
    }

    /**
     * Start streaming portfolio P&L updates
     */
    private async startPnLStream(portfolioId: string, userId: string) {
        const pnlKey = `pnl:${portfolioId}`;

        const interval = setInterval(async () => {
            try {
                const portfolio = await this.portfolioService.getPortfolio(portfolioId, userId);

                if (!portfolio || !portfolio.positions || portfolio.positions.length === 0) {
                    return;
                }

                let totalValue = 0;
                let totalCost = 0;

                // Calculate P&L for each position
                for (const position of portfolio.positions) {
                    const quote = await this.marketDataService.getQuote(position.ticker);
                    const variation = (Math.random() - 0.5) * 0.002;
                    const simulatedPrice = quote.price * (1 + variation);

                    const positionValue = position.quantity * simulatedPrice;
                    const positionCost = position.quantity * position.avgCost;

                    totalValue += positionValue;
                    totalCost += positionCost;
                }

                const totalPnL = totalValue - totalCost;
                const totalPnLPercent = (totalPnL / totalCost) * 100;

                this.server.to(pnlKey).emit('pnl-update', {
                    portfolioId,
                    totalValue: Number(totalValue.toFixed(2)),
                    totalCost: Number(totalCost.toFixed(2)),
                    totalPnL: Number(totalPnL.toFixed(2)),
                    totalPnLPercent: Number(totalPnLPercent.toFixed(2)),
                    timestamp: new Date(),
                });
            } catch (error) {
                this.logger.error(`Error in P&L stream for ${pnlKey}:`, error);
            }
        }, this.UPDATE_INTERVAL_MS);

        this.pnlIntervals.set(pnlKey, interval);
        this.logger.log(`Started P&L stream for portfolio ${portfolioId}`);
    }

    /**
     * Calculate time to maturity in years from maturity string (YYYY-MM-DD)
     */
    private calculateTimeToMaturity(maturity: string): number {
        const maturityDate = new Date(maturity);
        const now = new Date();
        const diffMs = maturityDate.getTime() - now.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        return diffDays / 365; // Convert to years
    }

    /**
     * Clean up all subscriptions for a disconnected client
     */
    private cleanupClientSubscriptions(clientId: string) {
        // This is called automatically on disconnect
        // Cleanup is handled by room management
        this.logger.log(`Cleaned up subscriptions for client ${clientId}`);
    }
}
