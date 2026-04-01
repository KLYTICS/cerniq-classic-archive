import { processBatch } from './batch-processor.util';

describe('processBatch', () => {
  it('processes all items in batches', async () => {
    const items = [1, 2, 3, 4, 5];
    const processor = jest.fn(async (batch: number[]) => batch.map((n) => n * 2));

    const result = await processBatch(items, processor, { batchSize: 2 });

    expect(result.successful).toEqual([2, 4, 6, 8, 10]);
    expect(result.totalProcessed).toBe(5);
    expect(result.totalFailed).toBe(0);
    expect(result.failed).toEqual([]);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    // 5 items with batchSize 2 = 3 batches
    expect(processor).toHaveBeenCalledTimes(3);
  });

  it('uses default batch size of 100', async () => {
    const items = Array.from({ length: 150 }, (_, i) => i);
    const processor = jest.fn(async (batch: number[]) => batch);

    await processBatch(items, processor);

    expect(processor).toHaveBeenCalledTimes(2); // 100 + 50
  });

  it('handles empty input', async () => {
    const processor = jest.fn(async (batch: number[]) => batch);
    const result = await processBatch([], processor);

    expect(result.successful).toEqual([]);
    expect(result.totalProcessed).toBe(0);
    expect(processor).not.toHaveBeenCalled();
  });

  it('throws on error when continueOnError is false', async () => {
    const items = [1, 2, 3];
    const processor = jest.fn(async () => {
      throw new Error('batch failed');
    });

    await expect(processBatch(items, processor, { batchSize: 2 })).rejects.toThrow(
      'batch failed',
    );
  });

  it('continues on error when continueOnError is true', async () => {
    const items = [1, 2, 3, 4];
    let callCount = 0;
    const processor = jest.fn(async (batch: number[]) => {
      callCount++;
      if (callCount === 1) throw new Error('first batch failed');
      return batch.map((n) => n * 10);
    });

    const result = await processBatch(items, processor, {
      batchSize: 2,
      continueOnError: true,
    });

    expect(result.successful).toEqual([30, 40]);
    expect(result.totalFailed).toBe(2);
    expect(result.failed.length).toBe(2);
  });

  it('calls onProgress callback', async () => {
    const items = [1, 2, 3, 4, 5];
    const processor = jest.fn(async (batch: number[]) => batch);
    const onProgress = jest.fn();

    await processBatch(items, processor, { batchSize: 2, onProgress });

    expect(onProgress).toHaveBeenCalledTimes(3);
    expect(onProgress).toHaveBeenCalledWith(2, 5);
    expect(onProgress).toHaveBeenCalledWith(4, 5);
    expect(onProgress).toHaveBeenCalledWith(5, 5);
  });
});
