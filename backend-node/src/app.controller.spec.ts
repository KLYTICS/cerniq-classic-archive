import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';
import { AuthGuard } from './auth/auth.guard';
import { EmailService } from './email/email.service';
import { MarketDataService } from './market-data/market-data.service';
import { MarketStreamManagerService } from './market-data/market-stream-manager.service';

jest.mock('./prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({
    $queryRaw: jest.fn(),
    demoRequest: { create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    institution: { count: jest.fn(), deleteMany: jest.fn() },
    balanceSheetItem: { deleteMany: jest.fn() },
    interestRateScenario: { deleteMany: jest.fn() },
    liquidityPosition: { deleteMany: jest.fn() },
    user: { count: jest.fn() },
    prospect: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn(), count: jest.fn() },
    workspace: { findMany: jest.fn(), create: jest.fn() },
    reportJob: { findMany: jest.fn() },
    subscription: { count: jest.fn() },
    analysisRun: { count: jest.fn() },
  })),
}));

describe('AppController', () => {
  let controller: AppController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        PrismaService,
        { provide: EmailService, useValue: { sendDemoRequestNotification: jest.fn(), sendDemoConfirmation: jest.fn() } },
        { provide: MarketDataService, useValue: { getHealth: jest.fn().mockReturnValue({ status: 'up' }) } },
        { provide: MarketStreamManagerService, useValue: { getStreamStatus: jest.fn().mockReturnValue({}) } },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AppController>(AppController);
  });

  it('should return "Hello World!"', () => {
    expect(controller.getHello()).toBe('Hello World!');
  });

  it('should return API status', () => {
    const status = controller.getStatus();
    expect(status.name).toBe('CERNIQ API');
    expect(status.version).toBe('2.0.0');
    expect(status.endpoints).toBeDefined();
  });
});
