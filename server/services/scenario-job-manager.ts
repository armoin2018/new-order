/**
 * CNFL-3902 — Scenario Execution Job Manager
 *
 * Manages async scenario execution jobs with configurable concurrency,
 * job lifecycle (queued → running → completed/failed), progress tracking,
 * job cancellation, result persistence, and automatic cleanup.
 */

import { v4 as uuid } from 'uuid';

// ─── Types ──────────────────────────────────────────────────────────────────

export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface JobConfig {
  scenarioId: string;
  scenarioName?: string;
  maxTurns: number;
  mode?: 'autonomous' | 'manual';
  speed?: 'instant' | 'accelerated' | 'realtime';
  seed?: number;
  aiStrategy?: 'rule-based' | 'random' | 'passive';
  difficulty?: number;
}

export interface JobProgress {
  currentTurn: number;
  totalTurns: number;
  percentComplete: number;
  estimatedRemainingMs: number | null;
  startedAt: number;
  lastUpdateAt: number;
}

export interface JobResult {
  turnsSimulated: number;
  gameOverReason: string | null;
  elapsedMs: number;
  /** Summary stats per faction at game end. */
  factionSummaries: Record<string, FactionSummary>;
  /** Key events during the run. */
  keyEvents: string[];
}

export interface FactionSummary {
  gdp: number;
  stability: number;
  militaryReadiness: number;
  diplomaticInfluence: number;
  treasury: number;
}

export interface Job {
  id: string;
  config: JobConfig;
  status: JobStatus;
  progress: JobProgress | null;
  result: JobResult | null;
  error: string | null;
  createdAt: number;
  completedAt: number | null;
}

export interface JobManagerConfig {
  /** Max concurrent running jobs. Default: 2. */
  maxConcurrency?: number;
  /** Auto-delete completed jobs after this many ms. Default: 24 hours. */
  retentionMs?: number;
  /** Callback to execute a scenario job. */
  executor?: (job: Job, onProgress: (turn: number, total: number) => void, signal: AbortSignal) => Promise<JobResult>;
}

// ─── Job Manager ────────────────────────────────────────────────────────────

export class ScenarioJobManager {
  private jobs = new Map<string, Job>();
  private abortControllers = new Map<string, AbortController>();
  private maxConcurrency: number;
  private retentionMs: number;
  private executor: JobManagerConfig['executor'];
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: JobManagerConfig = {}) {
    this.maxConcurrency = config.maxConcurrency ?? 2;
    this.retentionMs = config.retentionMs ?? 24 * 60 * 60 * 1000;
    this.executor = config.executor;

    // Auto-cleanup every 5 minutes
    this.cleanupTimer = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Create and enqueue a new job.
   */
  createJob(config: JobConfig): Job {
    const job: Job = {
      id: uuid(),
      config,
      status: 'queued',
      progress: null,
      result: null,
      error: null,
      createdAt: Date.now(),
      completedAt: null,
    };
    this.jobs.set(job.id, job);
    this.processQueue();
    return job;
  }

  /**
   * Get a job by ID.
   */
  getJob(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  /**
   * List all jobs, optionally filtered by status.
   */
  listJobs(filters?: { status?: JobStatus; scenarioId?: string }): Job[] {
    let jobs = Array.from(this.jobs.values());
    if (filters?.status) {
      jobs = jobs.filter((j) => j.status === filters.status);
    }
    if (filters?.scenarioId) {
      jobs = jobs.filter((j) => j.config.scenarioId === filters.scenarioId);
    }
    return jobs.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Cancel a queued or running job.
   */
  cancelJob(id: string): boolean {
    const job = this.jobs.get(id);
    if (!job) return false;
    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
      return false;
    }

    job.status = 'cancelled';
    job.completedAt = Date.now();

    // Abort running job
    const controller = this.abortControllers.get(id);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(id);
    }

    return true;
  }

  /**
   * Delete a completed/failed/cancelled job.
   */
  deleteJob(id: string): boolean {
    const job = this.jobs.get(id);
    if (!job) return false;
    if (job.status === 'running') return false;
    this.jobs.delete(id);
    return true;
  }

  /**
   * Get count of jobs in each status.
   */
  getStatusCounts(): Record<JobStatus, number> {
    const counts: Record<JobStatus, number> = {
      queued: 0,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    };
    for (const job of this.jobs.values()) {
      counts[job.status]++;
    }
    return counts;
  }

  /**
   * Get running job count.
   */
  getRunningCount(): number {
    return Array.from(this.jobs.values()).filter((j) => j.status === 'running').length;
  }

  /**
   * Cleanup old completed/failed/cancelled jobs past retention period.
   */
  cleanup(): number {
    const cutoff = Date.now() - this.retentionMs;
    let removed = 0;
    for (const [id, job] of this.jobs.entries()) {
      if (
        (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') &&
        job.completedAt !== null &&
        job.completedAt < cutoff
      ) {
        this.jobs.delete(id);
        removed++;
      }
    }
    return removed;
  }

  /**
   * Shutdown — cancel running jobs and clear timers.
   */
  shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    for (const controller of this.abortControllers.values()) {
      controller.abort();
    }
    this.abortControllers.clear();
  }

  /**
   * Process the queue: start queued jobs up to concurrency limit.
   */
  private processQueue(): void {
    if (!this.executor) return; // No executor — keep jobs queued
    const running = this.getRunningCount();
    const available = this.maxConcurrency - running;
    if (available <= 0) return;

    const queued = Array.from(this.jobs.values())
      .filter((j) => j.status === 'queued')
      .sort((a, b) => a.createdAt - b.createdAt);

    for (let i = 0; i < Math.min(available, queued.length); i++) {
      this.startJob(queued[i]!);
    }
  }

  /**
   * Start executing a job.
   */
  private async startJob(job: Job): Promise<void> {
    if (!this.executor) {
      job.status = 'failed';
      job.error = 'No executor configured';
      job.completedAt = Date.now();
      return;
    }

    job.status = 'running';
    job.progress = {
      currentTurn: 0,
      totalTurns: job.config.maxTurns,
      percentComplete: 0,
      estimatedRemainingMs: null,
      startedAt: Date.now(),
      lastUpdateAt: Date.now(),
    };

    const controller = new AbortController();
    this.abortControllers.set(job.id, controller);

    const onProgress = (turn: number, total: number) => {
      if (job.progress) {
        const elapsed = Date.now() - job.progress.startedAt;
        const avgPerTurn = elapsed / turn;
        job.progress.currentTurn = turn;
        job.progress.totalTurns = total;
        job.progress.percentComplete = Math.round((turn / total) * 100);
        job.progress.estimatedRemainingMs = Math.round(avgPerTurn * (total - turn));
        job.progress.lastUpdateAt = Date.now();
      }
    };

    try {
      const result = await this.executor(job, onProgress, controller.signal);
      if (job.status === 'cancelled') return; // was cancelled during execution
      job.status = 'completed';
      job.result = result;
      job.completedAt = Date.now();
    } catch (err) {
      if (job.status === 'cancelled') return;
      job.status = 'failed';
      job.error = (err as Error).message;
      job.completedAt = Date.now();
    } finally {
      this.abortControllers.delete(job.id);
      // Process queue to start next job
      this.processQueue();
    }
  }

  // ── Test helpers ──────────────────────────────────────────────────────────

  /** @internal — for testing only */
  _getJobsMap(): Map<string, Job> {
    return this.jobs;
  }
}
