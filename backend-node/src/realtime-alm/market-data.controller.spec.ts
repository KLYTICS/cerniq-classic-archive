import { Test, TestingModule } from '@nestjs/testing';
import { MarketDataController } from './market-data.controller';
import { MarketDataFeedService } from './market-data-feed.service';
import { RateAlertService } from './rate-alert.service';
import { AuthTenantGuard } from '../auth/auth-tenant.guard';
import { InstitutionScopeGuard } from '../agent-api/guards/institution-scope.guard';

describe('MarketDataController', () => {
  let controller: MarketDataController;
  let marketDataFeed: Record<string, jest.Mock>;
  let rateAlertService: Record<string, jest.Mock>;

  beforeEach(async () => {
    marketDataFeed = {
      fetchLatestRates: jest.fn(),
      fetchTreasuryCurve: jest.fn(),
      fetchSOFR: jest.fn(),
      getHistoricalRates: jest.fn(),
    };
    rateAlertService = {
      getActiveAlerts: jest.fn(),
      setThreshold: jest.fn(),
      removeThreshold: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MarketDataController],
      providers: [
        { provide: MarketDataFeedService, useValue: marketDataFeed },
        { provide: RateAlertService, useValue: rateAlertService },
      ],
    })
      .overrideGuard(AuthTenantGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(InstitutionScopeGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<MarketDataController>(MarketDataController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ─── Guard-wiring lock ─────────────────────────────────────────────────────
  // The contract: every route on this controller (public market-data feeds
  // AND scoped alert handlers) is guarded by AuthTenantGuard +
  // InstitutionScopeGuard at the CLASS level. InstitutionScopeGuard's
  // post-8f69c148 contract relaxation (`if (!institutionId) return true`)
  // means the 4 routes without :institutionId pass the ownership check
  // automatically; AuthTenantGuard still requires the caller to be
  // authenticated and tenant-resolved. No method-level overrides — adding
  // one (or removing the class-level decorator) fails this spec even though
  // canActivate is mocked. This is the only test that catches a silent
  // guard-removal regression.

  describe('guard wiring (reflection)', () => {
    it('class-level @UseGuards lists AuthTenantGuard + InstitutionScopeGuard in order', () => {
      const guards = Reflect.getMetadata('__guards__', MarketDataController) as
        | Array<{ name: string }>
        | undefined;
      const names = (guards ?? []).map((g) => g.name);
      expect(names).toEqual(['AuthTenantGuard', 'InstitutionScopeGuard']);
    });

    it.each<keyof MarketDataController>([
      'getLatestRates',
      'getTreasuryCurve',
      'getSOFR',
      'getHistory',
      'getActiveAlerts',
      'setAlertThreshold',
      'removeAlertThreshold',
    ])(
      'no method-level guard overrides on %s (class-level covers it)',
      (method) => {
        const handler = controller[method];
        const guards = Reflect.getMetadata('__guards__', handler) as
          | Array<{ name: string }>
          | undefined;
        expect(guards ?? []).toEqual([]);
      },
    );
  });

  // ─── Behavior smoke tests (guards bypassed via overrideGuard above) ───────

  describe('alert handlers', () => {
    it('getActiveAlerts forwards :institutionId to the service', async () => {
      rateAlertService.getActiveAlerts.mockResolvedValue([]);
      const result = await controller.getActiveAlerts('inst-1');
      expect(rateAlertService.getActiveAlerts).toHaveBeenCalledWith('inst-1');
      expect(result).toEqual({ data: [] });
    });

    it('setAlertThreshold validates body via Zod and forwards on success', async () => {
      const body = {
        metric: 'sofr',
        warnLevel: 5.0,
        breachLevel: 5.5,
        direction: 'ABOVE' as const,
      };
      const persisted = { ...body, notifyEmail: false, notifyWebhook: false };
      rateAlertService.setThreshold.mockResolvedValue(persisted);
      const result = await controller.setAlertThreshold('inst-1', body);
      expect(rateAlertService.setThreshold).toHaveBeenCalledWith(
        'inst-1',
        expect.objectContaining(body),
      );
      expect(result).toEqual({ data: persisted });
    });

    it('setAlertThreshold throws BadRequest on invalid body', async () => {
      await expect(
        controller.setAlertThreshold('inst-1', {
          metric: 'unknown',
        } as unknown),
      ).rejects.toThrow();
      expect(rateAlertService.setThreshold).not.toHaveBeenCalled();
    });

    it('removeAlertThreshold forwards :institutionId + :metric', async () => {
      rateAlertService.removeThreshold.mockResolvedValue(undefined);
      await controller.removeAlertThreshold('inst-1', 'sofr');
      expect(rateAlertService.removeThreshold).toHaveBeenCalledWith(
        'inst-1',
        'sofr',
      );
    });
  });
});
