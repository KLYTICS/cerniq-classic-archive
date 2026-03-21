import { Logger } from '@nestjs/common';
import { QUEUE_NAMES, JOB_TYPES, QueueJobData, QueueJobResult } from './queue.config';

// ─── ALM Compute Queue Processor ────────────────────────────
// In production: @Processor(QUEUE_NAMES.ALM_COMPUTE) with @nestjs/bull
// For now: direct execution wrapper with progress tracking

const logger = new Logger('AlmComputeProcessor');

export interface ComputeJobProgress {
  jobId: string;
  jobType: string;
  progress: number; // 0-100
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

// Job tracking store (in production: Redis-backed)
const activeJobs = new Map<string, ComputeJobProgress>();

export function getJobStatus(jobId: string): ComputeJobProgress | null {
  return activeJobs.get(jobId) ?? null;
}

export function listActiveJobs(): ComputeJobProgress[] {
  return Array.from(activeJobs.values()).filter(j => j.status === 'running' || j.status === 'pending');
}

export async function enqueueComputeJob(
  jobId: string,
  jobType: string,
  executeFn: () => Promise<any>,
): Promise<string> {
  const job: ComputeJobProgress = {
    jobId,
    jobType,
    progress: 0,
    status: 'pending',
  };
  activeJobs.set(jobId, job);

  // Execute asynchronously
  setImmediate(async () => {
    job.status = 'running';
    job.startedAt = new Date().toISOString();

    try {
      // Simulate progress updates for long-running jobs
      const progressInterval = setInterval(() => {
        if (job.progress < 90) job.progress += 10;
      }, 500);

      const result = await executeFn();

      clearInterval(progressInterval);
      job.progress = 100;
      job.status = 'completed';
      job.result = result;
      job.completedAt = new Date().toISOString();
      logger.log(`Job ${jobId} (${jobType}) completed in ${Date.now() - new Date(job.startedAt!).getTime()}ms`);
    } catch (err: any) {
      job.status = 'failed';
      job.error = err.message;
      job.completedAt = new Date().toISOString();
      logger.error(`Job ${jobId} (${jobType}) failed: ${err.message}`);
    }

    // Cleanup old jobs after 1 hour
    setTimeout(() => activeJobs.delete(jobId), 3600000);
  });

  return jobId;
}
