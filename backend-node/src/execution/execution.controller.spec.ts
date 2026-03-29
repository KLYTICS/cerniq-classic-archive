import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { ExecutionController } from './execution.controller';
import { ExecutionService } from './execution.service';
import { BacktestService } from './backtest.service';
import { AuthGuard } from '../auth/auth.guard';

describe('ExecutionController', () => {
  let controller: ExecutionController;
  let executionService: Record<string, jest.Mock>;
  let backtestService: Record<string, jest.Mock>;

  beforeEach(async () => {
    executionService = {
      calculateSlippage: jest.fn(),
      analyzeVWAP: jest.fn(),
      generateBestExecutionReport: jest.fn(),
      calculateImplementationShortfall: jest.fn(),
    };

    backtestService = {
      runBacktest: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExecutionController],
      providers: [
        { provide: ExecutionService, useValue: executionService },
        { provide: BacktestService, useValue: backtestService },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ExecutionController>(ExecutionController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('analyzeSlippage', () => {
    it('should return slippage analysis', async () => {
      const mockResult = { slippage: 0.05 };
      executionService.calculateSlippage.mockResolvedValue(mockResult);

      const execution = { ticker: 'AAPL', price: 150, quantity: 100 };
      const result = await controller.analyzeSlippage(execution);
      expect(result).toEqual(mockResult);
      expect(executionService.calculateSlippage).toHaveBeenCalledWith(execution);
    });

    it('should throw HttpException on error', async () => {
      executionService.calculateSlippage.mockRejectedValue(
        new Error('Calc failed'),
      );

      await expect(controller.analyzeSlippage({})).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('analyzeVWAP', () => {
    it('should return VWAP analysis with default period', async () => {
      const mockResult = { vwap: 151.5 };
      executionService.analyzeVWAP.mockResolvedValue(mockResult);

      const execution = { ticker: 'AAPL' };
      const result = await controller.analyzeVWAP(execution, '60');
      expect(result).toEqual(mockResult);
      expect(executionService.analyzeVWAP).toHaveBeenCalledWith(execution, 60);
    });

    it('should parse custom period', async () => {
      executionService.analyzeVWAP.mockResolvedValue({});

      await controller.analyzeVWAP({}, '120');
      expect(executionService.analyzeVWAP).toHaveBeenCalledWith({}, 120);
    });

    it('should throw HttpException on error', async () => {
      executionService.analyzeVWAP.mockRejectedValue(new Error('fail'));

      await expect(controller.analyzeVWAP({}, '60')).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('generateBestExecutionReport', () => {
    it('should generate a best execution report', async () => {
      const mockReport = { summary: 'Good execution' };
      executionService.generateBestExecutionReport.mockResolvedValue(
        mockReport,
      );

      const body = {
        executions: [{ ticker: 'AAPL' }],
        startDate: '2025-01-01',
        endDate: '2025-12-31',
      };
      const result = await controller.generateBestExecutionReport(body);
      expect(result).toEqual(mockReport);
      expect(
        executionService.generateBestExecutionReport,
      ).toHaveBeenCalledWith([{ ticker: 'AAPL' }], {
        start: new Date('2025-01-01'),
        end: new Date('2025-12-31'),
      });
    });

    it('should throw HttpException on error', async () => {
      executionService.generateBestExecutionReport.mockRejectedValue(
        new Error('fail'),
      );

      await expect(
        controller.generateBestExecutionReport({
          executions: [],
          startDate: '2025-01-01',
          endDate: '2025-12-31',
        }),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('calculateImplementationShortfall', () => {
    it('should calculate implementation shortfall', async () => {
      const mockResult = { shortfall: 0.02 };
      executionService.calculateImplementationShortfall.mockResolvedValue(
        mockResult,
      );

      const trade = { ticker: 'AAPL', entryPrice: 150 };
      const result = await controller.calculateImplementationShortfall(trade);
      expect(result).toEqual(mockResult);
    });

    it('should throw HttpException on error', async () => {
      executionService.calculateImplementationShortfall.mockRejectedValue(
        new Error('fail'),
      );

      await expect(
        controller.calculateImplementationShortfall({}),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('runBacktest', () => {
    it('should run a backtest', async () => {
      const mockResult = { returns: 0.15 };
      backtestService.runBacktest.mockResolvedValue(mockResult);

      const config = { strategy: 'SMA_CROSSOVER' };
      const result = await controller.runBacktest(config);
      expect(result).toEqual(mockResult);
      expect(backtestService.runBacktest).toHaveBeenCalledWith(config);
    });

    it('should throw HttpException on error', async () => {
      backtestService.runBacktest.mockRejectedValue(new Error('fail'));

      await expect(controller.runBacktest({})).rejects.toThrow(HttpException);
    });
  });

  describe('getAvailableStrategies', () => {
    it('should return list of strategies', () => {
      const result = controller.getAvailableStrategies();
      expect(result).toHaveLength(4);
      expect(result[0].type).toBe('SMA_CROSSOVER');
      expect(result[1].type).toBe('SMA_CROSSOVER');
      expect(result[2].type).toBe('RSI_REVERSAL');
      expect(result[3].type).toBe('MOMENTUM');
    });
  });
});
