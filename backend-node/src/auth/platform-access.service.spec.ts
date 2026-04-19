import { PlatformAccessService } from './platform-access.service';

describe('PlatformAccessService', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('allows OWNER accounts through the temporary recovery bypass in production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.PLATFORM_RECOVERY_OWNER_BYPASS;

    const service = new PlatformAccessService({} as any);
    const access = service.evaluateAccess(
      'owner@cerniq.io',
      { tier: 'free', status: null },
      'OWNER',
    );

    expect(access).toMatchObject({
      platformAccessAllowed: true,
      reason: 'owner_recovery_bypass',
      isPaid: false,
    });
  });

  it('keeps non-OWNER users blocked when they do not have paid access', () => {
    process.env.NODE_ENV = 'production';
    process.env.PLATFORM_RECOVERY_OWNER_BYPASS = 'true';

    const service = new PlatformAccessService({} as any);
    const access = service.evaluateAccess(
      'viewer@cerniq.io',
      { tier: 'free', status: null },
      'VIEWER',
    );

    expect(access).toMatchObject({
      platformAccessAllowed: false,
      reason: 'subscription_required',
    });
  });

  it('always allows the master CEO account by email', () => {
    const service = new PlatformAccessService({} as any);
    const access = service.evaluateAccess(
      'data.ai.kiess@gmail.com',
      { tier: 'free', status: null },
      'VIEWER',
    );

    expect(access).toMatchObject({
      platformAccessAllowed: true,
      isMasterCeo: true,
      reason: 'master_ceo',
    });
  });

  it('treats master-account aliases on other domains as the same owner account', () => {
    const service = new PlatformAccessService({} as any);
    const access = service.evaluateAccess(
      'data.ai.kiess@cerniq.io',
      { tier: 'free', status: null },
      'VIEWER',
    );

    expect(access).toMatchObject({
      platformAccessAllowed: true,
      isMasterCeo: true,
      reason: 'master_ceo',
    });
    expect(service.normalizeMasterAccountEmail('data.ai.kiess@cerniq.io')).toBe(
      'data.ai.kiess@gmail.com',
    );
  });

  it('canonicalizes the bare master identifier to the owner email', () => {
    const service = new PlatformAccessService({} as any);

    expect(service.normalizeMasterAccountEmail('data.ai.kiess')).toBe(
      'data.ai.kiess@gmail.com',
    );
    expect(service.isMasterAccountEmail('data.ai.kiess')).toBe(true);
  });
});
