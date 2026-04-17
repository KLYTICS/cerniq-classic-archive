import { HttpException, HttpStatus } from '@nestjs/common';
import { SentrySmokeController } from './sentry-smoke.controller';

/**
 * Contract tests for the /admin/api/sentry-smoke endpoint.
 *
 * The endpoint is a one-shot Sentry verification tool. These tests lock:
 *   (1) production without the explicit opt-in flag returns 501
 *   (2) production WITH SENTRY_SMOKE_ENABLED=1 throws (captured by Sentry)
 *   (3) development always throws
 *   (4) the thrown Error message is stable — going-live runbooks grep for it
 */
describe('SentrySmokeController', () => {
  let controller: SentrySmokeController;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    controller = new SentrySmokeController();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('production gate', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('returns 501 when SENTRY_SMOKE_ENABLED is absent', () => {
      delete process.env.SENTRY_SMOKE_ENABLED;
      try {
        controller.trigger();
        fail('expected HttpException');
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect((err as HttpException).getStatus()).toBe(
          HttpStatus.NOT_IMPLEMENTED,
        );
      }
    });

    it('returns 501 when SENTRY_SMOKE_ENABLED is set to anything other than "1"', () => {
      process.env.SENTRY_SMOKE_ENABLED = 'true';
      try {
        controller.trigger();
        fail('expected HttpException');
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect((err as HttpException).getStatus()).toBe(
          HttpStatus.NOT_IMPLEMENTED,
        );
      }
    });

    it('throws a real Error when SENTRY_SMOKE_ENABLED=1', () => {
      process.env.SENTRY_SMOKE_ENABLED = '1';
      expect(() => controller.trigger()).toThrow(Error);
      expect(() => controller.trigger()).not.toThrow(HttpException);
    });
  });

  describe('non-production environments', () => {
    for (const env of ['development', 'test', undefined]) {
      it(`throws a real Error in NODE_ENV=${env ?? '(unset)'}`, () => {
        if (env === undefined) {
          delete process.env.NODE_ENV;
        } else {
          process.env.NODE_ENV = env;
        }
        expect(() => controller.trigger()).toThrow(Error);
      });
    }
  });

  it('throws with a stable recognizable message (runbook grep target)', () => {
    process.env.NODE_ENV = 'development';
    try {
      controller.trigger();
      fail('expected Error');
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      // The message is referenced by going-live runbooks — changing it
      // breaks the operator's ability to find the Sentry issue.
      expect((err as Error).message).toContain('Sentry smoke test');
      expect((err as Error).message).toContain(
        'CERNIQ backend wired correctly',
      );
    }
  });
});
