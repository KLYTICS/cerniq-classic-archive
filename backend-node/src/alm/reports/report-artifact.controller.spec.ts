import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ReportArtifactController } from './report-artifact.controller';
import { ReportArtifactService } from './report-artifact.service';
import { AuthGuard } from '../../auth/auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { InstitutionScopeGuard } from '../../agent-api/guards/institution-scope.guard';

const mockArtifact = {
  id: 'art-1',
  institutionId: 'inst-1',
  format: 'PDF_ES',
  contentChecksum: 'sha256:abc123',
  sizeBytes: 1024,
  storageLocator: 'r2://reports/test.pdf',
  modelLineageSnapshot: [],
  preflightReady: true,
  generatedAt: new Date(),
};

function createMockService() {
  return {
    listForInstitution: jest.fn().mockResolvedValue([mockArtifact]),
    listForAnalysisRun: jest.fn().mockResolvedValue([mockArtifact]),
    getById: jest.fn().mockResolvedValue(mockArtifact),
    findByChecksum: jest.fn().mockResolvedValue(mockArtifact),
    verify: jest.fn().mockResolvedValue({
      valid: true,
      stored: 'sha256:abc123',
      computed: 'sha256:abc123',
    }),
  };
}

describe('ReportArtifactController', () => {
  let controller: ReportArtifactController;
  let service: ReturnType<typeof createMockService>;
  let institutionScope: { verifyOwnership: jest.Mock };

  const reqInTenant = {
    user: { userId: 'u1', access: { isMasterCeo: false } },
  };

  beforeEach(async () => {
    service = createMockService();
    institutionScope = {
      verifyOwnership: jest.fn().mockResolvedValue(undefined),
    };
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportArtifactController],
      providers: [
        { provide: ReportArtifactService, useValue: service },
        { provide: InstitutionScopeGuard, useValue: institutionScope },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(InstitutionScopeGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();
    controller = module.get(ReportArtifactController);
  });

  it('lists artifacts for institution with default limit', async () => {
    const result = await controller.listForInstitution('inst-1');
    expect(service.listForInstitution).toHaveBeenCalledWith('inst-1', 50);
    expect(result).toHaveLength(1);
  });

  it('clamps limit to valid range', async () => {
    await controller.listForInstitution('inst-1', '999');
    expect(service.listForInstitution).toHaveBeenCalledWith('inst-1', 200);
  });

  it('lists artifacts for analysis run', async () => {
    const result = await controller.listForAnalysisRun('run-1');
    expect(service.listForAnalysisRun).toHaveBeenCalledWith('run-1');
    expect(result).toHaveLength(1);
  });

  it('gets artifact by ID — verifies ownership via the artifact institutionId', async () => {
    const result = await controller.getById('art-1', reqInTenant);
    expect(result.id).toBe('art-1');
    expect(institutionScope.verifyOwnership).toHaveBeenCalledWith(
      'inst-1',
      'u1',
      false,
    );
  });

  it('propagates Forbidden when caller is not in the artifact institution (IDOR closure)', async () => {
    institutionScope.verifyOwnership.mockRejectedValueOnce(
      new ForbiddenException('not authorized for this institution'),
    );
    await expect(
      controller.getById('art-1', {
        user: { userId: 'u-other', access: { isMasterCeo: false } },
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('forwards master-CEO flag to verifyOwnership so platform admins can bypass', async () => {
    await controller.getById('art-1', {
      user: { userId: 'u-platform', access: { isMasterCeo: true } },
    });
    expect(institutionScope.verifyOwnership).toHaveBeenCalledWith(
      'inst-1',
      'u-platform',
      true,
    );
  });

  it('finds artifact by checksum', async () => {
    const result = await controller.findByChecksum('sha256:abc123');
    expect(result.found).toBe(true);
    expect(result.artifact).toBeDefined();
  });

  it('returns found=false for unknown checksum', async () => {
    service.findByChecksum.mockResolvedValue(null);
    const result = await controller.findByChecksum('sha256:unknown');
    expect(result.found).toBe(false);
    expect(result.artifact).toBeNull();
  });

  it('verifies artifact integrity', async () => {
    const result = await controller.verify('art-1', {
      contentBase64: Buffer.from('test content').toString('base64'),
    });
    expect(result.valid).toBe(true);
  });

  it('rejects verify without content', async () => {
    await expect(
      controller.verify('art-1', { contentBase64: '' }),
    ).rejects.toThrow(BadRequestException);
  });
});
