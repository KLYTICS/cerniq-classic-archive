import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import {
  AdminAuditController,
  PortalAuditController,
} from './audit.controller';
import { AuditService } from './audit.service';
import { PrismaService } from '../prisma.service';
import { AuthGuard } from '../auth/auth.guard';

describe('AdminAuditController', () => {
  let controller: AdminAuditController;
  let auditService: Record<string, jest.Mock>;

  const originalEnv = process.env;

  beforeEach(async () => {
    process.env = { ...originalEnv, ADMIN_KEY: 'valid-admin-key' };

    auditService = {
      adminQuery: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminAuditController],
      providers: [{ provide: AuditService, useValue: auditService }],
    }).compile();

    controller = module.get<AdminAuditController>(AdminAuditController);
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getAuditLogs', () => {
    it('should return audit logs with valid admin key', async () => {
      const mockLogs = [{ id: 'log-1', action: 'LOGIN' }];
      auditService.adminQuery.mockResolvedValue(mockLogs);

      const result = await controller.getAuditLogs(
        'valid-admin-key',
        'inst-1',
        '50',
        '10',
      );
      expect(result).toEqual(mockLogs);
      expect(auditService.adminQuery).toHaveBeenCalledWith({
        institutionId: 'inst-1',
        limit: 50,
        offset: 10,
      });
    });

    it('should use defaults for limit and offset', async () => {
      auditService.adminQuery.mockResolvedValue([]);

      await controller.getAuditLogs('valid-admin-key');
      expect(auditService.adminQuery).toHaveBeenCalledWith({
        institutionId: undefined,
        limit: 100,
        offset: 0,
      });
    });

    it('should throw UnauthorizedException for invalid admin key', async () => {
      await expect(controller.getAuditLogs('wrong-key')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when ADMIN_KEY not set', async () => {
      delete process.env.ADMIN_KEY;

      await expect(controller.getAuditLogs('any-key')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});

describe('PortalAuditController', () => {
  let controller: PortalAuditController;
  let auditService: Record<string, jest.Mock>;
  let prismaService: any;

  beforeEach(async () => {
    auditService = {
      queryByInstitution: jest.fn(),
      queryByUser: jest.fn(),
    };

    prismaService = {
      user: { findUnique: jest.fn() },
      reportJob: { findFirst: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PortalAuditController],
      providers: [
        { provide: AuditService, useValue: auditService },
        { provide: PrismaService, useValue: prismaService },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PortalAuditController>(PortalAuditController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getAuditLog', () => {
    it('should return institution audit log for OWNER role', async () => {
      const req = { user: { userId: 'u1', role: 'OWNER' } };
      prismaService.user.findUnique.mockResolvedValue({ role: 'OWNER' });
      prismaService.reportJob.findFirst.mockResolvedValue({
        institutionId: 'inst-1',
      });
      const mockLogs = [{ id: 'log-1' }];
      auditService.queryByInstitution.mockResolvedValue(mockLogs);

      const result = await controller.getAuditLog(req, '50', '10');
      expect(result).toEqual(mockLogs);
      expect(auditService.queryByInstitution).toHaveBeenCalledWith('inst-1', {
        limit: 50,
        offset: 10,
        daysBack: 90,
      });
    });

    it('should fall back to user audit log when OWNER has no institution', async () => {
      const req = { user: { userId: 'u1', role: 'OWNER' } };
      prismaService.user.findUnique.mockResolvedValue({ role: 'OWNER' });
      prismaService.reportJob.findFirst.mockResolvedValue(null);
      const mockLogs = [{ id: 'user-log' }];
      auditService.queryByUser.mockResolvedValue(mockLogs);

      const result = await controller.getAuditLog(req);
      expect(result).toEqual(mockLogs);
      expect(auditService.queryByUser).toHaveBeenCalledWith('u1', {
        limit: 100,
        offset: 0,
        daysBack: 90,
      });
    });

    it('should return user audit log for non-OWNER role', async () => {
      const req = { user: { userId: 'u2', role: 'MEMBER' } };
      const mockLogs = [{ id: 'user-log' }];
      auditService.queryByUser.mockResolvedValue(mockLogs);

      const result = await controller.getAuditLog(req);
      expect(result).toEqual(mockLogs);
      expect(auditService.queryByUser).toHaveBeenCalledWith('u2', {
        limit: 100,
        offset: 0,
        daysBack: 90,
      });
    });

    it('should use default limit and offset', async () => {
      const req = { user: { userId: 'u2', role: 'MEMBER' } };
      auditService.queryByUser.mockResolvedValue([]);

      await controller.getAuditLog(req);
      expect(auditService.queryByUser).toHaveBeenCalledWith('u2', {
        limit: 100,
        offset: 0,
        daysBack: 90,
      });
    });
  });
});
