import { NotFoundException } from '@nestjs/common';
import { PortfolioService } from './portfolio.service';

describe('PortfolioService', () => {
  let service: PortfolioService;
  const mockMarketDataService = {
    getQuote: jest.fn().mockResolvedValue({ price: 150 }),
  } as any;
  const mockPrisma = {
    portfolio: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    position: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  } as any;

  beforeEach(() => {
    service = new PortfolioService(mockMarketDataService, mockPrisma);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a portfolio', async () => {
    mockPrisma.portfolio.create.mockResolvedValue({
      id: 'p1',
      userId: 'u1',
      name: 'My Portfolio',
      description: null,
      currency: 'USD',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.createPortfolio('u1', {
      name: 'My Portfolio',
    });
    expect(result.id).toBe('p1');
    expect(result.name).toBe('My Portfolio');
  });

  it('should throw NotFoundException when getting missing portfolio', async () => {
    mockPrisma.portfolio.findUnique.mockResolvedValue(null);
    await expect(service.getPortfolio('missing', 'u1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw NotFoundException for wrong user', async () => {
    mockPrisma.portfolio.findUnique.mockResolvedValue({
      id: 'p1',
      userId: 'other-user',
      positions: [],
    });
    await expect(service.getPortfolio('p1', 'u1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should add a new position to portfolio', async () => {
    mockPrisma.portfolio.findUnique.mockResolvedValue({
      id: 'p1',
      userId: 'u1',
    });
    mockPrisma.position.findUnique.mockResolvedValue(null);
    mockPrisma.position.create.mockResolvedValue({
      id: 'pos-1',
      portfolioId: 'p1',
      ticker: 'AAPL',
      quantity: 10,
      avgCost: 150,
      addedAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await service.addPosition('p1', 'u1', {
      ticker: 'AAPL',
      quantity: 10,
      price: 150,
    });
    expect(result.ticker).toBe('AAPL');
    expect(result.quantity).toBe(10);
  });

  it('should delete portfolio for correct user', async () => {
    mockPrisma.portfolio.findUnique.mockResolvedValue({
      id: 'p1',
      userId: 'u1',
    });
    mockPrisma.portfolio.delete.mockResolvedValue({});
    await expect(service.deletePortfolio('p1', 'u1')).resolves.not.toThrow();
  });

  // ── addPosition — upsert behavior ─────────────────────────
  describe('addPosition', () => {
    it('updates existing position with weighted average cost', async () => {
      mockPrisma.portfolio.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'u1',
      });
      mockPrisma.position.findUnique.mockResolvedValue({
        id: 'pos-1',
        portfolioId: 'p1',
        ticker: 'AAPL',
        quantity: 10,
        avgCost: 100,
      });
      mockPrisma.position.update.mockResolvedValue({
        id: 'pos-1',
        portfolioId: 'p1',
        ticker: 'AAPL',
        quantity: 20,
        avgCost: 125,
        addedAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.addPosition('p1', 'u1', {
        ticker: 'AAPL',
        quantity: 10,
        price: 150,
      });
      expect(result.quantity).toBe(20);
      // avgCost should be (100*10 + 150*10) / 20 = 125
      expect(mockPrisma.position.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            quantity: 20,
            avgCost: 125,
          }),
        }),
      );
    });

    it('throws NotFoundException when portfolio belongs to different user', async () => {
      mockPrisma.portfolio.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'other-user',
      });
      await expect(
        service.addPosition('p1', 'u1', {
          ticker: 'AAPL',
          quantity: 5,
          price: 150,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── getPortfolio — enriched with market data ──────────────
  describe('getPortfolio', () => {
    it('enriches positions with current market price', async () => {
      mockPrisma.portfolio.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'u1',
        name: 'Test',
        description: null,
        currency: 'USD',
        createdAt: new Date(),
        updatedAt: new Date(),
        positions: [
          {
            id: 'pos-1',
            portfolioId: 'p1',
            ticker: 'AAPL',
            quantity: 10,
            avgCost: 100,
            addedAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      });
      mockMarketDataService.getQuote.mockResolvedValue({ price: 200 });

      const result = await service.getPortfolio('p1', 'u1');
      expect(result.positions![0].currentPrice).toBe(200);
      expect(result.positions![0].marketValue).toBe(2000);
      expect(result.positions![0].unrealizedPnL).toBe(1000); // (200-100)*10
    });

    it('calculates totalPnL across all positions', async () => {
      mockPrisma.portfolio.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'u1',
        name: 'Multi',
        description: null,
        currency: 'USD',
        createdAt: new Date(),
        updatedAt: new Date(),
        positions: [
          {
            id: 'pos-1',
            portfolioId: 'p1',
            ticker: 'AAPL',
            quantity: 10,
            avgCost: 100,
            addedAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'pos-2',
            portfolioId: 'p1',
            ticker: 'MSFT',
            quantity: 5,
            avgCost: 200,
            addedAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      });
      mockMarketDataService.getQuote.mockResolvedValue({ price: 150 });

      const result = await service.getPortfolio('p1', 'u1');
      // AAPL: (150-100)*10 = 500 gain, MSFT: (150-200)*5 = -250 loss
      // totalValue = cash + positions
      expect(result.totalValue).toBeGreaterThan(0);
      expect(result.positions).toHaveLength(2);
    });
  });

  // ── deletePortfolio — wrong user ──────────────────────────
  it('throws NotFoundException when deleting portfolio of another user', async () => {
    mockPrisma.portfolio.findUnique.mockResolvedValue({
      id: 'p1',
      userId: 'other-user',
    });
    await expect(service.deletePortfolio('p1', 'u1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('throws NotFoundException when deleting non-existent portfolio', async () => {
    mockPrisma.portfolio.findUnique.mockResolvedValue(null);
    await expect(service.deletePortfolio('missing', 'u1')).rejects.toThrow(
      NotFoundException,
    );
  });

  // ── getUserPortfolios ──────────────────────────────
  describe('getUserPortfolios', () => {
    it('returns enriched portfolios for user', async () => {
      mockPrisma.portfolio.findMany.mockResolvedValue([
        {
          id: 'p1',
          userId: 'u1',
          name: 'Test',
          description: null,
          currency: 'USD',
          createdAt: new Date(),
          updatedAt: new Date(),
          positions: [
            {
              id: 'pos-1',
              portfolioId: 'p1',
              ticker: 'AAPL',
              quantity: 10,
              avgCost: 100,
              addedAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        },
      ]);
      mockMarketDataService.getQuote.mockResolvedValue({ price: 150 });

      const result = await service.getUserPortfolios('u1');
      expect(result).toHaveLength(1);
      expect(result[0].positions![0].currentPrice).toBe(150);
    });

    it('returns empty array when user has no portfolios', async () => {
      mockPrisma.portfolio.findMany.mockResolvedValue([]);
      const result = await service.getUserPortfolios('u1');
      expect(result).toEqual([]);
    });
  });

  // ── updatePortfolio ────────────────────────────────
  describe('updatePortfolio', () => {
    it('updates portfolio metadata', async () => {
      mockPrisma.portfolio.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'u1',
      });
      mockPrisma.portfolio.update.mockResolvedValue({
        id: 'p1',
        userId: 'u1',
        name: 'Updated',
        description: 'desc',
        currency: 'USD',
        createdAt: new Date(),
        updatedAt: new Date(),
        positions: [],
      });

      const result = await service.updatePortfolio('p1', 'u1', {
        name: 'Updated',
        description: 'desc',
      });
      expect(result.name).toBe('Updated');
    });

    it('throws NotFoundException for wrong user on update', async () => {
      mockPrisma.portfolio.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'other-user',
      });
      await expect(
        service.updatePortfolio('p1', 'u1', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException for non-existent portfolio on update', async () => {
      mockPrisma.portfolio.findUnique.mockResolvedValue(null);
      await expect(
        service.updatePortfolio('missing', 'u1', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── removePosition ─────────────────────────────────
  describe('removePosition', () => {
    it('deletes position when selling entire quantity', async () => {
      mockPrisma.portfolio.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'u1',
      });
      mockPrisma.position.findUnique.mockResolvedValue({
        id: 'pos-1',
        quantity: 10,
      });
      mockPrisma.position.delete.mockResolvedValue({});

      await service.removePosition('p1', 'u1', 'AAPL', 10, 150);
      expect(mockPrisma.position.delete).toHaveBeenCalledWith({
        where: { id: 'pos-1' },
      });
    });

    it('reduces quantity when partially selling', async () => {
      mockPrisma.portfolio.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'u1',
      });
      mockPrisma.position.findUnique.mockResolvedValue({
        id: 'pos-1',
        quantity: 10,
      });
      mockPrisma.position.update.mockResolvedValue({});

      await service.removePosition('p1', 'u1', 'AAPL', 3, 150);
      expect(mockPrisma.position.update).toHaveBeenCalledWith({
        where: { id: 'pos-1' },
        data: { quantity: 7 },
      });
    });

    it('throws NotFoundException when position not found', async () => {
      mockPrisma.portfolio.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'u1',
      });
      mockPrisma.position.findUnique.mockResolvedValue(null);
      await expect(
        service.removePosition('p1', 'u1', 'UNKNOWN', 5, 100),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when portfolio belongs to different user', async () => {
      mockPrisma.portfolio.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'other-user',
      });
      await expect(
        service.removePosition('p1', 'u1', 'AAPL', 5, 100),
      ).rejects.toThrow(NotFoundException);
    });

    it('deletes position when selling more than current quantity', async () => {
      mockPrisma.portfolio.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'u1',
      });
      mockPrisma.position.findUnique.mockResolvedValue({
        id: 'pos-1',
        quantity: 5,
      });
      mockPrisma.position.delete.mockResolvedValue({});

      await service.removePosition('p1', 'u1', 'AAPL', 100, 150);
      expect(mockPrisma.position.delete).toHaveBeenCalled();
    });
  });

  // ── getPortfolioAnalytics ──────────────────────────
  describe('getPortfolioAnalytics', () => {
    it('returns analytics with best/worst performers', async () => {
      mockPrisma.portfolio.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'u1',
        name: 'Analytics',
        description: null,
        currency: 'USD',
        createdAt: new Date(),
        updatedAt: new Date(),
        positions: [
          {
            id: 'pos-1',
            portfolioId: 'p1',
            ticker: 'AAPL',
            quantity: 10,
            avgCost: 100,
            addedAt: new Date(),
            updatedAt: new Date(),
          },
          {
            id: 'pos-2',
            portfolioId: 'p1',
            ticker: 'MSFT',
            quantity: 5,
            avgCost: 300,
            addedAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      });
      mockMarketDataService.getQuote
        .mockResolvedValueOnce({ price: 150 }) // AAPL up 50%
        .mockResolvedValueOnce({ price: 200 }); // MSFT down 33%

      const result = await service.getPortfolioAnalytics('p1', 'u1');
      expect(result.portfolioId).toBe('p1');
      expect(result.bestPerformer.ticker).toBeDefined();
      expect(result.worstPerformer.ticker).toBeDefined();
      expect(result.winRate).toBeGreaterThanOrEqual(0);
    });

    it('handles portfolio with no positions', async () => {
      mockPrisma.portfolio.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'u1',
        name: 'Empty',
        description: null,
        currency: 'USD',
        createdAt: new Date(),
        updatedAt: new Date(),
        positions: [],
      });

      const result = await service.getPortfolioAnalytics('p1', 'u1');
      expect(result.totalReturn).toBe(0);
      expect(result.bestPerformer.ticker).toBe('N/A');
    });
  });

  // ── updatePortfolioValues handles quote failure ────
  describe('updatePortfolioValues edge cases', () => {
    it('falls back to avgCost when getQuote returns null', async () => {
      mockPrisma.portfolio.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'u1',
        name: 'NoQuote',
        description: null,
        currency: 'USD',
        createdAt: new Date(),
        updatedAt: new Date(),
        positions: [
          {
            id: 'pos-1',
            portfolioId: 'p1',
            ticker: 'FAIL',
            quantity: 10,
            avgCost: 100,
            addedAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      });
      mockMarketDataService.getQuote.mockResolvedValue(null);

      const result = await service.getPortfolio('p1', 'u1');
      expect(result.positions![0].currentPrice).toBe(100); // falls back to avgCost
    });

    it('handles getQuote throwing an error', async () => {
      mockPrisma.portfolio.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'u1',
        name: 'Error',
        description: null,
        currency: 'USD',
        createdAt: new Date(),
        updatedAt: new Date(),
        positions: [
          {
            id: 'pos-1',
            portfolioId: 'p1',
            ticker: 'ERR',
            quantity: 10,
            avgCost: 50,
            addedAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      });
      mockMarketDataService.getQuote.mockRejectedValue(new Error('API down'));

      const result = await service.getPortfolio('p1', 'u1');
      // Should not throw, position value defaults
      expect(result.positions).toHaveLength(1);
    });
  });
});
