import { ReceiptParserService, ParsedReceipt } from './receipt-parser.service';

describe('ReceiptParserService', () => {
  let service: ReceiptParserService;

  const mockLlmService = {
    analyzeImage: jest.fn(),
    categorize: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReceiptParserService(mockLlmService as any);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('parseReceipt', () => {
    it('should parse a receipt from LLM JSON response', async () => {
      mockLlmService.analyzeImage.mockResolvedValue(
        '```json\n{"merchantName":"Starbucks","transactionDate":"2024-06-15","amount":12.50,"currency":"USD","confidence":0.95}\n```',
      );
      mockLlmService.categorize.mockResolvedValue('Meals & Entertainment');

      const result = await service.parseReceipt('https://example.com/receipt.jpg');
      expect(result.merchantName).toBe('Starbucks');
      expect(result.amount).toBe(12.5);
      expect(result.category).toBe('Meals & Entertainment');
    });

    it('should throw when LLM returns unparseable response', async () => {
      mockLlmService.analyzeImage.mockResolvedValue('I cannot process this image');

      await expect(
        service.parseReceipt('https://example.com/bad.jpg'),
      ).rejects.toThrow('Failed to parse receipt');
    });
  });

  describe('checkPolicyViolations', () => {
    it('should flag expense over $1000', async () => {
      const receipt: ParsedReceipt = {
        merchantName: 'Expensive Restaurant',
        transactionDate: '2024-06-15',
        amount: 1500,
        currency: 'USD',
        category: 'Meals & Entertainment',
        confidence: 0.9,
      };

      mockLlmService.categorize.mockResolvedValue('NO');
      const violations = await service.checkPolicyViolations(receipt);
      expect(violations).toContain(
        'Expense exceeds $1,000 limit - requires manager approval',
      );
    });

    it('should flag meal expense over $100', async () => {
      const receipt: ParsedReceipt = {
        merchantName: 'Fancy Bistro',
        transactionDate: '2024-06-15',
        amount: 250,
        currency: 'USD',
        category: 'Meals & Entertainment',
        confidence: 0.9,
      };

      mockLlmService.categorize.mockResolvedValue('NO');
      const violations = await service.checkPolicyViolations(receipt);
      expect(violations).toContain(
        'Meal expense exceeds $100 per person policy',
      );
    });

    it('should return no violations for small office supply', async () => {
      const receipt: ParsedReceipt = {
        merchantName: 'Office Depot',
        transactionDate: '2024-06-15',
        amount: 25,
        currency: 'USD',
        category: 'Office Supplies',
        confidence: 0.95,
      };

      const violations = await service.checkPolicyViolations(receipt);
      expect(violations).toHaveLength(0);
    });
  });

  describe('checkDuplicate', () => {
    it('should detect duplicate receipt', async () => {
      const receipt: ParsedReceipt = {
        merchantName: 'Starbucks',
        transactionDate: '2024-06-15',
        amount: 12.5,
        currency: 'USD',
        category: 'Meals & Entertainment',
        confidence: 0.9,
      };

      const existing: ParsedReceipt[] = [
        {
          merchantName: 'Starbucks',
          transactionDate: '2024-06-15',
          amount: 12.5,
          currency: 'USD',
          category: 'Meals & Entertainment',
          confidence: 0.9,
        },
      ];

      const isDuplicate = await service.checkDuplicate(receipt, existing);
      expect(isDuplicate).toBe(true);
    });

    it('should not flag different receipts as duplicates', async () => {
      const receipt: ParsedReceipt = {
        merchantName: 'Starbucks',
        transactionDate: '2024-06-16',
        amount: 15.0,
        currency: 'USD',
        category: 'Meals & Entertainment',
        confidence: 0.9,
      };

      const existing: ParsedReceipt[] = [
        {
          merchantName: 'Starbucks',
          transactionDate: '2024-06-15',
          amount: 12.5,
          currency: 'USD',
          category: 'Meals & Entertainment',
          confidence: 0.9,
        },
      ];

      const isDuplicate = await service.checkDuplicate(receipt, existing);
      expect(isDuplicate).toBe(false);
    });
  });
});
