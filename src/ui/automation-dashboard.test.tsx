/**
 * CNFL-3904 — AutomationDashboard · Component Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

import { AutomationDashboard } from '@/ui/AutomationDashboard';
import type {
  AutomationDashboardProps,
  ScenarioOption,
  ActiveJob,
  CompletedRun,
} from '@/ui/AutomationDashboard';
import type { Root } from 'react-dom/client';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
});

function render(props?: Partial<AutomationDashboardProps>): void {
  const defaults: AutomationDashboardProps = { scenarios: SCENARIOS, ...props };
  act(() => { root.render(createElement(AutomationDashboard, defaults)); });
}

function testId(id: string): HTMLElement | null {
  return container.querySelector(`[data-testid="${id}"]`);
}

function click(el: HTMLElement): void {
  act(() => { el.click(); });
}

function setInputValue(el: HTMLInputElement, val: string): void {
  act(() => {
    const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    nativeSet.call(el, val);
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function setSelectValue(el: HTMLSelectElement, val: string): void {
  act(() => {
    const nativeSet = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!;
    nativeSet.call(el, val);
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

const SCENARIOS: ScenarioOption[] = [
  { id: 'cold-war', name: 'Cold War Redux', description: 'Superpower tensions in the modern era', maxTurns: 60 },
  { id: 'trade-war', name: 'Trade War', description: 'Economic conflict between major powers', maxTurns: 40 },
  { id: 'crisis', name: 'Taiwan Crisis', maxTurns: 30 },
];

const ACTIVE_JOBS: ActiveJob[] = [
  {
    id: 'job-1',
    scenarioName: 'Cold War Redux',
    status: 'running',
    currentTurn: 25,
    totalTurns: 60,
    percentComplete: 42,
    elapsedMs: 3000,
    estimatedRemainingMs: 4200,
  },
  {
    id: 'job-2',
    scenarioName: 'Trade War',
    status: 'queued',
    currentTurn: 0,
    totalTurns: 40,
    percentComplete: 0,
    elapsedMs: 0,
    estimatedRemainingMs: null,
  },
];

const COMPLETED_RUNS: CompletedRun[] = [
  {
    id: 'run-1',
    scenarioName: 'Cold War Redux',
    turnsPlayed: 60,
    winner: 'US',
    elapsedMs: 8000,
    seed: 42,
    completedAt: Date.now() - 60000,
    grade: 'A',
  },
  {
    id: 'run-2',
    scenarioName: 'Trade War',
    turnsPlayed: 35,
    winner: null,
    elapsedMs: 5000,
    seed: 99,
    completedAt: Date.now() - 30000,
    grade: 'C',
  },
];

// ── Tests ───────────────────────────────────────────────────────────────────

describe('AutomationDashboard', () => {
  // ── Rendering ──────────────────────────────────────────────────────────

  describe('rendering', () => {
    it('renders the dashboard root', () => {
      render();
      expect(testId('automation-dashboard')).not.toBeNull();
    });

    it('renders config section', () => {
      render();
      expect(testId('config-section')).not.toBeNull();
    });

    it('renders active jobs section', () => {
      render();
      expect(testId('active-jobs')).not.toBeNull();
    });

    it('renders completed runs section', () => {
      render();
      expect(testId('completed-runs')).not.toBeNull();
    });

    it('renders scenario select with options', () => {
      render();
      const select = testId('scenario-select') as HTMLSelectElement;
      expect(select).not.toBeNull();
      expect(select.options.length).toBe(3);
    });

    it('renders run button', () => {
      render();
      expect(testId('run-btn')).not.toBeNull();
    });
  });

  // ── Config section ─────────────────────────────────────────────────────

  describe('config section', () => {
    it('should show scenario description', () => {
      render();
      const desc = testId('scenario-desc');
      expect(desc).not.toBeNull();
      expect(desc!.textContent).toContain('Superpower tensions');
    });

    it('should update maxTurns when scenario changes', () => {
      render();
      const select = testId('scenario-select') as HTMLSelectElement;
      setSelectValue(select, 'trade-war');
      const turnsInput = testId('turns-input') as HTMLInputElement;
      expect(turnsInput.value).toBe('40');
    });

    it('should fallback to name + turns when no description', () => {
      render();
      const select = testId('scenario-select') as HTMLSelectElement;
      setSelectValue(select, 'crisis');
      const desc = testId('scenario-desc');
      expect(desc!.textContent).toContain('Taiwan Crisis');
      expect(desc!.textContent).toContain('30 turns');
    });

    it('should show batch count in run button when > 1', () => {
      render();
      const batchInput = testId('batch-input') as HTMLInputElement;
      setInputValue(batchInput, '5');
      const btn = testId('run-btn')!;
      expect(btn.textContent).toContain('5 Simulations');
    });

    it('should show "Run Scenario" when batch count is 1', () => {
      render();
      const btn = testId('run-btn')!;
      expect(btn.textContent).toBe('Run Scenario');
    });

    it('should have all config controls', () => {
      render();
      expect(testId('scenario-select')).not.toBeNull();
      expect(testId('turns-input')).not.toBeNull();
      expect(testId('mode-select')).not.toBeNull();
      expect(testId('speed-select')).not.toBeNull();
      expect(testId('strategy-select')).not.toBeNull();
      expect(testId('difficulty-input')).not.toBeNull();
      expect(testId('seed-input')).not.toBeNull();
      expect(testId('batch-input')).not.toBeNull();
    });
  });

  // ── Run button callback ────────────────────────────────────────────────

  describe('onRunScenario', () => {
    it('should call onRunScenario with config', () => {
      const onRun = vi.fn();
      render({ onRunScenario: onRun });
      click(testId('run-btn')!);
      expect(onRun).toHaveBeenCalledTimes(1);
      const arg = onRun.mock.calls[0]![0];
      expect(arg.scenarioId).toBe('cold-war');
      expect(arg.maxTurns).toBe(60);
      expect(arg.mode).toBe('autonomous');
      expect(arg.speed).toBe('instant');
      expect(arg.aiStrategy).toBe('rule-based');
    });

    it('should pass null seed when seed is empty', () => {
      const onRun = vi.fn();
      render({ onRunScenario: onRun });
      click(testId('run-btn')!);
      expect(onRun.mock.calls[0]![0].seed).toBeNull();
    });

    it('should pass numeric seed when provided', () => {
      const onRun = vi.fn();
      render({ onRunScenario: onRun });
      const seedInput = testId('seed-input') as HTMLInputElement;
      setInputValue(seedInput, '42');
      click(testId('run-btn')!);
      expect(onRun.mock.calls[0]![0].seed).toBe(42);
    });

    it('should respect updated config values', () => {
      const onRun = vi.fn();
      render({ onRunScenario: onRun });
      setSelectValue(testId('mode-select') as HTMLSelectElement, 'manual');
      setSelectValue(testId('speed-select') as HTMLSelectElement, 'realtime');
      setSelectValue(testId('strategy-select') as HTMLSelectElement, 'random');
      click(testId('run-btn')!);
      const arg = onRun.mock.calls[0]![0];
      expect(arg.mode).toBe('manual');
      expect(arg.speed).toBe('realtime');
      expect(arg.aiStrategy).toBe('random');
    });
  });

  // ── Active jobs ────────────────────────────────────────────────────────

  describe('active jobs', () => {
    it('should show "No active jobs" when empty', () => {
      render({ activeJobs: [] });
      const section = testId('active-jobs')!;
      expect(section.textContent).toContain('No active jobs');
    });

    it('should render active job rows', () => {
      render({ activeJobs: ACTIVE_JOBS });
      expect(testId('job-job-1')).not.toBeNull();
      expect(testId('job-job-2')).not.toBeNull();
    });

    it('should show progress percentage', () => {
      render({ activeJobs: ACTIVE_JOBS });
      const row = testId('job-job-1')!;
      expect(row.textContent).toContain('42%');
      expect(row.textContent).toContain('Turn 25/60');
    });

    it('should show cancel button for running jobs', () => {
      const onCancel = vi.fn();
      render({ activeJobs: ACTIVE_JOBS, onCancelJob: onCancel });
      const cancelBtn = testId('cancel-job-1');
      expect(cancelBtn).not.toBeNull();
    });

    it('should show cancel button for queued jobs', () => {
      const onCancel = vi.fn();
      render({ activeJobs: ACTIVE_JOBS, onCancelJob: onCancel });
      const cancelBtn = testId('cancel-job-2');
      expect(cancelBtn).not.toBeNull();
    });

    it('should call onCancelJob when cancel clicked', () => {
      const onCancel = vi.fn();
      render({ activeJobs: ACTIVE_JOBS, onCancelJob: onCancel });
      click(testId('cancel-job-1')!);
      expect(onCancel).toHaveBeenCalledWith('job-1');
    });

    it('should show ETA when available', () => {
      render({ activeJobs: ACTIVE_JOBS });
      const row = testId('job-job-1')!;
      expect(row.textContent).toContain('ETA');
    });

    it('should show job count in header', () => {
      render({ activeJobs: ACTIVE_JOBS });
      const section = testId('active-jobs')!;
      expect(section.textContent).toContain('Active Jobs (2)');
    });
  });

  // ── Completed runs ─────────────────────────────────────────────────────

  describe('completed runs', () => {
    it('should show "No completed runs" when empty', () => {
      render({ completedRuns: [] });
      const section = testId('completed-runs')!;
      expect(section.textContent).toContain('No completed runs');
    });

    it('should render completed run rows', () => {
      render({ completedRuns: COMPLETED_RUNS });
      expect(testId('run-run-1')).not.toBeNull();
      expect(testId('run-run-2')).not.toBeNull();
    });

    it('should show winner name or N/A', () => {
      render({ completedRuns: COMPLETED_RUNS });
      const run1 = testId('run-run-1')!;
      const run2 = testId('run-run-2')!;
      expect(run1.textContent).toContain('US');
      expect(run2.textContent).toContain('N/A');
    });

    it('should show grade badges', () => {
      render({ completedRuns: COMPLETED_RUNS });
      const run1 = testId('run-run-1')!;
      expect(run1.textContent).toContain('A');
    });

    it('should show view button when onViewResults provided', () => {
      const onView = vi.fn();
      render({ completedRuns: COMPLETED_RUNS, onViewResults: onView });
      const viewBtn = testId('view-run-1');
      expect(viewBtn).not.toBeNull();
    });

    it('should call onViewResults when clicked', () => {
      const onView = vi.fn();
      render({ completedRuns: COMPLETED_RUNS, onViewResults: onView });
      click(testId('view-run-1')!);
      expect(onView).toHaveBeenCalledWith('run-1');
    });

    it('should show export button when onExportResults provided', () => {
      const onExport = vi.fn();
      render({ completedRuns: COMPLETED_RUNS, onExportResults: onExport });
      expect(testId('export-run-1')).not.toBeNull();
    });

    it('should call onExportResults with json format', () => {
      const onExport = vi.fn();
      render({ completedRuns: COMPLETED_RUNS, onExportResults: onExport });
      click(testId('export-run-1')!);
      expect(onExport).toHaveBeenCalledWith('run-1', 'json');
    });

    it('should show run count in header', () => {
      render({ completedRuns: COMPLETED_RUNS });
      const section = testId('completed-runs')!;
      expect(section.textContent).toContain('Completed Runs (2)');
    });
  });

  // ── Run comparison ─────────────────────────────────────────────────────

  describe('run comparison', () => {
    it('should not show compare button with < 2 selected', () => {
      render({ completedRuns: COMPLETED_RUNS, onCompareRuns: vi.fn() });
      expect(testId('compare-btn')).toBeNull();
    });

    it('should show compare button after selecting 2 runs', () => {
      const onCompare = vi.fn();
      render({ completedRuns: COMPLETED_RUNS, onCompareRuns: onCompare });

      // Check the checkboxes
      const checkboxes = container.querySelectorAll('input[type="checkbox"]');
      click(checkboxes[0] as HTMLElement);
      click(checkboxes[1] as HTMLElement);

      expect(testId('compare-btn')).not.toBeNull();
      expect(testId('compare-btn')!.textContent).toContain('Compare 2 Runs');
    });

    it('should call onCompareRuns with selected IDs', () => {
      const onCompare = vi.fn();
      render({ completedRuns: COMPLETED_RUNS, onCompareRuns: onCompare });

      const checkboxes = container.querySelectorAll('input[type="checkbox"]');
      click(checkboxes[0] as HTMLElement);
      click(checkboxes[1] as HTMLElement);
      click(testId('compare-btn')!);

      expect(onCompare).toHaveBeenCalledTimes(1);
      const ids = onCompare.mock.calls[0]![0] as string[];
      expect(ids).toHaveLength(2);
      expect(ids).toContain('run-1');
      expect(ids).toContain('run-2');
    });

    it('should toggle selection on/off', () => {
      const onCompare = vi.fn();
      render({ completedRuns: COMPLETED_RUNS, onCompareRuns: onCompare });

      const checkboxes = container.querySelectorAll('input[type="checkbox"]');
      click(checkboxes[0] as HTMLElement);
      click(checkboxes[1] as HTMLElement);
      expect(testId('compare-btn')).not.toBeNull();

      // Deselect one
      click(checkboxes[0] as HTMLElement);
      expect(testId('compare-btn')).toBeNull();
    });
  });

  // ── Empty scenarios ────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle empty scenarios list', () => {
      render({ scenarios: [] });
      const select = testId('scenario-select') as HTMLSelectElement;
      expect(select.options.length).toBe(0);
    });

    it('should not crash with undefined callbacks', () => {
      render({
        activeJobs: ACTIVE_JOBS,
        completedRuns: COMPLETED_RUNS,
        onRunScenario: undefined,
        onCancelJob: undefined,
        onViewResults: undefined,
        onExportResults: undefined,
      });
      // Should render without errors
      expect(testId('automation-dashboard')).not.toBeNull();
    });
  });
});
