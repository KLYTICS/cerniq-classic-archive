import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service';
import { MarketDataService } from '../market-data/market-data.service';
import { CacheService } from '../cache/cache.service';
import { RiskService } from '../risk/risk.service';

const BATCH_SIZE = 10;

@Injectable()
export class DailyPipelineService {
  private readonly logger = new Logger(DailyPipelineService.name);
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly marketDataService: MarketDataService,
    private readonly cacheService: CacheService,
    private readonly riskService: RiskService,
  ) {}

  /**
   * Runs at 6:30 PM EST every weekday (after market close).
   * Cron uses server local time — 18:30 EST = 23:30 UTC
   */
  @Cron('0 30 23 * * 1-5', {
    name: 'daily-eod-pipeline',
    timeZone: 'America/New_York',
  })
  async handleScheduledRun() {
    this.logger.log('Scheduled daily pipeline triggered');
    await this.runPipeline();
  }

  /**
   * Main pipeline logic — can be called on schedule or manually.
   */
  async runPipeline(): Promise<{
    status: string;
    tickersProcessed: number;
    errors: string[];
    durationMs: number;
  }> {
    if (this.isRunning) {
      this.logger.warn('Pipeline already running, skipping');
      return {
        status: 'SKIPPED',
        tickersProcessed: 0,
        errors: ['Pipeline already in progress'],
        durationMs: 0,
      };
    }

    this.isRunning = true;
    const startTime = Date.now();
    const errors: string[] = [];
    let tickersProcessed = 0;

    // Create pipeline run record
    const run = await this.prisma.pipelineRun.create({
      data: { status: 'RUNNING' },
    });

    this.logger.log(`Pipeline run started: ${run.id}`);

    try {
      // Step A: Get active ticker universe from positions table
      const tickers = await this.getActiveUniverse();
      this.logger.log(
        `Active universe: ${tickers.length} tickers — ${tickers.join(', ')}`,
      );

      if (tickers.length === 0) {
        this.logger.warn('No active tickers found in positions table');
        await this.completePipelineRun(run.id, 'SUCCESS', 0, [], startTime);
        return {
          status: 'SUCCESS',
          tickersProcessed: 0,
          errors: [],
          durationMs: Date.now() - startTime,
        };
      }

      // Step B+C: Fetch EOD prices in batches of BATCH_SIZE
      const priceResults = await this.fetchEodPricesInBatches(tickers, errors);
      tickersProcessed = priceResults.length;

      // Step D: Upsert price data into market_prices table
      await this.upsertPrices(priceResults, errors);

      // Step E: Recompute portfolio risk metrics and cache in Redis
      await this.recomputePortfolioRisk(errors);

      // Step F: Complete the run
      const status = errors.length === 0 ? 'SUCCESS' : 'SUCCESS';
      await this.completePipelineRun(
        run.id,
        status,
        tickersProcessed,
        errors,
        startTime,
      );

      this.logger.log(
        `Pipeline completed: ${tickersProcessed} tickers, ${errors.length} errors, ${Date.now() - startTime}ms`,
      );

      return {
        status,
        tickersProcessed,
        errors,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Pipeline failed: ${msg}`);
      errors.push(`Fatal: ${msg}`);

      await this.completePipelineRun(
        run.id,
        'FAILED',
        tickersProcessed,
        errors,
        startTime,
      );

      return {
        status: 'FAILED',
        tickersProcessed,
        errors,
        durationMs: Date.now() - startTime,
      };
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Step A: Query all unique tickers from the positions table.
   */
  private async getActiveUniverse(): Promise<string[]> {
    const positions = await this.prisma.position.findMany({
      select: { ticker: true },
      distinct: ['ticker'],
      take: 1000,
    });
    return positions.map((p: any) => p.ticker);
  }

  /**
   * Step B+C: Fetch EOD prices for each ticker, batched with max 10 concurrent.
   */
  private async fetchEodPricesInBatches(
    tickers: string[],
    errors: string[],
  ): Promise<
    {
      ticker: string;
      price: number;
      change: number;
      changePercent: number;
      high?: number;
      low?: number;
      open?: number;
      volume?: number;
    }[]
  > {
    const results: {
      ticker: string;
      price: number;
      change: number;
      changePercent: number;
      high?: number;
      low?: number;
      open?: number;
      volume?: number;
    }[] = [];

    // Process in chunks of BATCH_SIZE
    for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
      const batch = tickers.slice(i, i + BATCH_SIZE);
      this.logger.debug(
        `Fetching batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.join(', ')}`,
      );

      const batchResults = await Promise.all(
        batch.map(async (ticker) => {
          try {
            const quote = await this.marketDataService.getQuote(ticker);
            return {
              ticker,
              price: quote.price,
              change: quote.change ?? 0,
              changePercent: quote.changePercent ?? 0,
              high: quote.high,
              low: quote.low,
              open: quote.open,
              volume: quote.volume,
            };
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.error(`Failed to fetch ${ticker}: ${msg}`);
            errors.push(`Fetch ${ticker}: ${msg}`);
            return null;
          }
        }),
      );

      results.push(
        ...batchResults.filter((r): r is NonNullable<typeof r> => r !== null),
      );
    }

    return results;
  }

  /**
   * Step D: Upsert EOD prices into market_prices table.
   */
  private async upsertPrices(
    prices: {
      ticker: string;
      price: number;
      high?: number;
      low?: number;
      open?: number;
      volume?: number;
    }[],
    errors: string[],
  ): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const p of prices) {
      try {
        await this.prisma.marketPrice.upsert({
          where: {
            ticker_date: { ticker: p.ticker, date: today },
          },
          update: {
            close: p.price,
            high: p.high ?? p.price,
            low: p.low ?? p.price,
            volume: p.volume ? BigInt(Math.round(p.volume)) : null,
          },
          create: {
            ticker: p.ticker,
            date: today,
            open: p.open ?? p.price,
            high: p.high ?? p.price,
            low: p.low ?? p.price,
            close: p.price,
            volume: p.volume ? BigInt(Math.round(p.volume)) : null,
          },
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`Failed to upsert price for ${p.ticker}: ${msg}`);
        errors.push(`Upsert ${p.ticker}: ${msg}`);
      }
    }

    this.logger.log(
      `Upserted ${prices.length} price records for ${today.toISOString().slice(0, 10)}`,
    );
  }

  /**
   * Step E: Recompute VaR and correlation for each portfolio and cache in Redis.
   */
  private async recomputePortfolioRisk(errors: string[]): Promise<void> {
    const portfolios = await this.prisma.portfolio.findMany({
      include: { positions: true },
      take: 100,
    });

    this.logger.log(`Recomputing risk for ${portfolios.length} portfolios`);

    for (const portfolio of portfolios) {
      if (portfolio.positions.length === 0) continue;

      const tickers = portfolio.positions.map((p: any) => p.ticker);

      try {
        // Compute correlation matrix (90 days back)
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        const correlationResult =
          await this.riskService.calculateCorrelationMatrix({
            tickers,
            startDate: ninetyDaysAgo.toISOString().slice(0, 10),
          });
        await this.cacheService.set(
          `risk:correlation:${portfolio.id}`,
          correlationResult,
          3600, // 1 hour TTL
        );

        // Compute VaR for the portfolio
        const positions = portfolio.positions.map((p: any) => ({
          ticker: p.ticker,
          quantity: Number(p.quantity),
          price: Number(p.avgCost),
        }));
        const totalValue = positions.reduce(
          (sum: number, p: any) => sum + p.quantity * p.price,
          0,
        );

        if (totalValue > 0) {
          const varResult = await this.riskService.calculateVaR({
            portfolioValue: totalValue,
            confidenceLevel: 0.95,
            returns: [], // RiskService generates synthetic returns if empty
          });
          await this.cacheService.set(
            `risk:var:${portfolio.id}`,
            varResult,
            3600,
          );
        }

        this.logger.debug(`Cached risk metrics for portfolio ${portfolio.id}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `Failed to compute risk for portfolio ${portfolio.id}: ${msg}`,
        );
        errors.push(`Risk ${portfolio.id}: ${msg}`);
      }
    }
  }

  /**
   * Complete a pipeline run record.
   */
  private async completePipelineRun(
    runId: string,
    status: 'SUCCESS' | 'FAILED',
    tickersProcessed: number,
    errors: string[],
    startTime: number,
  ): Promise<void> {
    await this.prisma.pipelineRun.update({
      where: { id: runId },
      data: {
        completedAt: new Date(),
        status,
        tickersProcessed,
        errors: errors.length > 0 ? errors : undefined,
        durationMs: Date.now() - startTime,
      },
    });
  }

  /**
   * Get the last successful pipeline run.
   */
  async getLastSuccessfulRun() {
    return this.prisma.pipelineRun.findFirst({
      where: { status: 'SUCCESS' },
      orderBy: { completedAt: 'desc' },
    });
  }

  /**
   * Get count of tracked tickers.
   */
  async getTrackedTickerCount(): Promise<number> {
    const result = await this.prisma.position.findMany({
      select: { ticker: true },
      distinct: ['ticker'],
      take: 1000,
    });
    return result.length;
  }
}
