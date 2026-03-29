import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ComplianceController } from './compliance.controller';
import { ComplianceReportService } from './compliance-report.service';

describe('ComplianceController', () => {
  let controller: ComplianceController;
  let reportService: Record<string, jest.Mock>;

  const originalEnv = process.env;

  beforeEach(async () => {
    process.env = { ...originalEnv, ADMIN_KEY: 'valid-admin-key' };

    reportService = {
      generateSOC2Evidence: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ComplianceController],
      providers: [
        { provide: ComplianceReportService, useValue: reportService },
      ],
    }).compile();

    controller = module.get<ComplianceController>(ComplianceController);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getSOC2Evidence', () => {
    it('should return SOC2 evidence with valid admin key', async () => {
      const mockReport = { controls: [], evidence: [] };
      reportService.generateSOC2Evidence.mockResolvedValue(mockReport);

      const result = await controller.getSOC2Evidence('valid-admin-key');
      expect(result).toEqual({ ok: true, data: mockReport });
      expect(reportService.generateSOC2Evidence).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for invalid admin key', async () => {
      await expect(
        controller.getSOC2Evidence('wrong-key'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when ADMIN_KEY not set', async () => {
      delete process.env.ADMIN_KEY;

      await expect(
        controller.getSOC2Evidence('any-key'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should propagate service errors', async () => {
      reportService.generateSOC2Evidence.mockRejectedValue(
        new Error('DB error'),
      );

      await expect(
        controller.getSOC2Evidence('valid-admin-key'),
      ).rejects.toThrow('DB error');
    });
  });
});
