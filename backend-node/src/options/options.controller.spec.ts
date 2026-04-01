import { Test, TestingModule } from '@nestjs/testing';
import { OptionsController } from './options.controller';
import { OptionsService } from './options.service';
import { AuthGuard } from '../auth/auth.guard';
import { STRATEGY_PRESETS } from './dto/strategy.dto';

describe('OptionsController', () => {
  let controller: OptionsController;

  const mockOptionsService = {
    calculateGreeks: jest.fn(),
    getOptionsChain: jest.fn(),
    calculateImpliedVolatility: jest.fn(),
    calculateStrategy: jest.fn(),
    getVolatilitySurface: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [OptionsController],
      providers: [
        { provide: OptionsService, useValue: mockOptionsService },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<OptionsController>(OptionsController);
    jest.clearAllMocks();
  });

  it('healthCheck returns ok status with feature flags', () => {
    const result = controller.healthCheck();

    expect(result.status).toBe('ok');
    expect(result.service).toBe('options');
    expect(result.features.greeksCalculation).toBe(true);
    expect(result.timestamp).toBeDefined();
  });

  it('getStrategyPresets returns presets array with count', () => {
    const result = controller.getStrategyPresets();

    expect(result.presets).toBe(STRATEGY_PRESETS);
    expect(result.count).toBe(STRATEGY_PRESETS.length);
  });

  it('calculateGreeks delegates to OptionsService', async () => {
    const dto = {
      underlying: 100,
      strike: 105,
      timeToExpiry: 0.25,
      riskFreeRate: 0.05,
      volatility: 0.25,
      optionType: 'call',
    };
    const expected = { delta: 0.45, gamma: 0.03, theta: -0.02, vega: 0.18 };
    mockOptionsService.calculateGreeks.mockResolvedValue(expected);

    const result = await controller.calculateGreeks(dto as any);

    expect(result).toEqual(expected);
    expect(mockOptionsService.calculateGreeks).toHaveBeenCalledWith(dto);
  });

  // ── calculateGreeks error path ─────────────────────────────────────
  it('calculateGreeks throws HttpException on service error', async () => {
    mockOptionsService.calculateGreeks.mockRejectedValue(new Error('Negative volatility'));

    await expect(controller.calculateGreeks({} as any)).rejects.toThrow('Negative volatility');
  });

  // ── getOptionsChain ────────────────────────────────────────────────
  it('getOptionsChain delegates with uppercase ticker', async () => {
    const expected = { ticker: 'AAPL', chain: [] };
    mockOptionsService.getOptionsChain.mockResolvedValue(expected);

    const result = await controller.getOptionsChain('aapl', '2024-06-21');

    expect(result).toEqual(expected);
    expect(mockOptionsService.getOptionsChain).toHaveBeenCalledWith({
      ticker: 'AAPL',
      maturity: '2024-06-21',
    });
  });

  it('getOptionsChain works without maturity', async () => {
    mockOptionsService.getOptionsChain.mockResolvedValue({ ticker: 'TSLA', chain: [] });

    const result = await controller.getOptionsChain('tsla');

    expect(mockOptionsService.getOptionsChain).toHaveBeenCalledWith({
      ticker: 'TSLA',
      maturity: undefined,
    });
  });

  it('getOptionsChain throws HttpException on service error', async () => {
    mockOptionsService.getOptionsChain.mockRejectedValue(new Error('Ticker not found'));

    await expect(controller.getOptionsChain('BAD')).rejects.toThrow('Ticker not found');
  });

  // ── calculateImpliedVolatility ─────────────────────────────────────
  it('calculateImpliedVolatility delegates to OptionsService', async () => {
    const dto = { ticker: 'AAPL', strike: 150, expiration: '2024-06-21', optionType: 'call', marketPrice: 5.25 };
    const expected = { impliedVolatility: 0.28 };
    mockOptionsService.calculateImpliedVolatility.mockResolvedValue(expected);

    const result = await controller.calculateImpliedVolatility(dto as any);

    expect(result).toEqual(expected);
    expect(mockOptionsService.calculateImpliedVolatility).toHaveBeenCalledWith(dto);
  });

  it('calculateImpliedVolatility throws HttpException on service error', async () => {
    mockOptionsService.calculateImpliedVolatility.mockRejectedValue(new Error('Convergence failed'));

    await expect(controller.calculateImpliedVolatility({} as any)).rejects.toThrow('Convergence failed');
  });

  // ── calculateStrategy ──────────────────────────────────────────────
  it('calculateStrategy delegates to OptionsService', async () => {
    const dto = {
      legs: [{ strike: 100, expiration: '2024-06-21', optionType: 'call', quantity: 1, buySell: 'buy' }],
      underlyingPrice: 105,
      volatility: 0.25,
      riskFreeRate: 0.05,
    };
    const expected = { maxProfit: 500, maxLoss: -200, breakeven: [102] };
    mockOptionsService.calculateStrategy.mockResolvedValue(expected);

    const result = await controller.calculateStrategy(dto as any);

    expect(result).toEqual(expected);
    expect(mockOptionsService.calculateStrategy).toHaveBeenCalledWith(dto);
  });

  it('calculateStrategy throws HttpException on service error', async () => {
    mockOptionsService.calculateStrategy.mockRejectedValue(new Error('Invalid legs'));

    await expect(controller.calculateStrategy({} as any)).rejects.toThrow('Invalid legs');
  });

  // ── getVolatilitySurface ───────────────────────────────────────────
  it('getVolatilitySurface delegates to OptionsService', async () => {
    const expected = { ticker: 'AAPL', surface: [] };
    mockOptionsService.getVolatilitySurface.mockResolvedValue(expected);

    const result = await controller.getVolatilitySurface('AAPL');

    expect(result).toEqual(expected);
    expect(mockOptionsService.getVolatilitySurface).toHaveBeenCalledWith('AAPL');
  });

  it('getVolatilitySurface throws HttpException on service error', async () => {
    mockOptionsService.getVolatilitySurface.mockRejectedValue(new Error('No data'));

    await expect(controller.getVolatilitySurface('BAD')).rejects.toThrow('No data');
  });
});
