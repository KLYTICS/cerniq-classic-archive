import { CircuitBreakerService } from './circuit-breaker.service';
import { ServiceUnavailableException } from '@nestjs/common';

describe('CircuitBreakerService', () => {
  let service: CircuitBreakerService;

  beforeEach(() => {
    service = new CircuitBreakerService();
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('execute', () => {
    it('should execute function successfully on closed circuit', async () => {
      const result = await service.execute('test_api', async () => 'success');
      expect(result).toBe('success');
    });

    it('should open circuit after threshold failures', async () => {
      const failFn = async () => {
        throw new Error('connection refused');
      };

      // Default threshold is 5 failures
      for (let i = 0; i < 5; i++) {
        await expect(service.execute('default', failFn)).rejects.toThrow();
      }

      // Circuit should now be open — next call should throw ServiceUnavailableException
      await expect(
        service.execute('default', async () => 'wont-reach'),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('should use fallback when circuit is open and fallback is provided', async () => {
      const failFn = async () => {
        throw new Error('fail');
      };

      for (let i = 0; i < 5; i++) {
        await service.execute('default', failFn, () => 'fallback').catch(() => {});
      }

      const result = await service.execute(
        'default',
        async () => 'wont-reach',
        () => 'fallback-value',
      );
      expect(result).toBe('fallback-value');
    });

    it('should reset circuit on successful call', async () => {
      const result = await service.execute('test_api', async () => 42);
      expect(result).toBe(42);

      const status = service.getStatus();
      const testCircuit = status.find((s) => s.service === 'test_api');
      expect(testCircuit?.state).toBe('closed');
      expect(testCircuit?.failures).toBe(0);
    });

    it('should use fallback on failure when fallback is provided', async () => {
      const result = await service.execute(
        'test_api',
        async () => {
          throw new Error('timeout');
        },
        () => 'cached-result',
      );
      expect(result).toBe('cached-result');
    });
  });

  describe('getStatus', () => {
    it('should return empty array when no circuits used', () => {
      expect(service.getStatus()).toEqual([]);
    });

    it('should return circuit state after usage', async () => {
      await service.execute('fred_api', async () => 'ok');

      const status = service.getStatus();
      expect(status.length).toBe(1);
      expect(status[0].service).toBe('fred_api');
      expect(status[0].state).toBe('closed');
    });
  });
});
