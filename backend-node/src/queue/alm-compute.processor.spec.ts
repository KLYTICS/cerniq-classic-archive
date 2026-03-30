import {
  enqueueComputeJob,
  getJobStatus,
  listActiveJobs,
} from './alm-compute.processor';

describe('alm-compute.processor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('unrefs progress and cleanup timers while tracking a job', async () => {
    const progressTimer = { unref: jest.fn() } as unknown as NodeJS.Timeout;
    const cleanupTimer = { unref: jest.fn() } as unknown as NodeJS.Timeout;
    const setIntervalSpy = jest
      .spyOn(global, 'setInterval')
      .mockReturnValue(progressTimer);
    const setTimeoutSpy = jest
      .spyOn(global, 'setTimeout')
      .mockReturnValue(cleanupTimer);
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
    const setImmediateSpy = jest
      .spyOn(global, 'setImmediate')
      .mockImplementation((callback: (...args: any[]) => void) => {
        void callback();
        return {} as NodeJS.Immediate;
      });

    await enqueueComputeJob('job-1', 'stress-test', async () => ({
      ok: true,
    }));
    await Promise.resolve();

    expect((progressTimer as any).unref).toHaveBeenCalled();
    expect((cleanupTimer as any).unref).toHaveBeenCalled();
    expect(clearIntervalSpy).toHaveBeenCalledWith(progressTimer);
    expect(getJobStatus('job-1')?.status).toBe('completed');
    expect(listActiveJobs()).toEqual([]);

    setIntervalSpy.mockRestore();
    setTimeoutSpy.mockRestore();
    clearIntervalSpy.mockRestore();
    setImmediateSpy.mockRestore();
  });
});
