import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { SeededRandom } from '@/engine/rng';
import type { RngState } from '@/engine/rng';

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

/** Generate an array of `n` values from a fresh RNG with the given seed. */
function sequence(seed: number, n: number): number[] {
  const rng = new SeededRandom(seed);
  return Array.from({ length: n }, () => rng.next());
}

// ─────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────

describe('SeededRandom', () => {
  // ── Determinism ──────────────────────────────────────

  describe('determinism', () => {
    it('same seed produces identical sequence over 100 calls', () => {
      const a = sequence(12345, 100);
      const b = sequence(12345, 100);
      expect(a).toEqual(b);
    });

    it('different seeds produce different sequences', () => {
      const a = sequence(1, 100);
      const b = sequence(2, 100);
      expect(a).not.toEqual(b);
    });
  });

  // ── next() ───────────────────────────────────────────

  describe('next()', () => {
    it('returns values in [0, 1)', () => {
      const rng = new SeededRandom(42);
      for (let i = 0; i < 1000; i++) {
        const v = rng.next();
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    });
  });

  // ── nextInt() ────────────────────────────────────────

  describe('nextInt()', () => {
    it('returns integers in [min, max] over 1000 calls', () => {
      const rng = new SeededRandom(99);
      for (let i = 0; i < 1000; i++) {
        const v = rng.nextInt(1, 6);
        expect(Number.isInteger(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(6);
      }
    });

    it('returns min when min === max', () => {
      const rng = new SeededRandom(7);
      expect(rng.nextInt(5, 5)).toBe(5);
    });
  });

  // ── nextFloat() ──────────────────────────────────────

  describe('nextFloat()', () => {
    it('returns floats in [0, 1) over 1000 calls', () => {
      const rng = new SeededRandom(77);
      for (let i = 0; i < 1000; i++) {
        const v = rng.nextFloat(0, 1);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
      }
    });

    it('returns floats within a custom range', () => {
      const rng = new SeededRandom(88);
      for (let i = 0; i < 1000; i++) {
        const v = rng.nextFloat(10, 20);
        expect(v).toBeGreaterThanOrEqual(10);
        expect(v).toBeLessThan(20);
      }
    });
  });

  // ── nextBool() ───────────────────────────────────────

  describe('nextBool()', () => {
    it('always returns false when probability is 0', () => {
      const rng = new SeededRandom(1);
      for (let i = 0; i < 100; i++) {
        expect(rng.nextBool(0)).toBe(false);
      }
    });

    it('always returns true when probability is 1', () => {
      const rng = new SeededRandom(1);
      for (let i = 0; i < 100; i++) {
        expect(rng.nextBool(1)).toBe(true);
      }
    });

    it('returns roughly 50/50 with default probability', () => {
      const rng = new SeededRandom(42);
      let trueCount = 0;
      const trials = 10_000;
      for (let i = 0; i < trials; i++) {
        if (rng.nextBool()) trueCount++;
      }
      // Allow ±5%
      expect(trueCount / trials).toBeGreaterThan(0.45);
      expect(trueCount / trials).toBeLessThan(0.55);
    });
  });

  // ── pick() ───────────────────────────────────────────

  describe('pick()', () => {
    it('returns an element from the provided array', () => {
      const rng = new SeededRandom(55);
      const items = ['a', 'b', 'c', 'd'] as const;
      for (let i = 0; i < 100; i++) {
        const picked = rng.pick(items);
        expect(items).toContain(picked);
      }
    });

    it('throws on empty array', () => {
      const rng = new SeededRandom(1);
      expect(() => rng.pick([])).toThrow('Cannot pick from an empty array');
    });

    it('returns the only element in a single-element array', () => {
      const rng = new SeededRandom(1);
      expect(rng.pick([42])).toBe(42);
    });
  });

  // ── shuffle() ────────────────────────────────────────

  describe('shuffle()', () => {
    const original = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

    it('returns an array with the same elements', () => {
      const rng = new SeededRandom(42);
      const shuffled = rng.shuffle(original);
      expect([...shuffled].sort((a, b) => a - b)).toEqual([...original]);
    });

    it('does not mutate the original array', () => {
      const mutable = [1, 2, 3, 4, 5];
      const snapshot = [...mutable];
      const rng = new SeededRandom(42);
      rng.shuffle(mutable);
      expect(mutable).toEqual(snapshot);
    });

    it('is deterministic — same seed produces same shuffle', () => {
      const a = new SeededRandom(42).shuffle(original);
      const b = new SeededRandom(42).shuffle(original);
      expect(a).toEqual(b);
    });

    it('returns an empty array when given an empty array', () => {
      const rng = new SeededRandom(1);
      expect(rng.shuffle([])).toEqual([]);
    });
  });

  // ── nextGaussian() ──────────────────────────────────

  describe('nextGaussian()', () => {
    it('produces values with mean ≈ 0 and stddev ≈ 1 over 10000 samples', () => {
      const rng = new SeededRandom(42);
      const n = 10_000;
      let sum = 0;
      let sumSq = 0;

      for (let i = 0; i < n; i++) {
        const v = rng.nextGaussian();
        sum += v;
        sumSq += v * v;
      }

      const mean = sum / n;
      const variance = sumSq / n - mean * mean;
      const stddev = Math.sqrt(variance);

      expect(mean).toBeCloseTo(0, 1);       // within ±0.1
      expect(stddev).toBeCloseTo(1, 1);      // within ±0.1
    });

    it('respects custom mean and stddev', () => {
      const rng = new SeededRandom(99);
      const n = 10_000;
      const targetMean = 100;
      const targetStddev = 15;
      let sum = 0;
      let sumSq = 0;

      for (let i = 0; i < n; i++) {
        const v = rng.nextGaussian(targetMean, targetStddev);
        sum += v;
        sumSq += v * v;
      }

      const mean = sum / n;
      const variance = sumSq / n - mean * mean;
      const stddev = Math.sqrt(variance);

      expect(mean).toBeCloseTo(targetMean, 0);    // within ±0.5
      expect(stddev).toBeCloseTo(targetStddev, 0); // within ±0.5
    });
  });

  // ── State save / restore ─────────────────────────────

  describe('state management', () => {
    it('getState() → fromState() produces identical continuation', () => {
      const rng = new SeededRandom(42);
      // Advance a few steps
      for (let i = 0; i < 50; i++) rng.next();

      const state: RngState = rng.getState();
      const restored = SeededRandom.fromState(state);

      // Both should produce the same next 100 values
      const originalValues = Array.from({ length: 100 }, () => rng.next());
      const restoredValues = Array.from({ length: 100 }, () => restored.next());
      expect(originalValues).toEqual(restoredValues);
    });

    it('getState() preserves seed and callCount', () => {
      const rng = new SeededRandom(123);
      rng.next();
      rng.next();
      rng.next();

      const state = rng.getState();
      expect(state.seed).toBe(123);
      expect(state.callCount).toBe(3);
    });
  });

  // ── clone() ──────────────────────────────────────────

  describe('clone()', () => {
    it('produces an independent copy with the same state', () => {
      const rng = new SeededRandom(42);
      for (let i = 0; i < 10; i++) rng.next();

      const cloned = rng.clone();

      // Both produce the same next values
      const origNext = Array.from({ length: 50 }, () => rng.next());
      const cloneNext = Array.from({ length: 50 }, () => cloned.next());
      expect(origNext).toEqual(cloneNext);
    });

    it('advancing the original does not affect the clone', () => {
      const rng = new SeededRandom(42);
      const cloned = rng.clone();

      // Advance original significantly
      for (let i = 0; i < 1000; i++) rng.next();

      // Clone should still be at the start
      const cloneState = cloned.getState();
      expect(cloneState.callCount).toBe(0);

      // Clone first value should match a fresh RNG
      const fresh = new SeededRandom(42);
      expect(cloned.next()).toBe(fresh.next());
    });
  });

  // ── Edge-case seeds ──────────────────────────────────

  describe('edge-case seeds', () => {
    it('seed = 0 produces valid output', () => {
      const rng = new SeededRandom(0);
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      expect(rng.seed).toBe(0);
    });

    it('negative seed produces valid output', () => {
      const rng = new SeededRandom(-1);
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    });

    it('MAX_SAFE_INTEGER seed produces valid output', () => {
      const rng = new SeededRandom(Number.MAX_SAFE_INTEGER);
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    });

    it('negative seed is deterministic', () => {
      const a = sequence(-42, 50);
      const b = sequence(-42, 50);
      expect(a).toEqual(b);
    });
  });

  // ── No Math.random() ────────────────────────────────

  describe('source-level safety', () => {
    it('rng.ts source does not contain Math.random', () => {
      const source = fs.readFileSync(
        path.resolve(__dirname, '..', 'rng.ts'),
        'utf-8',
      );
      expect(source).not.toMatch(/Math\.random/);
    });
  });
});
