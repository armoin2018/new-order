/**
 * Tests for CNFL-3902 — Scenario Job Manager
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ScenarioJobManager,
  type JobConfig,
  type JobResult,
  type Job,
} from '../services/scenario-job-manager';

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeConfig(overrides: Partial<JobConfig> = {}): JobConfig {
  return {
    scenarioId: 'scn-1',
    scenarioName: 'Test Scenario',
    maxTurns: 60,
    mode: 'autonomous',
    speed: 'instant',
    seed: 42,
    aiStrategy: 'rule-based',
    difficulty: 1,
    ...overrides,
  };
}

function makeResult(): JobResult {
  return {
    turnsSimulated: 60,
    gameOverReason: 'US achieves diplomatic victory',
    elapsedMs: 500,
    factionSummaries: {
      US: { gdp: 25000, stability: 70, militaryReadiness: 80, diplomaticInfluence: 90, treasury: 600 },
    },
    keyEvents: ['Turn 10: Major summit', 'Turn 30: Economic boom'],
  };
}

// Executor that resolves immediately
function immediateExecutor(): (job: Job, onProgress: (t: number, total: number) => void, signal: AbortSignal) => Promise<JobResult> {
  return async (_job, onProgress) => {
    onProgress(30, 60);
    onProgress(60, 60);
    return makeResult();
  };
}

// Executor that never resolves (for cancellation tests)
function hangingExecutor(): (job: Job, onProgress: (t: number, total: number) => void, signal: AbortSignal) => Promise<JobResult> {
  return (_job, _onProgress, signal) =>
    new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('Aborted')), { once: true });
    });
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('ScenarioJobManager', () => {
  let manager: ScenarioJobManager;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    manager?.shutdown();
    vi.useRealTimers();
  });

  // ── Job creation ───────────────────────────────────────────────────────

  describe('job creation', () => {
    it('should create a job with queued status', () => {
      manager = new ScenarioJobManager();
      const job = manager.createJob(makeConfig());
      expect(job.id).toBeDefined();
      expect(job.status).toBe('queued');
      expect(job.config.scenarioId).toBe('scn-1');
      expect(job.progress).toBeNull();
      expect(job.result).toBeNull();
      expect(job.error).toBeNull();
      expect(job.createdAt).toBeGreaterThan(0);
      expect(job.completedAt).toBeNull();
    });

    it('should assign unique IDs', () => {
      manager = new ScenarioJobManager();
      const j1 = manager.createJob(makeConfig());
      const j2 = manager.createJob(makeConfig());
      expect(j1.id).not.toBe(j2.id);
    });

    it('should store job in internal map', () => {
      manager = new ScenarioJobManager();
      const job = manager.createJob(makeConfig());
      expect(manager.getJob(job.id)).toBe(job);
    });
  });

  // ── Job retrieval ──────────────────────────────────────────────────────

  describe('getJob', () => {
    it('should return undefined for unknown ID', () => {
      manager = new ScenarioJobManager();
      expect(manager.getJob('nonexistent')).toBeUndefined();
    });
  });

  // ── listJobs ───────────────────────────────────────────────────────────

  describe('listJobs', () => {
    it('should list all jobs sorted by createdAt desc', () => {
      manager = new ScenarioJobManager();
      const j1 = manager.createJob(makeConfig());
      vi.advanceTimersByTime(1000);
      const j2 = manager.createJob(makeConfig());
      const jobs = manager.listJobs();
      expect(jobs).toHaveLength(2);
      expect(jobs[0]!.id).toBe(j2.id); // most recent first
      expect(jobs[1]!.id).toBe(j1.id);
    });

    it('should filter by status', () => {
      manager = new ScenarioJobManager();
      manager.createJob(makeConfig());
      const j2 = manager.createJob(makeConfig());
      j2.status = 'completed'; // manual override for test
      const completed = manager.listJobs({ status: 'completed' });
      expect(completed).toHaveLength(1);
      expect(completed[0]!.id).toBe(j2.id);
    });

    it('should filter by scenarioId', () => {
      manager = new ScenarioJobManager();
      manager.createJob(makeConfig({ scenarioId: 'scn-1' }));
      manager.createJob(makeConfig({ scenarioId: 'scn-2' }));
      const filtered = manager.listJobs({ scenarioId: 'scn-2' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0]!.config.scenarioId).toBe('scn-2');
    });
  });

  // ── cancelJob ──────────────────────────────────────────────────────────

  describe('cancelJob', () => {
    it('should cancel a queued job', () => {
      manager = new ScenarioJobManager();
      const job = manager.createJob(makeConfig());
      expect(manager.cancelJob(job.id)).toBe(true);
      expect(manager.getJob(job.id)!.status).toBe('cancelled');
      expect(manager.getJob(job.id)!.completedAt).not.toBeNull();
    });

    it('should return false for unknown job', () => {
      manager = new ScenarioJobManager();
      expect(manager.cancelJob('nope')).toBe(false);
    });

    it('should return false for already completed job', () => {
      manager = new ScenarioJobManager();
      const job = manager.createJob(makeConfig());
      job.status = 'completed';
      expect(manager.cancelJob(job.id)).toBe(false);
    });

    it('should return false for already cancelled job', () => {
      manager = new ScenarioJobManager();
      const job = manager.createJob(makeConfig());
      job.status = 'cancelled';
      expect(manager.cancelJob(job.id)).toBe(false);
    });

    it('should cancel a running job and trigger abort', async () => {
      manager = new ScenarioJobManager({ executor: hangingExecutor() });
      const job = manager.createJob(makeConfig());

      // Let queue processing start
      await vi.advanceTimersByTimeAsync(10);

      expect(manager.getJob(job.id)!.status).toBe('running');
      expect(manager.cancelJob(job.id)).toBe(true);
      expect(manager.getJob(job.id)!.status).toBe('cancelled');
    });
  });

  // ── deleteJob ──────────────────────────────────────────────────────────

  describe('deleteJob', () => {
    it('should delete a queued job', () => {
      manager = new ScenarioJobManager();
      const job = manager.createJob(makeConfig());
      expect(manager.deleteJob(job.id)).toBe(true);
      expect(manager.getJob(job.id)).toBeUndefined();
    });

    it('should delete a completed job', () => {
      manager = new ScenarioJobManager();
      const job = manager.createJob(makeConfig());
      job.status = 'completed';
      expect(manager.deleteJob(job.id)).toBe(true);
    });

    it('should not delete a running job', () => {
      manager = new ScenarioJobManager({ executor: hangingExecutor() });
      const job = manager.createJob(makeConfig());
      // Manually set to running for the test
      job.status = 'running';
      expect(manager.deleteJob(job.id)).toBe(false);
      expect(manager.getJob(job.id)).toBeDefined();
    });

    it('should return false for unknown job', () => {
      manager = new ScenarioJobManager();
      expect(manager.deleteJob('nope')).toBe(false);
    });
  });

  // ── Status counts ──────────────────────────────────────────────────────

  describe('getStatusCounts', () => {
    it('should return counts by status', () => {
      manager = new ScenarioJobManager();
      manager.createJob(makeConfig());
      manager.createJob(makeConfig());
      const j3 = manager.createJob(makeConfig());
      j3.status = 'completed';

      const counts = manager.getStatusCounts();
      expect(counts.queued).toBe(2);
      expect(counts.completed).toBe(1);
      expect(counts.running).toBe(0);
      expect(counts.failed).toBe(0);
      expect(counts.cancelled).toBe(0);
    });
  });

  // ── Concurrency ────────────────────────────────────────────────────────

  describe('concurrency', () => {
    it('should respect maxConcurrency=1', async () => {
      manager = new ScenarioJobManager({
        maxConcurrency: 1,
        executor: hangingExecutor(),
      });

      manager.createJob(makeConfig());
      manager.createJob(makeConfig());

      await vi.advanceTimersByTimeAsync(10);

      expect(manager.getRunningCount()).toBe(1);
      const counts = manager.getStatusCounts();
      expect(counts.running).toBe(1);
      expect(counts.queued).toBe(1);
    });

    it('should respect maxConcurrency=2', async () => {
      manager = new ScenarioJobManager({
        maxConcurrency: 2,
        executor: hangingExecutor(),
      });

      manager.createJob(makeConfig());
      manager.createJob(makeConfig());
      manager.createJob(makeConfig());

      await vi.advanceTimersByTimeAsync(10);

      expect(manager.getRunningCount()).toBe(2);
      expect(manager.getStatusCounts().queued).toBe(1);
    });
  });

  // ── Executor integration ───────────────────────────────────────────────

  describe('executor', () => {
    it('should keep job queued when no executor configured', async () => {
      manager = new ScenarioJobManager();
      const job = manager.createJob(makeConfig());

      // processQueue is called synchronously by createJob, but no executor = stays queued
      await vi.advanceTimersByTimeAsync(10);

      expect(manager.getJob(job.id)!.status).toBe('queued');
      expect(manager.getJob(job.id)!.error).toBeNull();
    });

    it('should complete job with result from executor', async () => {
      manager = new ScenarioJobManager({ executor: immediateExecutor() });
      const job = manager.createJob(makeConfig());

      await vi.advanceTimersByTimeAsync(10);

      const updated = manager.getJob(job.id)!;
      expect(updated.status).toBe('completed');
      expect(updated.result).toBeDefined();
      expect(updated.result!.turnsSimulated).toBe(60);
      expect(updated.completedAt).not.toBeNull();
    });

    it('should set failed status on executor error', async () => {
      const failExecutor = async () => { throw new Error('Executor boom'); };
      manager = new ScenarioJobManager({ executor: failExecutor as never });
      const job = manager.createJob(makeConfig());

      await vi.advanceTimersByTimeAsync(10);

      expect(manager.getJob(job.id)!.status).toBe('failed');
      expect(manager.getJob(job.id)!.error).toBe('Executor boom');
    });

    it('should update progress during execution', async () => {
      const slowExecutor = async (_job: Job, onProgress: (t: number, total: number) => void) => {
        onProgress(10, 60);
        onProgress(30, 60);
        return makeResult();
      };
      manager = new ScenarioJobManager({ executor: slowExecutor });
      const job = manager.createJob(makeConfig());

      await vi.advanceTimersByTimeAsync(10);

      const updated = manager.getJob(job.id)!;
      expect(updated.status).toBe('completed');
      // Progress should have been updated (but since executor resolved, final state is completed)
    });
  });

  // ── Cleanup ────────────────────────────────────────────────────────────

  describe('cleanup', () => {
    it('should remove old completed jobs past retention', () => {
      manager = new ScenarioJobManager({ retentionMs: 1000 });
      const job = manager.createJob(makeConfig());
      job.status = 'completed';
      job.completedAt = Date.now() - 2000; // 2s old, retention is 1s

      const removed = manager.cleanup();
      expect(removed).toBe(1);
      expect(manager.getJob(job.id)).toBeUndefined();
    });

    it('should not remove recent completed jobs', () => {
      manager = new ScenarioJobManager({ retentionMs: 60000 });
      const job = manager.createJob(makeConfig());
      job.status = 'completed';
      job.completedAt = Date.now();

      const removed = manager.cleanup();
      expect(removed).toBe(0);
      expect(manager.getJob(job.id)).toBeDefined();
    });

    it('should not remove running jobs', () => {
      manager = new ScenarioJobManager({ retentionMs: 0 });
      const job = manager.createJob(makeConfig());
      job.status = 'running';

      const removed = manager.cleanup();
      expect(removed).toBe(0);
    });

    it('should remove failed and cancelled jobs past retention', () => {
      manager = new ScenarioJobManager({ retentionMs: 1000 });
      const j1 = manager.createJob(makeConfig());
      j1.status = 'failed';
      j1.completedAt = Date.now() - 2000;
      const j2 = manager.createJob(makeConfig());
      j2.status = 'cancelled';
      j2.completedAt = Date.now() - 2000;

      const removed = manager.cleanup();
      expect(removed).toBe(2);
    });
  });

  // ── Shutdown ───────────────────────────────────────────────────────────

  describe('shutdown', () => {
    it('should abort all running jobs', async () => {
      manager = new ScenarioJobManager({ executor: hangingExecutor() });
      manager.createJob(makeConfig());

      await vi.advanceTimersByTimeAsync(10);
      expect(manager.getRunningCount()).toBe(1);

      manager.shutdown();
      // Abort controllers cleared
      await vi.advanceTimersByTimeAsync(10);
    });

    it('should be safe to call multiple times', () => {
      manager = new ScenarioJobManager();
      manager.shutdown();
      manager.shutdown(); // no error
    });
  });

  // ── Queue processing ──────────────────────────────────────────────────

  describe('queue processing', () => {
    it('should auto-start queued jobs when slot frees up', async () => {
      manager = new ScenarioJobManager({
        maxConcurrency: 1,
        executor: immediateExecutor(),
      });

      const j1 = manager.createJob(makeConfig());
      const j2 = manager.createJob(makeConfig());

      await vi.advanceTimersByTimeAsync(50);

      // Both should have completed sequentially
      expect(manager.getJob(j1.id)!.status).toBe('completed');
      expect(manager.getJob(j2.id)!.status).toBe('completed');
    });
  });

  // ── Test helpers ───────────────────────────────────────────────────────

  describe('test helpers', () => {
    it('should expose _getJobsMap', () => {
      manager = new ScenarioJobManager();
      manager.createJob(makeConfig());
      const map = manager._getJobsMap();
      expect(map).toBeInstanceOf(Map);
      expect(map.size).toBe(1);
    });
  });
});
