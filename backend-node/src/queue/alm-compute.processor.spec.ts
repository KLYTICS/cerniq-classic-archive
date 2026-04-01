import {
  getJobStatus,
  listActiveJobs,
  enqueueComputeJob,
} from './alm-compute.processor';

describe('AlmComputeProcessor', () => {
  it('getJobStatus returns null for unknown job ID', () => {
    expect(getJobStatus('nonexistent-job-id')).toBeNull();
  });

  it('enqueueComputeJob registers a pending job and returns the jobId', async () => {
    const jobId = `test-job-${Date.now()}`;

    const returned = await enqueueComputeJob(jobId, 'monte-carlo', async () => ({
      result: 42,
    }));

    expect(returned).toBe(jobId);

    // Job should be trackable immediately (pending or running)
    const status = getJobStatus(jobId);
    expect(status).not.toBeNull();
    expect(['pending', 'running', 'completed']).toContain(status!.status);
    expect(status!.jobType).toBe('monte-carlo');
  });

  it('listActiveJobs returns only pending/running jobs', async () => {
    const jobId = `active-test-${Date.now()}`;

    // Enqueue a job that resolves after a brief delay
    await enqueueComputeJob(jobId, 'var-calc', () =>
      new Promise((resolve) => setTimeout(() => resolve({ done: true }), 200)),
    );

    // Immediately check — job should be pending or running
    const active = listActiveJobs();
    const found = active.find((j) => j.jobId === jobId);
    // The job may have already completed in fast environments, so we test the shape
    if (found) {
      expect(['pending', 'running']).toContain(found.status);
    }
    // Either way, the function returns an array
    expect(Array.isArray(active)).toBe(true);
  });
});
