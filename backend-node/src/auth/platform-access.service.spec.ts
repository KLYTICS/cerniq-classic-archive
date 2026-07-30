import { PlatformAccessService } from './platform-access.service';

describe('PlatformAccessService', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('blocks OWNER accounts when recovery bypass is unset (opt-in only)', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.PLATFORM_RECOVERY_OWNER_BYPASS;

    const service = new PlatformAccessService({} as any);
    const access = service.evaluateAccess(
      'owner@cerniq.io',
      { tier: 'free', status: null },
      'OWNER',
    );

    expect(access).toMatchObject({
      platformAccessAllowed: false,
      reason: 'subscription_required',
      isPaid: false,
    });
  });

  it('allows OWNER accounts only when PLATFORM_RECOVERY_OWNER_BYPASS is explicitly enabled', () => {
    process.env.NODE_ENV = 'production';
    process.env.PLATFORM_RECOVERY_OWNER_BYPASS = 'true';

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

  it('allows the developer master email kiess2005@gmail.com', () => {
    const service = new PlatformAccessService({} as any);
    const access = service.evaluateAccess(
      'kiess2005@gmail.com',
      { tier: 'free', status: null },
      'VIEWER',
    );

    expect(access).toMatchObject({
      platformAccessAllowed: true,
      isMasterCeo: true,
      reason: 'master_ceo',
    });
    expect(service.isMasterAccountEmail('kiess2005@gmail.com')).toBe(true);
  });

  it('grants master access to the founder demo account eskiessalfonso@gmail.com', () => {
    // Regression guard: this address is UNPAID (tier free / no subscription).
    // Before it was added to MASTER_ACCOUNT_EMAILS, its Supabase-issued JWT
    // 403'd with PLATFORM_ACCESS_REQUIRED on every gated route — including
    // GET /api/alm/institutions, which is exactly what the production E2E
    // bootstrap probes, so Phases 2-3 could never start.
    const service = new PlatformAccessService({} as any);
    const access = service.evaluateAccess(
      'eskiessalfonso@gmail.com',
      { tier: 'free', status: null },
      'VIEWER',
    );

    expect(access).toMatchObject({
      platformAccessAllowed: true,
      isMasterCeo: true,
      reason: 'master_ceo',
    });
    expect(service.isMasterAccountEmail('eskiessalfonso@gmail.com')).toBe(true);
    // Case/whitespace variants must resolve too — Supabase normalizes emails
    // lowercase, but the guard receives whatever the JWT carries.
    expect(service.isMasterAccountEmail('  EsKiessAlfonso@Gmail.com ')).toBe(
      true,
    );
  });

  it('still denies a non-master unpaid account', () => {
    // Proves the grant above is an allowlist entry, not a blanket gate removal.
    const service = new PlatformAccessService({} as any);
    const access = service.evaluateAccess(
      'someone.else@example.com',
      { tier: 'free', status: null },
      'VIEWER',
    );

    expect(access.platformAccessAllowed).toBe(false);
    expect(access.isMasterCeo).toBe(false);
    expect(service.isMasterAccountEmail('someone.else@example.com')).toBe(
      false,
    );
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
