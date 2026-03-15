/**
 * Queue-Based Scenario Runner Engine — Test Suite
 *
 * 60+ Vitest tests covering all 14 pure functions in queue-engine.ts.
 *
 * @see FR-4401 — Queue management
 * @see FR-4402 — Batch creation
 * @see FR-4403 — Concurrency control
 * @see FR-4404 — Progress tracking
 * @see FR-4405 — Batch analysis
 */

import { describe, it, expect } from 'vitest';
import {
  initializeQueueState,
  generateQueueItemId,
  addToQueue,
  removeFromQueue,
  reorderQueue,
  createBatch,
  getNextExecutableItems,
  updateItemProgress,
  transitionItemStatus,
  computeProgress,
  generateBatchAnalysis,
  computeNaturalAdvantage,
  getQueueStats,
  canAddToQueue,
} from '@/engine/queue-engine';
import type {
  QueueItemId,
  QueueItem,
  QueueItemStatus,
  SharedScenarioParams,
  ScenarioQueueState,
} from '@/data/types/queue.types';
import { queueConfig } from '@/engine/config/queue';

// ── Test Helpers ────────────────────────────────────────────────────────────

const DEFAULT_PARAMS: SharedScenarioParams = {
  totalTurns: 30,
  aiProvider: 'internal',
  turnDurationUnit: 'month',
  victoryConditions: ['economic-dominance'],
};

function buildItem(overrides: Partial<QueueItem> = {}): QueueItem {
  return {
    id: generateQueueItemId(),
    scenarioName: 'Test Scenario',
    playerFaction: 'USA',
    position: 0,
    status: 'queued',
    currentTurn: 0,
    totalTurns: 30,
    startedAt: null,
    completedAt: null,
    compositeScore: null,
    batchId: null,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 1 — initializeQueueState
// ═══════════════════════════════════════════════════════════════════════════

describe('initializeQueueState', () => {
  it('should return an empty state with default concurrency', () => {
    const state = initializeQueueState();
    expect(state.items).toEqual([]);
    expect(state.batches).toEqual([]);
    expect(state.isRunning).toBe(false);
    expect(state.activeItemIds).toEqual([]);
    expect(state.completedAnalyses).toEqual([]);
  });

  it('should use defaultParallel from config when no override given', () => {
    const state = initializeQueueState();
    expect(state.concurrency.maxParallel).toBe(queueConfig.concurrency.defaultParallel);
  });

  it('should accept partial concurrency overrides', () => {
    const state = initializeQueueState({ maxParallel: 3 });
    expect(state.concurrency.maxParallel).toBe(3);
    expect(state.concurrency.resourceThresholdPct).toBe(
      queueConfig.concurrency.resourceThresholdPct,
    );
  });

  it('should override resourceThresholdPct', () => {
    const state = initializeQueueState({ resourceThresholdPct: 50 });
    expect(state.concurrency.resourceThresholdPct).toBe(50);
  });

  it('should override fallbackToSequential', () => {
    const state = initializeQueueState({ fallbackToSequential: false });
    expect(state.concurrency.fallbackToSequential).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2 — generateQueueItemId
// ═══════════════════════════════════════════════════════════════════════════

describe('generateQueueItemId', () => {
  it('should return a string starting with qi_', () => {
    const id = generateQueueItemId();
    expect(id).toMatch(/^qi_\d+_[0-9a-f]{8}$/);
  });

  it('should generate unique IDs', () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateQueueItemId()));
    expect(ids.size).toBe(50);
  });

  it('should be a branded QueueItemId type', () => {
    const id: QueueItemId = generateQueueItemId();
    expect(typeof id).toBe('string');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3 — addToQueue
// ═══════════════════════════════════════════════════════════════════════════

describe('addToQueue', () => {
  it('should add an item to an empty queue', () => {
    const state = initializeQueueState();
    const next = addToQueue(state, 'Cold War', 'USA', 30);
    expect(next.items).toHaveLength(1);
    expect(next.items[0].scenarioName).toBe('Cold War');
    expect(next.items[0].playerFaction).toBe('USA');
    expect(next.items[0].totalTurns).toBe(30);
  });

  it('should set position to the end of the queue', () => {
    let state = initializeQueueState();
    state = addToQueue(state, 'S1', 'USA', 20);
    state = addToQueue(state, 'S2', 'China', 20);
    expect(state.items[1].position).toBe(1);
  });

  it('should default status to queued', () => {
    const state = addToQueue(initializeQueueState(), 'S1', 'USA', 10);
    expect(state.items[0].status).toBe('queued');
  });

  it('should default batchId to null when not provided', () => {
    const state = addToQueue(initializeQueueState(), 'S1', 'USA', 10);
    expect(state.items[0].batchId).toBeNull();
  });

  it('should set batchId when provided', () => {
    const state = addToQueue(initializeQueueState(), 'S1', 'USA', 10, 'batch_1');
    expect(state.items[0].batchId).toBe('batch_1');
  });

  it('should initialise currentTurn to 0', () => {
    const state = addToQueue(initializeQueueState(), 'S1', 'USA', 10);
    expect(state.items[0].currentTurn).toBe(0);
  });

  it('should initialise timestamps to null', () => {
    const state = addToQueue(initializeQueueState(), 'S1', 'USA', 10);
    expect(state.items[0].startedAt).toBeNull();
    expect(state.items[0].completedAt).toBeNull();
  });

  it('should not mutate the original state', () => {
    const state = initializeQueueState();
    const next = addToQueue(state, 'S1', 'USA', 10);
    expect(state.items).toHaveLength(0);
    expect(next.items).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4 — removeFromQueue
// ═══════════════════════════════════════════════════════════════════════════

describe('removeFromQueue', () => {
  it('should remove a queued item', () => {
    let state = initializeQueueState();
    state = addToQueue(state, 'S1', 'USA', 10);
    const itemId = state.items[0].id;
    const next = removeFromQueue(state, itemId);
    expect(next.items).toHaveLength(0);
  });

  it('should renumber positions after removal', () => {
    let state = initializeQueueState();
    state = addToQueue(state, 'S1', 'USA', 10);
    state = addToQueue(state, 'S2', 'China', 10);
    state = addToQueue(state, 'S3', 'Russia', 10);
    const next = removeFromQueue(state, state.items[0].id);
    expect(next.items[0].position).toBe(0);
    expect(next.items[1].position).toBe(1);
  });

  it('should throw if item does not exist', () => {
    const state = initializeQueueState();
    expect(() => removeFromQueue(state, 'qi_fake_id' as QueueItemId)).toThrow(
      'Queue item not found',
    );
  });

  it('should throw if item is running', () => {
    let state = initializeQueueState();
    state = addToQueue(state, 'S1', 'USA', 10);
    state = transitionItemStatus(state, state.items[0].id, 'running');
    expect(() => removeFromQueue(state, state.items[0].id)).toThrow(
      "Cannot remove item in 'running' status",
    );
  });

  it('should throw if item is paused', () => {
    let state = initializeQueueState();
    state = addToQueue(state, 'S1', 'USA', 10);
    state = transitionItemStatus(state, state.items[0].id, 'running');
    state = transitionItemStatus(state, state.items[0].id, 'paused');
    expect(() => removeFromQueue(state, state.items[0].id)).toThrow(
      "Cannot remove item in 'paused' status",
    );
  });

  it('should allow removal of completed items', () => {
    let state = initializeQueueState();
    state = addToQueue(state, 'S1', 'USA', 10);
    state = transitionItemStatus(state, state.items[0].id, 'running');
    state = transitionItemStatus(state, state.items[0].id, 'completed');
    const next = removeFromQueue(state, state.items[0].id);
    expect(next.items).toHaveLength(0);
  });

  it('should allow removal of failed items', () => {
    let state = initializeQueueState();
    state = addToQueue(state, 'S1', 'USA', 10);
    state = transitionItemStatus(state, state.items[0].id, 'running');
    state = transitionItemStatus(state, state.items[0].id, 'failed');
    const next = removeFromQueue(state, state.items[0].id);
    expect(next.items).toHaveLength(0);
  });

  it('should allow removal of stopped items', () => {
    let state = initializeQueueState();
    state = addToQueue(state, 'S1', 'USA', 10);
    state = transitionItemStatus(state, state.items[0].id, 'stopped');
    const next = removeFromQueue(state, state.items[0].id);
    expect(next.items).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5 — reorderQueue
// ═══════════════════════════════════════════════════════════════════════════

describe('reorderQueue', () => {
  it('should move an item from position 0 to position 2', () => {
    let state = initializeQueueState();
    state = addToQueue(state, 'S1', 'USA', 10);
    state = addToQueue(state, 'S2', 'China', 10);
    state = addToQueue(state, 'S3', 'Russia', 10);
    const next = reorderQueue(state, state.items[0].id, 2);
    expect(next.items[0].scenarioName).toBe('S2');
    expect(next.items[1].scenarioName).toBe('S3');
    expect(next.items[2].scenarioName).toBe('S1');
  });

  it('should move an item from position 2 to position 0', () => {
    let state = initializeQueueState();
    state = addToQueue(state, 'S1', 'USA', 10);
    state = addToQueue(state, 'S2', 'China', 10);
    state = addToQueue(state, 'S3', 'Russia', 10);
    const next = reorderQueue(state, state.items[2].id, 0);
    expect(next.items[0].scenarioName).toBe('S3');
    expect(next.items[2].scenarioName).toBe('S2');
  });

  it('should renumber all positions after reorder', () => {
    let state = initializeQueueState();
    state = addToQueue(state, 'S1', 'USA', 10);
    state = addToQueue(state, 'S2', 'China', 10);
    state = addToQueue(state, 'S3', 'Russia', 10);
    const next = reorderQueue(state, state.items[2].id, 0);
    next.items.forEach((item, idx) => {
      expect(item.position).toBe(idx);
    });
  });

  it('should clamp position to the valid range', () => {
    let state = initializeQueueState();
    state = addToQueue(state, 'S1', 'USA', 10);
    state = addToQueue(state, 'S2', 'China', 10);
    const next = reorderQueue(state, state.items[0].id, 999);
    expect(next.items[1].scenarioName).toBe('S1');
  });

  it('should clamp negative positions to 0', () => {
    let state = initializeQueueState();
    state = addToQueue(state, 'S1', 'USA', 10);
    state = addToQueue(state, 'S2', 'China', 10);
    const next = reorderQueue(state, state.items[1].id, -5);
    expect(next.items[0].scenarioName).toBe('S2');
  });

  it('should throw if item is not found', () => {
    const state = initializeQueueState();
    expect(() => reorderQueue(state, 'qi_fake' as QueueItemId, 0)).toThrow(
      'Queue item not found',
    );
  });

  it('should not mutate original state', () => {
    let state = initializeQueueState();
    state = addToQueue(state, 'S1', 'USA', 10);
    state = addToQueue(state, 'S2', 'China', 10);
    const originalFirst = state.items[0].scenarioName;
    reorderQueue(state, state.items[1].id, 0);
    expect(state.items[0].scenarioName).toBe(originalFirst);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6 — createBatch
// ═══════════════════════════════════════════════════════════════════════════

describe('createBatch', () => {
  it('should create a batch with the correct number of items', () => {
    const { batch, items } = createBatch(['USA', 'China', 'Russia'], DEFAULT_PARAMS);
    expect(items).toHaveLength(3);
    expect(batch.factions).toEqual(['USA', 'China', 'Russia']);
  });

  it('should assign the batch ID to all items', () => {
    const { batch, items } = createBatch(['USA', 'China'], DEFAULT_PARAMS);
    for (const item of items) {
      expect(item.batchId).toBe(batch.id);
    }
  });

  it('should generate unique item IDs within a batch', () => {
    const { items } = createBatch(['USA', 'China', 'Russia', 'EU'], DEFAULT_PARAMS);
    const ids = new Set(items.map((i) => i.id));
    expect(ids.size).toBe(4);
  });

  it('should set correct positions for each item', () => {
    const { items } = createBatch(['USA', 'China', 'Russia'], DEFAULT_PARAMS);
    items.forEach((item, idx) => {
      expect(item.position).toBe(idx);
    });
  });

  it('should use provided batch name', () => {
    const { batch } = createBatch(['USA'], DEFAULT_PARAMS, 'My Batch');
    expect(batch.name).toBe('My Batch');
  });

  it('should generate a default name when none is provided', () => {
    const { batch } = createBatch(['USA'], DEFAULT_PARAMS);
    expect(batch.name).toContain('Batch');
  });

  it('should apply shared params to item totalTurns', () => {
    const { items } = createBatch(['USA'], { ...DEFAULT_PARAMS, totalTurns: 50 });
    expect(items[0].totalTurns).toBe(50);
  });

  it('should set all items to queued status', () => {
    const { items } = createBatch(['USA', 'China'], DEFAULT_PARAMS);
    for (const item of items) {
      expect(item.status).toBe('queued');
    }
  });

  it('should store shared params in the batch config', () => {
    const { batch } = createBatch(['USA'], DEFAULT_PARAMS);
    expect(batch.sharedParams.totalTurns).toBe(30);
    expect(batch.sharedParams.aiProvider).toBe('internal');
  });

  it('should set createdAt to an ISO timestamp', () => {
    const { batch } = createBatch(['USA'], DEFAULT_PARAMS);
    expect(() => new Date(batch.createdAt)).not.toThrow();
    expect(new Date(batch.createdAt).toISOString()).toBe(batch.createdAt);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7 — getNextExecutableItems
// ═══════════════════════════════════════════════════════════════════════════

describe('getNextExecutableItems', () => {
  it('should return empty array when no items are queued', () => {
    const state = initializeQueueState();
    expect(getNextExecutableItems(state)).toEqual([]);
  });

  it('should return first queued item when maxParallel is 1', () => {
    let state = initializeQueueState({ maxParallel: 1 });
    state = addToQueue(state, 'S1', 'USA', 10);
    state = addToQueue(state, 'S2', 'China', 10);
    const next = getNextExecutableItems(state);
    expect(next).toHaveLength(1);
    expect(next[0].scenarioName).toBe('S1');
  });

  it('should respect maxParallel limit', () => {
    let state = initializeQueueState({ maxParallel: 2 });
    state = addToQueue(state, 'S1', 'USA', 10);
    state = addToQueue(state, 'S2', 'China', 10);
    state = addToQueue(state, 'S3', 'Russia', 10);
    const next = getNextExecutableItems(state);
    expect(next).toHaveLength(2);
  });

  it('should account for already running items', () => {
    let state = initializeQueueState({ maxParallel: 2 });
    state = addToQueue(state, 'S1', 'USA', 10);
    state = addToQueue(state, 'S2', 'China', 10);
    state = addToQueue(state, 'S3', 'Russia', 10);
    state = transitionItemStatus(state, state.items[0].id, 'running');
    const next = getNextExecutableItems(state);
    expect(next).toHaveLength(1);
    expect(next[0].scenarioName).toBe('S2');
  });

  it('should return empty when all slots are occupied', () => {
    let state = initializeQueueState({ maxParallel: 1 });
    state = addToQueue(state, 'S1', 'USA', 10);
    state = addToQueue(state, 'S2', 'China', 10);
    state = transitionItemStatus(state, state.items[0].id, 'running');
    const next = getNextExecutableItems(state);
    expect(next).toHaveLength(0);
  });

  it('should sort by position', () => {
    let state = initializeQueueState({ maxParallel: 3 });
    state = addToQueue(state, 'S1', 'USA', 10);
    state = addToQueue(state, 'S2', 'China', 10);
    state = addToQueue(state, 'S3', 'Russia', 10);
    state = reorderQueue(state, state.items[2].id, 0);
    const next = getNextExecutableItems(state);
    expect(next[0].scenarioName).toBe('S3');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8 — updateItemProgress
// ═══════════════════════════════════════════════════════════════════════════

describe('updateItemProgress', () => {
  it('should update currentTurn', () => {
    let state = initializeQueueState();
    state = addToQueue(state, 'S1', 'USA', 30);
    state = updateItemProgress(state, state.items[0].id, 5);
    expect(state.items[0].currentTurn).toBe(5);
  });

  it('should update compositeScore when provided', () => {
    let state = initializeQueueState();
    state = addToQueue(state, 'S1', 'USA', 30);
    state = updateItemProgress(state, state.items[0].id, 10, 75.5);
    expect(state.items[0].compositeScore).toBe(75.5);
  });

  it('should not change compositeScore when not provided', () => {
    let state = initializeQueueState();
    state = addToQueue(state, 'S1', 'USA', 30);
    state = updateItemProgress(state, state.items[0].id, 10);
    expect(state.items[0].compositeScore).toBeNull();
  });

  it('should throw if item not found', () => {
    const state = initializeQueueState();
    expect(() => updateItemProgress(state, 'qi_fake' as QueueItemId, 5)).toThrow(
      'Queue item not found',
    );
  });

  it('should not mutate original state', () => {
    let state = initializeQueueState();
    state = addToQueue(state, 'S1', 'USA', 30);
    const original = state.items[0].currentTurn;
    updateItemProgress(state, state.items[0].id, 15);
    expect(state.items[0].currentTurn).toBe(original);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9 — transitionItemStatus
// ═══════════════════════════════════════════════════════════════════════════

describe('transitionItemStatus', () => {
  it('should transition from queued to running', () => {
    let state = initializeQueueState();
    state = addToQueue(state, 'S1', 'USA', 10);
    state = transitionItemStatus(state, state.items[0].id, 'running');
    expect(state.items[0].status).toBe('running');
  });

  it('should set startedAt on first transition to running', () => {
    let state = initializeQueueState();
    state = addToQueue(state, 'S1', 'USA', 10);
    state = transitionItemStatus(state, state.items[0].id, 'running');
    expect(state.items[0].startedAt).not.toBeNull();
  });

  it('should add itemId to activeItemIds when running', () => {
    let state = initializeQueueState();
    state = addToQueue(state, 'S1', 'USA', 10);
    const id = state.items[0].id;
    state = transitionItemStatus(state, id, 'running');
    expect(state.activeItemIds).toContain(id);
  });

  it('should remove from activeItemIds when paused', () => {
    let state = initializeQueueState();
    state = addToQueue(state, 'S1', 'USA', 10);
    const id = state.items[0].id;
    state = transitionItemStatus(state, id, 'running');
    state = transitionItemStatus(state, id, 'paused');
    expect(state.activeItemIds).not.toContain(id);
  });

  it('should transition from running to completed', () => {
    let state = initializeQueueState();
    state = addToQueue(state, 'S1', 'USA', 10);
    state = transitionItemStatus(state, state.items[0].id, 'running');
    state = transitionItemStatus(state, state.items[0].id, 'completed');
    expect(state.items[0].status).toBe('completed');
    expect(state.items[0].completedAt).not.toBeNull();
  });

  it('should transition from running to failed', () => {
    let state = initializeQueueState();
    state = addToQueue(state, 'S1', 'USA', 10);
    state = transitionItemStatus(state, state.items[0].id, 'running');
    state = transitionItemStatus(state, state.items[0].id, 'failed');
    expect(state.items[0].status).toBe('failed');
  });

  it('should transition from queued to stopped', () => {
    let state = initializeQueueState();
    state = addToQueue(state, 'S1', 'USA', 10);
    state = transitionItemStatus(state, state.items[0].id, 'stopped');
    expect(state.items[0].status).toBe('stopped');
  });

  it('should transition from stopped back to queued', () => {
    let state = initializeQueueState();
    state = addToQueue(state, 'S1', 'USA', 10);
    state = transitionItemStatus(state, state.items[0].id, 'stopped');
    state = transitionItemStatus(state, state.items[0].id, 'queued');
    expect(state.items[0].status).toBe('queued');
  });

  it('should transition from paused to running', () => {
    let state = initializeQueueState();
    state = addToQueue(state, 'S1', 'USA', 10);
    state = transitionItemStatus(state, state.items[0].id, 'running');
    state = transitionItemStatus(state, state.items[0].id, 'paused');
    state = transitionItemStatus(state, state.items[0].id, 'running');
    expect(state.items[0].status).toBe('running');
  });

  it('should reject invalid transition: queued → completed', () => {
    let state = initializeQueueState();
    state = addToQueue(state, 'S1', 'USA', 10);
    expect(() => transitionItemStatus(state, state.items[0].id, 'completed')).toThrow(
      'Invalid transition',
    );
  });

  it('should reject invalid transition: completed → running', () => {
    let state = initializeQueueState();
    state = addToQueue(state, 'S1', 'USA', 10);
    state = transitionItemStatus(state, state.items[0].id, 'running');
    state = transitionItemStatus(state, state.items[0].id, 'completed');
    expect(() => transitionItemStatus(state, state.items[0].id, 'running')).toThrow(
      'Invalid transition',
    );
  });

  it('should reject invalid transition: failed → running', () => {
    let state = initializeQueueState();
    state = addToQueue(state, 'S1', 'USA', 10);
    state = transitionItemStatus(state, state.items[0].id, 'running');
    state = transitionItemStatus(state, state.items[0].id, 'failed');
    expect(() => transitionItemStatus(state, state.items[0].id, 'running')).toThrow(
      'Invalid transition',
    );
  });

  it('should throw if item not found', () => {
    const state = initializeQueueState();
    expect(() =>
      transitionItemStatus(state, 'qi_fake' as QueueItemId, 'running'),
    ).toThrow('Queue item not found');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10 — computeProgress
// ═══════════════════════════════════════════════════════════════════════════

describe('computeProgress', () => {
  it('should compute 0% for an item at turn 0', () => {
    const item = buildItem({ currentTurn: 0, totalTurns: 30 });
    const progress = computeProgress(item);
    expect(progress.percentComplete).toBe(0);
  });

  it('should compute 50% for an item at the midpoint', () => {
    const item = buildItem({ currentTurn: 15, totalTurns: 30 });
    const progress = computeProgress(item);
    expect(progress.percentComplete).toBe(50);
  });

  it('should compute 100% for a completed item', () => {
    const item = buildItem({ currentTurn: 30, totalTurns: 30 });
    const progress = computeProgress(item);
    expect(progress.percentComplete).toBe(100);
  });

  it('should return null estimatedRemainingMs when no startedAt', () => {
    const item = buildItem({ startedAt: null, currentTurn: 10, totalTurns: 30 });
    const progress = computeProgress(item);
    expect(progress.estimatedRemainingMs).toBeNull();
  });

  it('should return null estimatedRemainingMs when currentTurn is 0', () => {
    const item = buildItem({
      startedAt: new Date().toISOString(),
      currentTurn: 0,
      totalTurns: 30,
    });
    const progress = computeProgress(item);
    expect(progress.estimatedRemainingMs).toBeNull();
  });

  it('should estimate remaining time when startedAt and currentTurn > 0', () => {
    const startedAt = new Date(Date.now() - 10_000).toISOString(); // 10s ago
    const item = buildItem({ startedAt, currentTurn: 10, totalTurns: 30 });
    const progress = computeProgress(item);
    expect(progress.estimatedRemainingMs).not.toBeNull();
    expect(progress.estimatedRemainingMs!).toBeGreaterThan(0);
  });

  it('should handle totalTurns of 0 gracefully', () => {
    const item = buildItem({ currentTurn: 0, totalTurns: 0 });
    const progress = computeProgress(item);
    expect(progress.percentComplete).toBe(0);
  });

  it('should include the correct itemId', () => {
    const item = buildItem();
    const progress = computeProgress(item);
    expect(progress.itemId).toBe(item.id);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 11 — generateBatchAnalysis
// ═══════════════════════════════════════════════════════════════════════════

describe('generateBatchAnalysis', () => {
  const batchItems: QueueItem[] = [
    buildItem({ playerFaction: 'USA', compositeScore: 85, totalTurns: 30 }),
    buildItem({ playerFaction: 'China', compositeScore: 78, totalTurns: 30 }),
    buildItem({ playerFaction: 'Russia', compositeScore: 65, totalTurns: 30 }),
  ];

  it('should produce an analysis with the correct batchId', () => {
    const analysis = generateBatchAnalysis(batchItems, 'batch_123');
    expect(analysis.batchId).toBe('batch_123');
  });

  it('should have factionScores for each faction', () => {
    const analysis = generateBatchAnalysis(batchItems, 'batch_123');
    expect(Object.keys(analysis.factionScores)).toEqual(['USA', 'China', 'Russia']);
  });

  it('should produce dimension comparisons', () => {
    const analysis = generateBatchAnalysis(batchItems, 'batch_123');
    expect(analysis.dimensionComparisons.length).toBeGreaterThan(0);
    for (const dim of analysis.dimensionComparisons) {
      expect(dim.dimension).toBeTruthy();
      expect(dim.leader).toBeTruthy();
      expect(typeof dim.gap).toBe('number');
    }
  });

  it('should produce divergence points for multi-faction batches', () => {
    const analysis = generateBatchAnalysis(batchItems, 'batch_123');
    expect(analysis.divergencePoints.length).toBeGreaterThan(0);
  });

  it('should produce no divergence points for single-faction batch', () => {
    const analysis = generateBatchAnalysis([batchItems[0]], 'batch_single');
    expect(analysis.divergencePoints).toHaveLength(0);
  });

  it('should include trajectories for each faction', () => {
    const analysis = generateBatchAnalysis(batchItems, 'batch_123');
    expect(Object.keys(analysis.trajectories)).toEqual(['USA', 'China', 'Russia']);
    for (const traj of Object.values(analysis.trajectories)) {
      expect(traj).toHaveLength(30);
    }
  });

  it('should set completedAt to an ISO timestamp', () => {
    const analysis = generateBatchAnalysis(batchItems, 'batch_123');
    expect(new Date(analysis.completedAt).toISOString()).toBe(analysis.completedAt);
  });

  it('should compute natural advantage for the top scorer', () => {
    const analysis = generateBatchAnalysis(batchItems, 'batch_123');
    expect(analysis.naturalAdvantage.faction).toBe('USA');
    expect(analysis.naturalAdvantage.margin).toBe(7);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 12 — computeNaturalAdvantage
// ═══════════════════════════════════════════════════════════════════════════

describe('computeNaturalAdvantage', () => {
  it('should identify the top faction', () => {
    const result = computeNaturalAdvantage({ USA: 90, China: 80, Russia: 70 });
    expect(result.faction).toBe('USA');
  });

  it('should compute margin as difference between first and second', () => {
    const result = computeNaturalAdvantage({ USA: 90, China: 80 });
    expect(result.margin).toBe(10);
  });

  it('should handle a single faction', () => {
    const result = computeNaturalAdvantage({ USA: 90 });
    expect(result.faction).toBe('USA');
    expect(result.margin).toBe(90);
  });

  it('should handle empty scores', () => {
    const result = computeNaturalAdvantage({});
    expect(result.faction).toBe('none');
    expect(result.margin).toBe(0);
  });

  it('should handle tied scores', () => {
    const result = computeNaturalAdvantage({ USA: 80, China: 80 });
    expect(result.margin).toBe(0);
  });

  it('should include a reason string', () => {
    const result = computeNaturalAdvantage({ USA: 90 });
    expect(result.reason).toContain('90');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 13 — getQueueStats
// ═══════════════════════════════════════════════════════════════════════════

describe('getQueueStats', () => {
  it('should return all zeros for empty queue', () => {
    const stats = getQueueStats(initializeQueueState());
    expect(stats).toEqual({ total: 0, running: 0, queued: 0, completed: 0, failed: 0 });
  });

  it('should count queued items', () => {
    let state = initializeQueueState();
    state = addToQueue(state, 'S1', 'USA', 10);
    state = addToQueue(state, 'S2', 'China', 10);
    const stats = getQueueStats(state);
    expect(stats.total).toBe(2);
    expect(stats.queued).toBe(2);
  });

  it('should count running items', () => {
    let state = initializeQueueState();
    state = addToQueue(state, 'S1', 'USA', 10);
    state = transitionItemStatus(state, state.items[0].id, 'running');
    const stats = getQueueStats(state);
    expect(stats.running).toBe(1);
  });

  it('should count completed items', () => {
    let state = initializeQueueState();
    state = addToQueue(state, 'S1', 'USA', 10);
    state = transitionItemStatus(state, state.items[0].id, 'running');
    state = transitionItemStatus(state, state.items[0].id, 'completed');
    const stats = getQueueStats(state);
    expect(stats.completed).toBe(1);
  });

  it('should count failed items', () => {
    let state = initializeQueueState();
    state = addToQueue(state, 'S1', 'USA', 10);
    state = transitionItemStatus(state, state.items[0].id, 'running');
    state = transitionItemStatus(state, state.items[0].id, 'failed');
    const stats = getQueueStats(state);
    expect(stats.failed).toBe(1);
  });

  it('should count mixed statuses correctly', () => {
    let state = initializeQueueState();
    state = addToQueue(state, 'S1', 'USA', 10);
    state = addToQueue(state, 'S2', 'China', 10);
    state = addToQueue(state, 'S3', 'Russia', 10);
    state = addToQueue(state, 'S4', 'EU', 10);
    state = transitionItemStatus(state, state.items[0].id, 'running');
    state = transitionItemStatus(state, state.items[1].id, 'running');
    state = transitionItemStatus(state, state.items[1].id, 'completed');
    const stats = getQueueStats(state);
    expect(stats.total).toBe(4);
    expect(stats.running).toBe(1);
    expect(stats.queued).toBe(2);
    expect(stats.completed).toBe(1);
    expect(stats.failed).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 14 — canAddToQueue
// ═══════════════════════════════════════════════════════════════════════════

describe('canAddToQueue', () => {
  it('should return true for empty queue', () => {
    expect(canAddToQueue(initializeQueueState())).toBe(true);
  });

  it('should return true when below maxSize', () => {
    let state = initializeQueueState();
    state = addToQueue(state, 'S1', 'USA', 10);
    expect(canAddToQueue(state, 50)).toBe(true);
  });

  it('should return false when at maxSize', () => {
    let state = initializeQueueState();
    for (let i = 0; i < 5; i++) {
      state = addToQueue(state, `S${i}`, 'USA', 10);
    }
    expect(canAddToQueue(state, 5)).toBe(false);
  });

  it('should return false when above maxSize', () => {
    let state = initializeQueueState();
    for (let i = 0; i < 10; i++) {
      state = addToQueue(state, `S${i}`, 'USA', 10);
    }
    expect(canAddToQueue(state, 5)).toBe(false);
  });

  it('should use queueConfig.maxQueueSize as default', () => {
    const state = initializeQueueState();
    expect(canAddToQueue(state)).toBe(true);
  });

  it('should respect custom maxSize of 1', () => {
    let state = initializeQueueState();
    state = addToQueue(state, 'S1', 'USA', 10);
    expect(canAddToQueue(state, 1)).toBe(false);
  });
});
