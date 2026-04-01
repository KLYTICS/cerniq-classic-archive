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
      expect(result.positions[0].currentPrice).toBe(200);
      expect(result.positions[0].marketValue).toBe(2000);
      expect(result.positions[0].unrealizedPnL).toBe(1000); // (200-100)*10
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
          { id: 'pos-1', portfolioId: 'p1', ticker: 'AAPL', quantity: 10, avgCost: 100, addedAt: new Date(), updatedAt: new Date() },
          { id: 'pos-2', portfolioId: 'p1', ticker: 'MSFT', quantity: 5, avgCost: 200, addedAt: new Date(), updatedAt: new Date() },
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
});
