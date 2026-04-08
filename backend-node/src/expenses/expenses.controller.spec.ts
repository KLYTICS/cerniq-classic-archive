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

  const mockAnomalyDetection = {
    analyzeOrganization: jest.fn(),
    calculateApLcrImpact: jest.fn(),
  };
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
    const req = {
      headers: { 'x-organization-id': 'org-123' },
      user: { userId: 'u1' },
    };
    mockExpensesService.findAll.mockResolvedValue([{ id: 'e1' }]);

    const result = await controller.findAll(undefined as any, req);

    expect(result).toEqual([{ id: 'e1' }]);
    expect(mockExpensesService.findAll).toHaveBeenCalledWith(
      'org-123',
      'u1',
      undefined,
    );
  });

  it('create delegates to ExpensesService', async () => {
    const req = {
      headers: { 'x-organization-id': 'org-123' },
      user: { userId: 'u1' },
    };
    const dto = {
      merchantName: 'Vendor A',
      amount: 100,
      transactionDate: '2026-01-01',
    };
    mockExpensesService.create.mockResolvedValue({ id: 'new-expense' });

    const result = await controller.create(dto, req);

    expect(result).toEqual({ id: 'new-expense' });
    expect(mockExpensesService.create).toHaveBeenCalledWith(
      'org-123',
      'u1',
      dto,
    );
  });

  it('throws BadRequestException when x-organization-id header is missing and no orgId on user', () => {
    const req = { headers: {}, user: { userId: 'u1' } };

    expect(() => controller.findAll(undefined as any, req)).toThrow(
      BadRequestException,
    );
  });

  // ── findOne ──────────────────────────────────────────────────────────
  it('findOne delegates to ExpensesService', async () => {
    const req = {
      headers: { 'x-organization-id': 'org-1' },
      user: { userId: 'u1' },
    };
    mockExpensesService.findOne.mockResolvedValue({ id: 'e1', amount: 50 });

    const result = await controller.findOne('e1', req);

    expect(result).toEqual({ id: 'e1', amount: 50 });
    expect(mockExpensesService.findOne).toHaveBeenCalledWith(
      'e1',
      'org-1',
      'u1',
    );
  });

  // ── update ───────────────────────────────────────────────────────────
  it('update delegates to ExpensesService', async () => {
    const req = {
      headers: { 'x-organization-id': 'org-1' },
      user: { userId: 'u1' },
    };
    const dto = { amount: 200 };
    mockExpensesService.update.mockResolvedValue({ id: 'e1', amount: 200 });

    const result = await controller.update('e1', dto, req);

    expect(result).toEqual({ id: 'e1', amount: 200 });
    expect(mockExpensesService.update).toHaveBeenCalledWith(
      'e1',
      'org-1',
      'u1',
      dto,
    );
  });

  // ── submit ───────────────────────────────────────────────────────────
  it('submit delegates to ExpensesService', async () => {
    const req = {
      headers: { 'x-organization-id': 'org-1' },
      user: { userId: 'u1' },
    };
    mockExpensesService.submit.mockResolvedValue({
      id: 'e1',
      status: 'SUBMITTED',
    });

    const result = await controller.submit('e1', req);

    expect(result).toEqual({ id: 'e1', status: 'SUBMITTED' });
    expect(mockExpensesService.submit).toHaveBeenCalledWith(
      'e1',
      'org-1',
      'u1',
    );
  });

  // ── approve ──────────────────────────────────────────────────────────
  it('approve delegates to ExpensesService', async () => {
    const req = {
      headers: { 'x-organization-id': 'org-1' },
      user: { userId: 'u1' },
    };
    mockExpensesService.approve.mockResolvedValue({
      id: 'e1',
      status: 'APPROVED',
    });

    const result = await controller.approve('e1', req);

    expect(result).toEqual({ id: 'e1', status: 'APPROVED' });
    expect(mockExpensesService.approve).toHaveBeenCalledWith(
      'e1',
      'org-1',
      'u1',
    );
  });

  // ── reject ───────────────────────────────────────────────────────────
  it('reject delegates to ExpensesService', async () => {
    const req = {
      headers: { 'x-organization-id': 'org-1' },
      user: { userId: 'u1' },
    };
    mockExpensesService.reject.mockResolvedValue({
      id: 'e1',
      status: 'REJECTED',
    });

    const result = await controller.reject('e1', req);

    expect(result).toEqual({ id: 'e1', status: 'REJECTED' });
    expect(mockExpensesService.reject).toHaveBeenCalledWith(
      'e1',
      'org-1',
      'u1',
    );
  });

  // ── remove ───────────────────────────────────────────────────────────
  it('remove delegates to ExpensesService', async () => {
    const req = {
      headers: { 'x-organization-id': 'org-1' },
      user: { userId: 'u1' },
    };
    mockExpensesService.remove.mockResolvedValue({ deleted: true });

    const result = await controller.remove('e1', req);

    expect(result).toEqual({ deleted: true });
    expect(mockExpensesService.remove).toHaveBeenCalledWith(
      'e1',
      'org-1',
      'u1',
    );
  });

  // ── processReceipt ───────────────────────────────────────────────────
  it('processReceipt delegates to ExpensesService with resolved org', async () => {
    const req = {
      headers: { 'x-organization-id': 'org-1' },
      user: { userId: 'u1' },
    };
    const dto = { receiptUrl: 'https://example.com/receipt.jpg' };
    mockExpensesService.processReceipt.mockResolvedValue({
      id: 'e1',
      aiExtracted: true,
    });

    const result = await controller.processReceipt(dto, req);

    expect(result).toEqual({ id: 'e1', aiExtracted: true });
    expect(mockExpensesService.processReceipt).toHaveBeenCalledWith(
      'org-1',
      'u1',
      dto,
    );
  });

  // ── analyzeOrganization ──────────────────────────────────────────────
  it('analyzeOrganization verifies membership then delegates', async () => {
    const req = { user: { userId: 'u1' } };
    mockPrisma.organizationMember.findUnique.mockResolvedValue({
      userId: 'u1',
      organizationId: 'org-1',
    });
    mockAnomalyDetection.analyzeOrganization.mockResolvedValue({
      anomalies: [],
    });

    const result = await controller.analyzeOrganization('org-1', req);

    expect(mockPrisma.organizationMember.findUnique).toHaveBeenCalled();
    expect(result).toEqual({ anomalies: [] });
  });

  it('analyzeOrganization throws when user is not a member', async () => {
    const req = { user: { userId: 'u1' } };
    mockPrisma.organizationMember.findUnique.mockResolvedValue(null);

    await expect(controller.analyzeOrganization('org-1', req)).rejects.toThrow(
      BadRequestException,
    );
  });

  // ── getVendorReport ──────────────────────────────────────────────────
  it('getVendorReport verifies membership, queries expenses, delegates', async () => {
    const req = { user: { userId: 'u1' } };
    mockPrisma.organizationMember.findUnique.mockResolvedValue({
      userId: 'u1',
    });
    mockPrisma.expense.findMany.mockResolvedValue([
      {
        merchantName: 'Vendor A',
        amount: 100,
        transactionDate: new Date('2026-01-01'),
      },
    ]);
    mockVendorIntel.generateVendorReport.mockResolvedValue({
      vendors: [],
      concentration: 0,
    });

    const result = await controller.getVendorReport('org-1', req);

    expect(result).toEqual({ vendors: [], concentration: 0 });
    expect(mockVendorIntel.generateVendorReport).toHaveBeenCalled();
  });

  // ── getLiquidityImpact ───────────────────────────────────────────────
  it('getLiquidityImpact verifies membership then delegates', async () => {
    const req = { user: { userId: 'u1' } };
    mockPrisma.organizationMember.findUnique.mockResolvedValue({
      userId: 'u1',
    });
    mockAnomalyDetection.calculateApLcrImpact.mockResolvedValue({
      impact: 0.05,
    });

    const result = await controller.getLiquidityImpact('org-1', 'inst-1', req);

    expect(result).toEqual({ impact: 0.05 });
    expect(mockAnomalyDetection.calculateApLcrImpact).toHaveBeenCalledWith(
      'org-1',
      'inst-1',
    );
  });

  // ── getTemplate ──────────────────────────────────────────────────────
  it('getTemplate returns inline CSV template when file does not exist', async () => {
    const res = { set: jest.fn(), send: jest.fn() };

    await controller.getTemplate(res);

    expect(res.set).toHaveBeenCalledWith(
      expect.objectContaining({ 'Content-Type': 'text/csv' }),
    );
    expect(res.send).toHaveBeenCalledWith(
      expect.stringContaining('date,invoice_number,vendor'),
    );
  });

  // ── uploadExpenseCSV ─────────────────────────────────────────────────
  it('uploadExpenseCSV throws when no file provided', async () => {
    const req = { user: { userId: 'u1' } };

    await expect(
      controller.uploadExpenseCSV(req, 'org-1', undefined as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('uploadExpenseCSV returns errors when CSV is invalid', async () => {
    const req = { user: { userId: 'u1' } };
    const file = {
      buffer: Buffer.from('bad'),
      originalname: 'test.csv',
      size: 3,
    } as Express.Multer.File;
    mockIngestion.parseExpenseCSV.mockReturnValue({
      valid: false,
      errors: ['bad header'],
      warnings: [],
      summary: null,
      items: [],
    });

    const result = await controller.uploadExpenseCSV(req, 'org-1', file);

    expect(result.ingested).toBe(0);
    expect(result.errors).toContain('bad header');
    expect(result.analysisTriggered).toBe(false);
  });

  it('uploadExpenseCSV with auto orgId resolves from membership', async () => {
    const req = { user: { userId: 'u1' } };
    const file = {
      buffer: Buffer.from('good'),
      originalname: 'test.csv',
      size: 4,
    } as Express.Multer.File;
    mockIngestion.parseExpenseCSV.mockReturnValue({
      valid: true,
      errors: [],
      warnings: [],
      summary: {},
      items: [
        {
          vendor: 'V1',
          amount: 100,
          currency: 'USD',
          category: 'supplies',
          date: '2026-01-01',
          status: 'PAID',
        },
      ],
    });
    mockPrisma.organizationMember.findFirst.mockResolvedValue({
      organizationId: 'auto-org',
    });
    mockPrisma.expense.create.mockResolvedValue({ id: 'exp-1' });
    mockAnomalyDetection.analyzeOrganization.mockResolvedValue({});

    const result = await controller.uploadExpenseCSV(req, 'auto', file);

    expect(result.ingested).toBe(1);
    expect(result.orgId).toBe('auto-org');
    expect(result.analysisTriggered).toBe(true);
  });

  it('uploadExpenseCSV creates default org when user has no membership', async () => {
    const req = { user: { userId: 'u1' } };
    const file = {
      buffer: Buffer.from('good'),
      originalname: 'test.csv',
      size: 4,
    } as Express.Multer.File;
    mockIngestion.parseExpenseCSV.mockReturnValue({
      valid: true,
      errors: [],
      warnings: [],
      summary: {},
      items: [
        {
          vendor: 'V1',
          amount: 50,
          currency: 'USD',
          category: 'utilities',
          date: '2026-01-01',
          status: 'PENDING',
        },
      ],
    });
    mockPrisma.organizationMember.findFirst.mockResolvedValue(null);
    mockPrisma.organization.create.mockResolvedValue({ id: 'new-org' });
    mockPrisma.expense.create.mockResolvedValue({ id: 'exp-1' });
    mockAnomalyDetection.analyzeOrganization.mockResolvedValue({});

    const result = await controller.uploadExpenseCSV(req, 'default', file);

    expect(result.orgId).toBe('new-org');
    expect(mockPrisma.organization.create).toHaveBeenCalled();
  });

  it('uploadExpenseCSV verifies membership for specific orgId', async () => {
    const req = { user: { userId: 'u1' } };
    const file = {
      buffer: Buffer.from('good'),
      originalname: 'test.csv',
      size: 4,
    } as Express.Multer.File;
    mockIngestion.parseExpenseCSV.mockReturnValue({
      valid: true,
      errors: [],
      warnings: [],
      summary: {},
      items: [
        {
          vendor: 'V1',
          amount: 100,
          currency: 'USD',
          category: 'supplies',
          date: '2026-01-01',
          status: 'PAID',
        },
      ],
    });
    mockPrisma.organizationMember.findUnique.mockResolvedValue(null);

    await expect(
      controller.uploadExpenseCSV(req, 'specific-org', file),
    ).rejects.toThrow(BadRequestException);
  });

  it('uploadExpenseCSV handles anomaly detection failure gracefully', async () => {
    const req = { user: { userId: 'u1' } };
    const file = {
      buffer: Buffer.from('good'),
      originalname: 'test.csv',
      size: 4,
    } as Express.Multer.File;
    mockIngestion.parseExpenseCSV.mockReturnValue({
      valid: true,
      errors: [],
      warnings: [],
      summary: {},
      items: [
        {
          vendor: 'V1',
          amount: 100,
          currency: 'USD',
          category: 'supplies',
          date: '2026-01-01',
          status: 'PAID',
        },
      ],
    });
    mockPrisma.organizationMember.findFirst.mockResolvedValue({
      organizationId: 'org-1',
    });
    mockPrisma.expense.create.mockResolvedValue({ id: 'exp-1' });
    mockAnomalyDetection.analyzeOrganization.mockRejectedValue(
      new Error('Analysis failed'),
    );

    const result = await controller.uploadExpenseCSV(req, 'auto', file);

    expect(result.ingested).toBe(1);
    expect(result.analysisTriggered).toBe(false);
  });

  // ── resolveOrgId falls back to user.orgId ────────────────────────────
  it('resolveOrgId falls back to user.orgId when header is missing', async () => {
    const req = { headers: {}, user: { userId: 'u1', orgId: 'user-org' } };
    mockExpensesService.findAll.mockResolvedValue([]);

    const result = await controller.findAll(undefined as any, req);

    expect(mockExpensesService.findAll).toHaveBeenCalledWith(
      'user-org',
      'u1',
      undefined,
    );
  });

  // ── findAll with status filter ───────────────────────────────────────
  it('findAll passes status filter to service', async () => {
    const req = {
      headers: { 'x-organization-id': 'org-1' },
      user: { userId: 'u1' },
    };
    mockExpensesService.findAll.mockResolvedValue([]);

    await controller.findAll('APPROVED', req);

    expect(mockExpensesService.findAll).toHaveBeenCalledWith(
      'org-1',
      'u1',
      'APPROVED',
    );
  });

  // ── generateAPReport ─────────────────────────────────────────────────
  it('generateAPReport verifies membership and returns PDF buffer', async () => {
    const req = { user: { userId: 'u1' } };
    const res = { set: jest.fn(), end: jest.fn() };
    mockPrisma.organizationMember.findUnique.mockResolvedValue({
      userId: 'u1',
    });
    const pdfBuffer = Buffer.from('fake-pdf-content');
    mockApReport.generateAPReport.mockResolvedValue(pdfBuffer);

    await controller.generateAPReport('org-1', 'es', 'inst-1', req, res);

    expect(mockApReport.generateAPReport).toHaveBeenCalledWith(
      'org-1',
      'inst-1',
      'es',
    );
    expect(res.set).toHaveBeenCalledWith(
      expect.objectContaining({ 'Content-Type': 'application/pdf' }),
    );
    expect(res.end).toHaveBeenCalledWith(pdfBuffer);
  });

  it('generateAPReport defaults to English when lang is not es', async () => {
    const req = { user: { userId: 'u1' } };
    const res = { set: jest.fn(), end: jest.fn() };
    mockPrisma.organizationMember.findUnique.mockResolvedValue({
      userId: 'u1',
    });
    mockApReport.generateAPReport.mockResolvedValue(Buffer.from('pdf'));

    await controller.generateAPReport('org-1', 'fr', null as any, req, res);

    expect(mockApReport.generateAPReport).toHaveBeenCalledWith(
      'org-1',
      null,
      'en',
    );
  });
});
