import { settleAll, withTimeout, mapConcurrent } from './promise.util';

describe('promise.util', () => {
  describe('settleAll', () => {
    it('separates fulfilled and rejected results', async () => {
      const results = await settleAll([
        Promise.resolve('ok'),
        Promise.reject(new Error('fail')),
        Promise.resolve('also ok'),
      ]);
      expect(results.fulfilled).toEqual(['ok', 'also ok']);
      expect(results.rejected).toHaveLength(1);
      expect(results.rejected[0].message).toBe('fail');
    });
  });

  describe('withTimeout', () => {
    it('resolves if promise completes within timeout', async () => {
      const result = await withTimeout(Promise.resolve('fast'), 1000);
      expect(result).toBe('fast');
    });

    it('rejects if promise exceeds timeout', async () => {
      const slow = new Promise((resolve) => setTimeout(resolve, 5000));
      await expect(withTimeout(slow, 10)).rejects.toThrow(
        'Operation timed out',
      );
    });
  });

  describe('mapConcurrent', () => {
    it('maps items with bounded concurrency', async () => {
      const items = [1, 2, 3];
      const results = await mapConcurrent(items, 2, async (n) => n * 2);
      expect(results).toEqual([2, 4, 6]);
    });
  });
});
