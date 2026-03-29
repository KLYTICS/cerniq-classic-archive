import { BadRequestException } from '@nestjs/common';
import { ReferralService } from './referral.service';

describe('ReferralService', () => {
  let service: ReferralService;
  const mockPrisma = {
    institution: {
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        id: 'inst-1',
        name: 'Cooperativa Test',
      }),
    },
  };

  beforeEach(() => {
    service = new ReferralService(mockPrisma as any);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('generateCode returns a valid CERNIQ referral code', async () => {
    const result = await service.generateCode('inst-1');
    expect(result.code).toMatch(/^CERNIQ-[A-Z]+-[A-F0-9]+$/);
    expect(result.status).toBe('active');
    expect(result.referrerInstitutionId).toBe('inst-1');
    expect(result.referrerName).toBe('Cooperativa Test');
  });

  it('validateCode returns valid for CERNIQ-prefixed codes', async () => {
    const result = await service.validateCode('CERNIQ-TEST-ABC123');
    expect(result.valid).toBe(true);
    expect(result.discount).toBeDefined();
  });

  it('validateCode returns invalid for non-CERNIQ codes', async () => {
    const result = await service.validateCode('INVALID-CODE');
    expect(result.valid).toBe(false);
  });

  it('applyCode succeeds for valid referral code', async () => {
    const result = await service.applyCode('inst-2', 'CERNIQ-TEST-ABC123');
    expect(result.applied).toBe(true);
    expect(result.message).toContain('Referral applied');
  });

  it('applyCode throws BadRequestException for invalid code', async () => {
    await expect(service.applyCode('inst-2', 'INVALID-CODE')).rejects.toThrow(
      BadRequestException,
    );
  });
});
