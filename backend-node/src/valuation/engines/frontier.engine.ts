import { Injectable, Logger } from '@nestjs/common';
import { FrontierValuationDto, ScenarioValuationDto } from '../dto/valuation.dto';

@Injectable()
export class FrontierValuationEngine {
    private readonly logger = new Logger(FrontierValuationEngine.name);

    /**
     * Value frontier/early-stage high-growth businesses using scenario analysis
     * Focus: Optionality, TAM, execution risk, multiple outcomes
     */
    async calculate(
        ticker: string,
        currentPrice: number,
        fundamentals: any,
    ): Promise<FrontierValuationDto> {
        this.logger.log(`Calculating frontier valuation for ${ticker}`);

        // Define scenarios with different outcomes
        const scenarios: ScenarioValuationDto[] = [
            {
                name: 'Bull Case: Market Leader',
                probability: 0.25,
                value: currentPrice * 5.0,
                assumptions: '30% market share, 50% margins, moat established',
            },
            {
                name: 'Base Case: Strong Niche',
                probability: 0.40,
                value: currentPrice * 2.0,
                assumptions: '10% market share, 25% margins, sustainable growth',
            },
            {
                name: 'Bear Case: Struggle',
                probability: 0.25,
                value: currentPrice * 0.5,
                assumptions: 'Competition intensifies, margins compressed',
            },
            {
                name: 'Bust: Failure',
                probability: 0.10,
                value: currentPrice * 0.1,
                assumptions: 'Product-market fit fails, runway ends',
            },
        ];

        // Calculate probability-weighted value
        const probabilityWeightedValue = scenarios.reduce(
            (sum, s) => sum + s.value * s.probability,
            0,
        );

        const upside = ((probabilityWeightedValue - currentPrice) / currentPrice) * 100;

        // Optionality score: variance in outcomes
        const optionality = this.calculateOptionality(scenarios);

        // Identify catalysts
        const catalysts = this.identifyCatalysts(ticker, fundamentals);

        return {
            ticker,
            currentPrice,
            scenarios,
            probabilityWeightedValue,
            upside,
            optionality,
            catalysts,
        };
    }

    /**
     * Calculate optionality score based on scenario variance
     */
    private calculateOptionality(scenarios: ScenarioValuationDto[]): number {
        const values = scenarios.map(s => s.value);
        const mean = values.reduce((sum, v) => sum + v, 0) / values.length;

        // Coefficient of variation as optionality measure
        const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
        const stdDev = Math.sqrt(variance);
        const cv = (stdDev / mean) * 100;

        // Normalize to 0-100 scale
        return Math.min(cv, 100);
    }

    /**
     * Identify potential catalysts
     */
    private identifyCatalysts(ticker: string, fundamentals: any): string[] {
        // Placeholder - would analyze news, earnings, product launches
        return [
            'Product launch in 6 months',
            'Potential strategic partnership',
            'Market expansion to Europe',
            'First profitability target FY2026',
        ];
    }
}
