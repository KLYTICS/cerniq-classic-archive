import { Test, TestingModule } from '@nestjs/testing';
import { ExpensesService } from './expenses.service';
import { PrismaService } from '../prisma.service';
import { ReceiptParserService } from '../llm/receipt-parser.service';
import { StorageService } from '../storage/storage.service';

describe('ExpensesService', () => {
  let service: ExpensesService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      expense: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      organizationMember: {
        findUnique: jest.fn(),
      },
    };

    const receiptParser = {
      parseReceipt: jest.fn(),
      checkPolicyViolations: jest.fn(),
      detectDuplicates: jest.fn(),
    };

    const storage = {
      getDownloadUrl: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExpensesService,
        { provide: PrismaService, useValue: prisma },
        { provide: ReceiptParserService, useValue: receiptParser },
        { provide: StorageService, useValue: storage },
      ],
    }).compile();

    service = module.get<ExpensesService>(ExpensesService);
  });

  describe('create', () => {
    it('should create an expense', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({
        id: '1',
        role: 'MEMBER',
      });
      prisma.expense.create.mockResolvedValue({
        id: 'exp-1',
        merchantName: 'Starbucks',
        amount: 12.5,
        status: 'DRAFT',
      });

      const result = await service.create('org-1', 'user-1', {
        merchantName: 'Starbucks',
        amount: 12.5,
        transactionDate: new Date().toISOString(),
      } as any);

      expect(result.merchantName).toBe('Starbucks');
      expect(prisma.expense.create).toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return expenses for organization', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({
        id: '1',
        role: 'MEMBER',
      });
      prisma.expense.findMany.mockResolvedValue([
        { id: 'exp-1', merchantName: 'Amazon', amount: 50 },
        { id: 'exp-2', merchantName: 'Uber', amount: 25 },
      ]);

      const result = await service.findAll('org-1', 'user-1');

      expect(result).toHaveLength(2);
    });

    it('should filter by status', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({
        id: '1',
        role: 'ADMIN',
      });
      prisma.expense.findMany.mockResolvedValue([
        { id: 'exp-1', status: 'SUBMITTED' },
      ]);

      const result = await service.findAll('org-1', 'user-1', 'SUBMITTED');

      expect(result).toHaveLength(1);
    });
  });

  describe('submit', () => {
    it('should submit a draft expense', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({
        id: '1',
        role: 'MEMBER',
      });
      prisma.expense.findFirst.mockResolvedValue({
        id: 'exp-1',
        userId: 'user-1',
        status: 'DRAFT',
      });
      prisma.expense.update.mockResolvedValue({
        id: 'exp-1',
        status: 'SUBMITTED',
      });

      const result = await service.submit('exp-1', 'org-1', 'user-1');

      expect(result.status).toBe('SUBMITTED');
    });
  });

  describe('approve', () => {
    it('should approve a submitted expense (admin only)', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({
        id: '1',
        role: 'ADMIN',
      });
      prisma.expense.findFirst.mockResolvedValue({
        id: 'exp-1',
        status: 'SUBMITTED',
      });
      prisma.expense.update.mockResolvedValue({
        id: 'exp-1',
        status: 'APPROVED',
        approvedBy: 'admin-1',
      });

      const result = await service.approve('exp-1', 'org-1', 'admin-1');

      expect(result.status).toBe('APPROVED');
    });
  });

  describe('reject', () => {
    it('should reject a submitted expense (admin only)', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({
        id: '1',
        role: 'ADMIN',
      });
      prisma.expense.findFirst.mockResolvedValue({
        id: 'exp-1',
        status: 'SUBMITTED',
      });
      prisma.expense.update.mockResolvedValue({
        id: 'exp-1',
        status: 'REJECTED',
      });

      const result = await service.reject('exp-1', 'org-1', 'admin-1');

      expect(result.status).toBe('REJECTED');
    });

    it('should throw ForbiddenException if expense is not SUBMITTED', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({
        id: '1',
        role: 'ADMIN',
      });
      prisma.expense.findFirst.mockResolvedValue({
        id: 'exp-1',
        status: 'DRAFT',
      });

      await expect(service.reject('exp-1', 'org-1', 'admin-1')).rejects.toThrow(
        'Only submitted expenses can be rejected',
      );
    });

    it('should throw ForbiddenException when non-admin tries to reject', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({
        id: '1',
        role: 'MEMBER',
      });

      await expect(service.reject('exp-1', 'org-1', 'user-1')).rejects.toThrow(
        'Only admins can perform this action',
      );
    });
  });

  // ── findOne ──────────────────────────────────────────────────
  describe('findOne', () => {
    it('should return an expense when found', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({
        id: '1',
        role: 'MEMBER',
      });
      prisma.expense.findFirst.mockResolvedValue({
        id: 'exp-1',
        merchantName: 'Test',
        amount: 50,
      });

      const result = await service.findOne('exp-1', 'org-1', 'user-1');
      expect(result.id).toBe('exp-1');
    });

    it('should throw NotFoundException when expense not found', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({
        id: '1',
        role: 'MEMBER',
      });
      prisma.expense.findFirst.mockResolvedValue(null);

      await expect(
        service.findOne('exp-999', 'org-1', 'user-1'),
      ).rejects.toThrow('Expense not found');
    });
  });

  // ── update ───────────────────────────────────────────────────
  describe('update', () => {
    it('should update a draft expense by its owner', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({
        id: '1',
        role: 'MEMBER',
      });
      prisma.expense.findFirst.mockResolvedValue({
        id: 'exp-1',
        userId: 'user-1',
        status: 'DRAFT',
      });
      prisma.expense.update.mockResolvedValue({
        id: 'exp-1',
        merchantName: 'Updated',
        amount: 25,
      });

      const result = await service.update('exp-1', 'org-1', 'user-1', {
        merchantName: 'Updated',
        amount: 25,
      });
      expect(result.merchantName).toBe('Updated');
    });

    it('should throw ForbiddenException when non-owner edits non-DRAFT expense', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({
        id: '1',
        role: 'MEMBER',
      });
      prisma.expense.findFirst.mockResolvedValue({
        id: 'exp-1',
        userId: 'other-user',
        status: 'SUBMITTED',
      });

      await expect(
        service.update('exp-1', 'org-1', 'user-1', { amount: 100 }),
      ).rejects.toThrow('You can only edit your own draft expenses');
    });

    it('should include transactionDate conversion when provided', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({
        id: '1',
        role: 'MEMBER',
      });
      prisma.expense.findFirst.mockResolvedValue({
        id: 'exp-1',
        userId: 'user-1',
        status: 'DRAFT',
      });
      prisma.expense.update.mockResolvedValue({ id: 'exp-1' });

      await service.update('exp-1', 'org-1', 'user-1', {
        transactionDate: '2025-06-15',
      });
      const updateCall = prisma.expense.update.mock.calls[0][0];
      expect(updateCall.data.transactionDate).toBeInstanceOf(Date);
    });
  });

  // ── submit error paths ───────────────────────────────────────
  describe('submit error paths', () => {
    it('should throw ForbiddenException when non-owner submits', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({
        id: '1',
        role: 'MEMBER',
      });
      prisma.expense.findFirst.mockResolvedValue({
        id: 'exp-1',
        userId: 'other-user',
        status: 'DRAFT',
      });

      await expect(service.submit('exp-1', 'org-1', 'user-1')).rejects.toThrow(
        'You can only submit your own expenses',
      );
    });

    it('should throw ForbiddenException when expense is not DRAFT', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({
        id: '1',
        role: 'MEMBER',
      });
      prisma.expense.findFirst.mockResolvedValue({
        id: 'exp-1',
        userId: 'user-1',
        status: 'APPROVED',
      });

      await expect(service.submit('exp-1', 'org-1', 'user-1')).rejects.toThrow(
        'Only draft expenses can be submitted',
      );
    });
  });

  // ── approve error paths ──────────────────────────────────────
  describe('approve error paths', () => {
    it('should throw ForbiddenException if expense is not SUBMITTED', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({
        id: '1',
        role: 'ADMIN',
      });
      prisma.expense.findFirst.mockResolvedValue({
        id: 'exp-1',
        status: 'DRAFT',
      });

      await expect(
        service.approve('exp-1', 'org-1', 'admin-1'),
      ).rejects.toThrow('Only submitted expenses can be approved');
    });

    it('should throw ForbiddenException for non-admin approve', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({
        id: '1',
        role: 'MEMBER',
      });

      await expect(service.approve('exp-1', 'org-1', 'user-1')).rejects.toThrow(
        'Only admins can perform this action',
      );
    });
  });

  // ── remove ───────────────────────────────────────────────────
  describe('remove', () => {
    it('should allow owner to delete their expense', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({
        id: '1',
        role: 'MEMBER',
      });
      prisma.expense.findFirst.mockResolvedValue({
        id: 'exp-1',
        userId: 'user-1',
        status: 'DRAFT',
      });
      prisma.expense.delete.mockResolvedValue({});

      const result = await service.remove('exp-1', 'org-1', 'user-1');
      expect(result.message).toBe('Expense deleted successfully');
    });

    it('should allow admin to delete any expense', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({
        id: '1',
        role: 'ADMIN',
      });
      prisma.expense.findFirst.mockResolvedValue({
        id: 'exp-1',
        userId: 'other-user',
        status: 'DRAFT',
      });
      prisma.expense.delete.mockResolvedValue({});

      const result = await service.remove('exp-1', 'org-1', 'admin-1');
      expect(result.message).toBe('Expense deleted successfully');
    });

    it('should throw ForbiddenException when non-owner non-admin tries to delete', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({
        id: '1',
        role: 'MEMBER',
      });
      prisma.expense.findFirst.mockResolvedValue({
        id: 'exp-1',
        userId: 'other-user',
        status: 'DRAFT',
      });

      await expect(service.remove('exp-1', 'org-1', 'user-1')).rejects.toThrow(
        'You can only delete your own expenses or be an admin',
      );
    });
  });

  // ── findAll with no status filter ────────────────────────────
  describe('findAll without status', () => {
    it('should return all expenses without status filter', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({
        id: '1',
        role: 'MEMBER',
      });
      prisma.expense.findMany.mockResolvedValue([
        { id: 'exp-1', status: 'DRAFT' },
        { id: 'exp-2', status: 'APPROVED' },
      ]);

      const result = await service.findAll('org-1', 'user-1');
      expect(result).toHaveLength(2);
    });
  });

  // ── verifyMembership ─────────────────────────────────────────
  describe('membership verification', () => {
    it('should throw ForbiddenException when user is not a member', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue(null);

      await expect(service.findAll('org-1', 'non-member')).rejects.toThrow(
        'You are not a member of this organization',
      );
    });
  });

  // ── processReceipt ───────────────────────────────────────────
  describe('processReceipt', () => {
    it('should parse receipt, check violations, and create expense', async () => {
      const receiptParser = (service as any).receiptParser;
      receiptParser.parseReceipt = jest.fn().mockResolvedValue({
        merchantName: 'Office Depot',
        amount: 45.99,
        currency: 'USD',
        category: 'Office Supplies',
        transactionDate: '2025-06-01',
        confidence: 0.95,
      });
      receiptParser.checkPolicyViolations = jest.fn().mockResolvedValue([]);
      receiptParser.checkDuplicate = jest.fn().mockResolvedValue(false);

      prisma.expense.findMany.mockResolvedValue([]);
      prisma.expense.create.mockResolvedValue({
        id: 'exp-new',
        merchantName: 'Office Depot',
        amount: 45.99,
        status: 'DRAFT',
        aiExtracted: true,
        user: { id: 'user-1', email: 'test@test.com', name: 'Test' },
      });

      const result = await service.processReceipt('org-1', 'user-1', {
        receiptUrl: 'https://example.com/receipt.pdf',
      });

      expect(result.expense.merchantName).toBe('Office Depot');
      expect(result.parsed.amount).toBe(45.99);
      expect(result.warnings.isDuplicate).toBe(false);
      expect(result.warnings.policyViolations).toEqual([]);
    });
  });
});
