import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { PortfolioController } from './portfolio.controller';
import { PortfolioService } from './portfolio.service';
import { AuthGuard } from '../auth/auth.guard';

describe('PortfolioController', () => {
  let controller: PortfolioController;
  let portfolioService: Record<string, jest.Mock>;

  const mockReq = { user: { userId: 'user-1' } };

  beforeEach(async () => {
    portfolioService = {
      getUserPortfolios: jest.fn(),
      getPortfolio: jest.fn(),
      createPortfolio: jest.fn(),
      updatePortfolio: jest.fn(),
      deletePortfolio: jest.fn(),
      addPosition: jest.fn(),
      removePosition: jest.fn(),
      getPortfolioAnalytics: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PortfolioController],
      providers: [
        { provide: PortfolioService, useValue: portfolioService },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PortfolioController>(PortfolioController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getUserPortfolios', () => {
    it('should return user portfolios', async () => {
      const mockPortfolios = [{ id: 'p1', name: 'My Portfolio' }];
      portfolioService.getUserPortfolios.mockResolvedValue(mockPortfolios);

      const result = await controller.getUserPortfolios(mockReq);
      expect(result).toEqual(mockPortfolios);
      expect(portfolioService.getUserPortfolios).toHaveBeenCalledWith('user-1');
    });

    it('should throw HttpException on error', async () => {
      portfolioService.getUserPortfolios.mockRejectedValue(
        new Error('DB error'),
      );

      await expect(controller.getUserPortfolios(mockReq)).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('getPortfolio', () => {
    it('should return a specific portfolio', async () => {
      const mockPortfolio = { id: 'p1', name: 'My Portfolio' };
      portfolioService.getPortfolio.mockResolvedValue(mockPortfolio);

      const result = await controller.getPortfolio('p1', mockReq);
      expect(result).toEqual(mockPortfolio);
      expect(portfolioService.getPortfolio).toHaveBeenCalledWith(
        'p1',
        'user-1',
      );
    });

    it('should throw HttpException on error', async () => {
      portfolioService.getPortfolio.mockRejectedValue({
        message: 'Not found',
        status: 404,
      });

      await expect(controller.getPortfolio('bad', mockReq)).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('createPortfolio', () => {
    it('should create a portfolio', async () => {
      const createDto = { name: 'New Portfolio' };
      const mockPortfolio = { id: 'p2', name: 'New Portfolio' };
      portfolioService.createPortfolio.mockResolvedValue(mockPortfolio);

      const result = await controller.createPortfolio(mockReq, createDto as any);
      expect(result).toEqual(mockPortfolio);
      expect(portfolioService.createPortfolio).toHaveBeenCalledWith(
        'user-1',
        createDto,
      );
    });

    it('should throw HttpException on error', async () => {
      portfolioService.createPortfolio.mockRejectedValue(
        new Error('Validation error'),
      );

      await expect(
        controller.createPortfolio(mockReq, {} as any),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('updatePortfolio', () => {
    it('should update a portfolio', async () => {
      const updateDto = { name: 'Updated' };
      const mockPortfolio = { id: 'p1', name: 'Updated' };
      portfolioService.updatePortfolio.mockResolvedValue(mockPortfolio);

      const result = await controller.updatePortfolio(
        'p1',
        mockReq,
        updateDto as any,
      );
      expect(result).toEqual(mockPortfolio);
      expect(portfolioService.updatePortfolio).toHaveBeenCalledWith(
        'p1',
        'user-1',
        updateDto,
      );
    });

    it('should throw HttpException on error', async () => {
      portfolioService.updatePortfolio.mockRejectedValue(
        new Error('Update failed'),
      );

      await expect(
        controller.updatePortfolio('p1', mockReq, {} as any),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('deletePortfolio', () => {
    it('should delete a portfolio', async () => {
      portfolioService.deletePortfolio.mockResolvedValue(undefined);

      const result = await controller.deletePortfolio('p1', mockReq);
      expect(result).toEqual({
        message: 'Portfolio p1 deleted successfully',
      });
      expect(portfolioService.deletePortfolio).toHaveBeenCalledWith(
        'p1',
        'user-1',
      );
    });

    it('should throw HttpException on error', async () => {
      portfolioService.deletePortfolio.mockRejectedValue(
        new Error('Delete failed'),
      );

      await expect(
        controller.deletePortfolio('p1', mockReq),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('addPosition', () => {
    it('should add a position to portfolio', async () => {
      const addDto = { ticker: 'AAPL', quantity: 10, avgCost: 150 };
      const mockResult = { id: 'pos-1', ticker: 'AAPL' };
      portfolioService.addPosition.mockResolvedValue(mockResult);

      const result = await controller.addPosition('p1', mockReq, addDto as any);
      expect(result).toEqual(mockResult);
      expect(portfolioService.addPosition).toHaveBeenCalledWith(
        'p1',
        'user-1',
        addDto,
      );
    });

    it('should throw HttpException on error', async () => {
      portfolioService.addPosition.mockRejectedValue(
        new Error('Invalid position'),
      );

      await expect(
        controller.addPosition('p1', mockReq, {} as any),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('removePosition', () => {
    it('should remove a position from portfolio', async () => {
      portfolioService.removePosition.mockResolvedValue(undefined);

      const result = await controller.removePosition(
        'p1',
        'AAPL',
        mockReq,
        { quantity: 5, sellPrice: 155 },
      );
      expect(result).toEqual({
        message: 'Position AAPL updated successfully',
      });
      expect(portfolioService.removePosition).toHaveBeenCalledWith(
        'p1',
        'user-1',
        'AAPL',
        5,
        155,
      );
    });

    it('should throw HttpException on error', async () => {
      portfolioService.removePosition.mockRejectedValue(
        new Error('Remove failed'),
      );

      await expect(
        controller.removePosition('p1', 'AAPL', mockReq, {
          quantity: 5,
          sellPrice: 155,
        }),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('getPortfolioAnalytics', () => {
    it('should return portfolio analytics', async () => {
      const mockAnalytics = { totalValue: 10000, returns: 0.15 };
      portfolioService.getPortfolioAnalytics.mockResolvedValue(mockAnalytics);

      const result = await controller.getPortfolioAnalytics('p1', mockReq);
      expect(result).toEqual(mockAnalytics);
      expect(portfolioService.getPortfolioAnalytics).toHaveBeenCalledWith(
        'p1',
        'user-1',
      );
    });

    it('should throw HttpException on error', async () => {
      portfolioService.getPortfolioAnalytics.mockRejectedValue(
        new Error('Analytics failed'),
      );

      await expect(
        controller.getPortfolioAnalytics('p1', mockReq),
      ).rejects.toThrow(HttpException);
    });
  });
});
