import { validateEnv } from './env.schema';

describe('env.schema', () => {
  const VALID_ENV = {
    JWT_SECRET: 'a'.repeat(32),
    DATABASE_URL: 'postgresql://localhost:5432/test',
    NODE_ENV: 'test',
    PORT: '4000',
  };

  let originalEnv: NodeJS.ProcessEnv;
  let exitSpy: jest.SpyInstance;

  beforeEach(() => {
    originalEnv = { ...process.env };
    exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    exitSpy.mockRestore();
    jest.restoreAllMocks();
  });

  it('accepts a valid minimal env', () => {
    Object.assign(process.env, VALID_ENV);
    const env = validateEnv();
    expect(env.JWT_SECRET).toBe(VALID_ENV.JWT_SECRET);
    expect(env.DATABASE_URL).toBe(VALID_ENV.DATABASE_URL);
    expect(env.PORT).toBe(4000); // transformed to number
  });

  it('exits on missing JWT_SECRET', () => {
    Object.assign(process.env, { ...VALID_ENV, JWT_SECRET: undefined });
    delete process.env.JWT_SECRET;
    expect(() => validateEnv()).toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits when JWT_SECRET is too short', () => {
    Object.assign(process.env, { ...VALID_ENV, JWT_SECRET: 'short' });
    expect(() => validateEnv()).toThrow('process.exit called');
  });

  it('exits on missing DATABASE_URL', () => {
    Object.assign(process.env, { ...VALID_ENV, DATABASE_URL: undefined });
    delete process.env.DATABASE_URL;
    expect(() => validateEnv()).toThrow('process.exit called');
  });

  it('defaults PORT to 4000 when not set', () => {
    const env2 = { ...VALID_ENV };
    delete (env2 as any).PORT;
    Object.assign(process.env, env2);
    delete process.env.PORT;
    const env = validateEnv();
    expect(env.PORT).toBe(4000);
  });

  it('defaults NODE_ENV to development when not set', () => {
    const env2 = { ...VALID_ENV };
    delete (env2 as any).NODE_ENV;
    Object.assign(process.env, env2);
    delete process.env.NODE_ENV;
    const env = validateEnv();
    expect(env.NODE_ENV).toBe('development');
  });

  it('allows all optional fields to be absent', () => {
    // Explicitly unset optional env vars that the CI runner may inject
    // (e.g. REDIS_URL from service containers) so the "absent" assertion
    // reflects the schema's behavior, not the environment that runs it.
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.REDIS_URL;
    Object.assign(process.env, VALID_ENV);
    const env = validateEnv();
    expect(env.STRIPE_SECRET_KEY).toBeUndefined();
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.REDIS_URL).toBeUndefined();
  });

  it('parses THROTTLE_TTL and THROTTLE_LIMIT as numbers', () => {
    Object.assign(process.env, {
      ...VALID_ENV,
      THROTTLE_TTL: '60',
      THROTTLE_LIMIT: '100',
    });
    const env = validateEnv();
    expect(env.THROTTLE_TTL).toBe(60);
    expect(env.THROTTLE_LIMIT).toBe(100);
  });

  it('rejects invalid NODE_ENV value', () => {
    Object.assign(process.env, { ...VALID_ENV, NODE_ENV: 'staging' });
    expect(() => validateEnv()).toThrow('process.exit called');
  });

  // ── Agent Execution Layer validators (2026-04-16) ─────────────────
  //
  // These tests lock the boot-time env validation for the vars added
  // when the Agent Execution Layer landed. If Railway deploys with a
  // malformed value, we want to fail loudly with a formatted error
  // listing every offender, not boot silently with `NaN` concurrency
  // or negative cost caps.

  describe('AGENT_WORKER_CONCURRENCY', () => {
    it('parses a valid value as a number', () => {
      Object.assign(process.env, {
        ...VALID_ENV,
        AGENT_WORKER_CONCURRENCY: '8',
      });
      const env = validateEnv();
      expect(env.AGENT_WORKER_CONCURRENCY).toBe(8);
    });

    it('rejects zero (must be at least 1)', () => {
      Object.assign(process.env, {
        ...VALID_ENV,
        AGENT_WORKER_CONCURRENCY: '0',
      });
      expect(() => validateEnv()).toThrow('process.exit called');
    });

    it('rejects values over 50 (concurrency ceiling)', () => {
      Object.assign(process.env, {
        ...VALID_ENV,
        AGENT_WORKER_CONCURRENCY: '100',
      });
      expect(() => validateEnv()).toThrow('process.exit called');
    });

    it('rejects non-integer values', () => {
      Object.assign(process.env, {
        ...VALID_ENV,
        AGENT_WORKER_CONCURRENCY: '3.5',
      });
      expect(() => validateEnv()).toThrow('process.exit called');
    });

    it('allows absence (optional)', () => {
      delete process.env.AGENT_WORKER_CONCURRENCY;
      Object.assign(process.env, VALID_ENV);
      const env = validateEnv();
      expect(env.AGENT_WORKER_CONCURRENCY).toBeUndefined();
    });
  });

  describe('LLM_COST_CAP_USD_CENTS', () => {
    it('parses a valid cost cap as a number', () => {
      Object.assign(process.env, {
        ...VALID_ENV,
        LLM_COST_CAP_USD_CENTS: '20000',
      });
      const env = validateEnv();
      expect(env.LLM_COST_CAP_USD_CENTS).toBe(20000);
    });

    it('allows 0 (disable semantics)', () => {
      Object.assign(process.env, { ...VALID_ENV, LLM_COST_CAP_USD_CENTS: '0' });
      const env = validateEnv();
      expect(env.LLM_COST_CAP_USD_CENTS).toBe(0);
    });

    it('rejects negative cost caps', () => {
      Object.assign(process.env, {
        ...VALID_ENV,
        LLM_COST_CAP_USD_CENTS: '-100',
      });
      expect(() => validateEnv()).toThrow('process.exit called');
    });

    it('rejects non-integer cents', () => {
      Object.assign(process.env, {
        ...VALID_ENV,
        LLM_COST_CAP_USD_CENTS: '10.5',
      });
      expect(() => validateEnv()).toThrow('process.exit called');
    });
  });

  describe('RETENTION_AUDIT_LOGS_DAYS', () => {
    it('parses a valid retention window', () => {
      Object.assign(process.env, {
        ...VALID_ENV,
        RETENTION_AUDIT_LOGS_DAYS: '2555',
      });
      const env = validateEnv();
      expect(env.RETENTION_AUDIT_LOGS_DAYS).toBe(2555);
    });

    it('rejects zero and negative retention', () => {
      Object.assign(process.env, {
        ...VALID_ENV,
        RETENTION_AUDIT_LOGS_DAYS: '0',
      });
      expect(() => validateEnv()).toThrow('process.exit called');
    });

    it('allows absence (data-retention.service supplies 2555 default)', () => {
      delete process.env.RETENTION_AUDIT_LOGS_DAYS;
      Object.assign(process.env, VALID_ENV);
      const env = validateEnv();
      expect(env.RETENTION_AUDIT_LOGS_DAYS).toBeUndefined();
    });
  });

  it('AGENT_SCHEDULER_DISABLED accepts any string (truthy-check contract)', () => {
    // The scheduler reads `!!process.env.AGENT_SCHEDULER_DISABLED` so
    // any non-empty value disables. We don't want Zod to reject that.
    Object.assign(process.env, {
      ...VALID_ENV,
      AGENT_SCHEDULER_DISABLED: 'true',
    });
    const env = validateEnv();
    expect(env.AGENT_SCHEDULER_DISABLED).toBe('true');
  });
});
