import { HttpException, HttpStatus } from '@nestjs/common';
import { ValuationController } from './valuation.controller';

describe('ValuationController', () => {
  let controller: ValuationController;
  let mockService: any;

  beforeEach(() => {
    mockService = {
      getValuation: jest.fn(),
      getKPIScore: jest.fn(),
      runScreener: jest.fn(),
    };
    controller = new ValuationController(mockService);
  });

  // ── getValuation ────────────────────────────────────────────

  describe('getValuation (POST /calculate)', () => {
    it('returns valuation result on success', async () => {
      mockService.getValuation.mockResolvedValue({
        fairValue: 200,
        upside: 15,
      });
      const result = await controller.getValuation({ ticker: 'AAPL' });
      expect(result).toEqual({ fairValue: 200, upside: 15 });
      expect(mockService.getValuation).toHaveBeenCalledWith({ ticker: 'AAPL' });
    });

    it('throws HttpException with error message on failure', async () => {
      mockService.getValuation.mockRejectedValue(new Error('Ticker not found'));
      await expect(
        controller.getValuation({ ticker: 'INVALID' }),
      ).rejects.toThrow(HttpException);
    });

    it('uses error.status if available', async () => {
      const err: any = new Error('Not found');
      err.status = 404;
      mockService.getValuation.mockRejectedValue(err);
      try {
        await controller.getValuation({ ticker: 'INVALID' });
      } catch (e: any) {
        expect(e.getStatus()).toBe(404);
      }
    });

    it('defaults to 500 when error has no status', async () => {
      mockService.getValuation.mockRejectedValue(new Error('Internal'));
      try {
        await controller.getValuation({ ticker: 'X' });
      } catch (e: any) {
        expect(e.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      }
    });

    it('uses default message when error.message is empty', async () => {
      mockService.getValuation.mockRejectedValue(new Error(''));
      try {
        await controller.getValuation({ ticker: 'X' });
      } catch (e: any) {
        expect(e.message).toBe('Failed to calculate valuation');
      }
    });
  });

  // ── getKPIScore ─────────────────────────────────────────────

  describe('getKPIScore (GET /kpi/:ticker)', () => {
    it('returns KPI score on success', async () => {
      mockService.getKPIScore.mockResolvedValue({ overallScore: 85 });
      const result = await controller.getKPIScore('AAPL');
      expect(result.overallScore).toBe(85);
    });

    it('throws HttpException on failure', async () => {
      mockService.getKPIScore.mockRejectedValue(new Error('Failed'));
      await expect(controller.getKPIScore('X')).rejects.toThrow(HttpException);
    });

    it('uses error.status if available', async () => {
      const err: any = new Error('Not found');
      err.status = 404;
      mockService.getKPIScore.mockRejectedValue(err);
      try {
        await controller.getKPIScore('X');
      } catch (e: any) {
        expect(e.getStatus()).toBe(404);
      }
    });

    it('defaults to 500 when error.message is empty', async () => {
      mockService.getKPIScore.mockRejectedValue(new Error(''));
      try {
        await controller.getKPIScore('X');
      } catch (e: any) {
        expect(e.message).toBe('Failed to calculate KPI score');
      }
    });
  });

  // ── runScreener ─────────────────────────────────────────────

  describe('runScreener (GET /screener)', () => {
    it('returns screener results on success', async () => {
      mockService.runScreener.mockResolvedValue([
        { ticker: 'AAPL', score: 80 },
      ]);
      const result = await controller.runScreener({});
      expect(result).toHaveLength(1);
      expect(result[0].ticker).toBe('AAPL');
    });

    it('throws HttpException on failure with 500', async () => {
      mockService.runScreener.mockRejectedValue(new Error('Screener failed'));
      try {
        await controller.runScreener({});
      } catch (e: any) {
        expect(e.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      }
    });

    it('uses error message in exception', async () => {
      mockService.runScreener.mockRejectedValue(new Error('Timeout'));
      try {
        await controller.runScreener({});
      } catch (e: any) {
        expect(e.message).toBe('Timeout');
      }
    });

    it('uses default message when error.message is empty', async () => {
      mockService.runScreener.mockRejectedValue(new Error(''));
      try {
        await controller.runScreener({});
      } catch (e: any) {
        expect(e.message).toBe('Failed to run screener');
      }
    });
  });

  // ── getCyclicalValuation ────────────────────────────────────

  describe('getCyclicalValuation (GET /cyclical/:ticker)', () => {
    it('calls getValuation with cyclical type', async () => {
      mockService.getValuation.mockResolvedValue({ fairValue: 50 });
      const result = await controller.getCyclicalValuation('CAT');
      expect(mockService.getValuation).toHaveBeenCalledWith({
        ticker: 'CAT',
        valuationType: 'cyclical',
      });
      expect(result.fairValue).toBe(50);
    });

    it('throws HttpException on failure', async () => {
      mockService.getValuation.mockRejectedValue(new Error('Engine failed'));
      await expect(controller.getCyclicalValuation('X')).rejects.toThrow(
        HttpException,
      );
    });
  });

  // ── getCompounderValuation ──────────────────────────────────

  describe('getCompounderValuation (GET /compounder/:ticker)', () => {
    it('calls getValuation with compounder type', async () => {
      mockService.getValuation.mockResolvedValue({ fairValue: 200 });
      await controller.getCompounderValuation('MSFT');
      expect(mockService.getValuation).toHaveBeenCalledWith({
        ticker: 'MSFT',
        valuationType: 'compounder',
      });
    });

    it('throws HttpException on failure', async () => {
      mockService.getValuation.mockRejectedValue(new Error('Error'));
      await expect(controller.getCompounderValuation('X')).rejects.toThrow(
        HttpException,
      );
    });
  });

  // ── getFrontierValuation ────────────────────────────────────

  describe('getFrontierValuation (GET /frontier/:ticker)', () => {
    it('calls getValuation with frontier type', async () => {
      mockService.getValuation.mockResolvedValue({
        probabilityWeightedValue: 300,
      });
      await controller.getFrontierValuation('PLTR');
      expect(mockService.getValuation).toHaveBeenCalledWith({
        ticker: 'PLTR',
        valuationType: 'frontier',
      });
    });

    it('throws HttpException on failure', async () => {
      mockService.getValuation.mockRejectedValue(new Error('Error'));
      await expect(controller.getFrontierValuation('X')).rejects.toThrow(
        HttpException,
      );
    });
  });
});
