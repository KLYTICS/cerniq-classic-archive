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
});
