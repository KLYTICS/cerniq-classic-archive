import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';
import { AnomalyDetectionService } from './anomaly-detection.service';
import { ApReportService } from './ap-report.service';
import { VendorIntelligenceService } from './vendor-intelligence/vendor-intelligence.service';
import { ExpenseIngestionService } from './expense-ingestion.service';
import { PrismaService } from '../prisma.service';
import { AuthGuard } from '../auth/auth.guard';

describe('ExpensesController', () => {
  let controller: ExpensesController;

  const mockExpensesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    submit: jest.fn(),
    approve: jest.fn(),
    reject: jest.fn(),
    remove: jest.fn(),
    processReceipt: jest.fn(),
  };

  const mockAnomalyDetection = { analyzeOrganization: jest.fn(), calculateApLcrImpact: jest.fn() };
  const mockApReport = { generateAPReport: jest.fn() };
  const mockVendorIntel = { generateVendorReport: jest.fn() };
  const mockIngestion = { parseExpenseCSV: jest.fn() };
  const mockPrisma = {
    organizationMember: { findUnique: jest.fn(), findFirst: jest.fn() },
    organization: { create: jest.fn() },
    expense: { create: jest.fn(), findMany: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExpensesController],
      providers: [
        { provide: ExpensesService, useValue: mockExpensesService },
        { provide: AnomalyDetectionService, useValue: mockAnomalyDetection },
        { provide: ApReportService, useValue: mockApReport },
        { provide: VendorIntelligenceService, useValue: mockVendorIntel },
        { provide: ExpenseIngestionService, useValue: mockIngestion },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ExpensesController>(ExpensesController);
    jest.clearAllMocks();
  });

  it('findAll delegates to ExpensesService with org context', async () => {
    const req = { headers: { 'x-organization-id': 'org-123' }, user: { userId: 'u1' } };
    mockExpensesService.findAll.mockResolvedValue([{ id: 'e1' }]);

    const result = await controller.findAll(undefined as any, req);

    expect(result).toEqual([{ id: 'e1' }]);
    expect(mockExpensesService.findAll).toHaveBeenCalledWith('org-123', 'u1', undefined);
  });

  it('create delegates to ExpensesService', async () => {
    const req = { headers: { 'x-organization-id': 'org-123' }, user: { userId: 'u1' } };
    const dto = { merchantName: 'Vendor A', amount: 100, transactionDate: '2026-01-01' };
    mockExpensesService.create.mockResolvedValue({ id: 'new-expense' });

    const result = await controller.create(dto, req);

    expect(result).toEqual({ id: 'new-expense' });
    expect(mockExpensesService.create).toHaveBeenCalledWith('org-123', 'u1', dto);
  });

  it('throws BadRequestException when x-organization-id header is missing and no orgId on user', () => {
    const req = { headers: {}, user: { userId: 'u1' } };

    expect(() => controller.findAll(undefined as any, req)).toThrow(BadRequestException);
  });
});
