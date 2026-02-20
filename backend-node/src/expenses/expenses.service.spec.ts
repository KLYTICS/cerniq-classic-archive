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
            prisma.organizationMember.findUnique.mockResolvedValue({ id: '1', role: 'MEMBER' });
            prisma.expense.create.mockResolvedValue({
                id: 'exp-1',
                merchantName: 'Starbucks',
                amount: 12.50,
                status: 'DRAFT',
            });

            const result = await service.create({
                organizationId: 'org-1',
                userId: 'user-1',
                merchantName: 'Starbucks',
                amount: 12.50,
                transactionDate: new Date(),
            });

            expect(result.merchantName).toBe('Starbucks');
            expect(prisma.expense.create).toHaveBeenCalled();
        });
    });

    describe('findAll', () => {
        it('should return expenses for organization', async () => {
            prisma.organizationMember.findUnique.mockResolvedValue({ id: '1', role: 'MEMBER' });
            prisma.expense.findMany.mockResolvedValue([
                { id: 'exp-1', merchantName: 'Amazon', amount: 50 },
                { id: 'exp-2', merchantName: 'Uber', amount: 25 },
            ]);

            const result = await service.findAll('org-1', 'user-1');

            expect(result).toHaveLength(2);
        });

        it('should filter by status', async () => {
            prisma.organizationMember.findUnique.mockResolvedValue({ id: '1', role: 'ADMIN' });
            prisma.expense.findMany.mockResolvedValue([
                { id: 'exp-1', status: 'SUBMITTED' },
            ]);

            const result = await service.findAll('org-1', 'user-1', 'SUBMITTED');

            expect(result).toHaveLength(1);
        });
    });

    describe('submit', () => {
        it('should submit a draft expense', async () => {
            prisma.organizationMember.findUnique.mockResolvedValue({ id: '1', role: 'MEMBER' });
            prisma.expense.findUnique.mockResolvedValue({
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
            prisma.organizationMember.findUnique.mockResolvedValue({ id: '1', role: 'ADMIN' });
            prisma.expense.findUnique.mockResolvedValue({
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
            prisma.organizationMember.findUnique.mockResolvedValue({ id: '1', role: 'ADMIN' });
            prisma.expense.findUnique.mockResolvedValue({
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
    });
});
