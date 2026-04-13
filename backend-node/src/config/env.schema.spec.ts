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
    Object.assign(process.env, VALID_ENV);
    const env = validateEnv();
    expect(env.STRIPE_SECRET_KEY).toBeUndefined();
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.REDIS_URL).toBeUndefined();
  });

  it('parses THROTTLE_TTL and THROTTLE_LIMIT as numbers', () => {
    Object.assign(process.env, { ...VALID_ENV, THROTTLE_TTL: '60', THROTTLE_LIMIT: '100' });
    const env = validateEnv();
    expect(env.THROTTLE_TTL).toBe(60);
    expect(env.THROTTLE_LIMIT).toBe(100);
  });

  it('rejects invalid NODE_ENV value', () => {
    Object.assign(process.env, { ...VALID_ENV, NODE_ENV: 'staging' });
    expect(() => validateEnv()).toThrow('process.exit called');
  });
});
