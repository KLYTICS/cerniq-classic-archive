import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { RiskService } from './risk.service';
import { AdvancedRiskService } from './advanced-risk.service';
import {
  MonteCarloRequestDto,
  VaRRequestDto,
  CorrelationMatrixRequestDto,
  StressTestScenarioDto,
} from './dto/risk.dto';
import {
  ComponentVaRRequestDto,
  VolatilityForecastRequestDto,
  ParametricVaRRequestDto,
} from './dto/advanced-risk.dto';
import { AuthGuard } from '../auth/auth.guard';

@Controller('api/risk')
@UseGuards(AuthGuard)
export class RiskController {
  constructor(
    private readonly riskService: RiskService,
    private readonly advancedRiskService: AdvancedRiskService,
  ) {}

  @Post('monte-carlo')
  async runMonteCarloSimulation(@Body() request: MonteCarloRequestDto) {
    return this.riskService.runMonteCarloSimulation(request);
  }

  @Post('var')
  async calculateVaR(@Body() request: VaRRequestDto) {
    return this.riskService.calculateVaR(request);
  }

  @Post('correlation')
  async calculateCorrelationMatrix(
    @Body() request: CorrelationMatrixRequestDto,
  ) {
    return this.riskService.calculateCorrelationMatrix(request);
  }

  @Get('portfolio/:portfolioId')
  async getPortfolioRisk(
    @Param('portfolioId') portfolioId: string,
    @Req() req: any,
  ) {
    return this.riskService.getPortfolioRisk(portfolioId, req.user.userId);
  }

  @Post('stress-test/:portfolioId')
  async runStressTest(
    @Param('portfolioId') portfolioId: string,
    @Req() req: any,
    @Body() scenarios: StressTestScenarioDto[],
  ) {
    return this.riskService.runStressTest(
      portfolioId,
      req.user.userId,
      scenarios,
    );
  }

  // ==================== Advanced Risk Analytics ====================

  @Post('component-var')
  async calculateComponentVaR(@Body() request: ComponentVaRRequestDto) {
    return this.advancedRiskService.calculateComponentVaR(request);
  }

  @Get('forecast-volatility/:ticker')
  async forecastVolatility(
    @Param('ticker') ticker: string,
    @Query('horizon') horizon?: number,
  ) {
    return this.advancedRiskService.forecastVolatility({
      ticker,
      horizon: horizon ? parseInt(horizon.toString()) : 30,
    });
  }

  @Post('parametric-var')
  async calculateParametricVaR(@Body() request: ParametricVaRRequestDto) {
    return this.advancedRiskService.calculateParametricVaR(request);
  }
}
