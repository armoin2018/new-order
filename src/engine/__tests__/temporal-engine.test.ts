import { describe, it, expect } from 'vitest';
import {
  createTurnDurationConfig,
  getScalingMultiplier,
  computeTemporalScaling,
  scaleRate,
  advanceSimulatedDate,
  formatTurnDateLabel,
} from '@/engine/temporal-engine';
import { GAME_CONFIG } from '@/engine/config';

// ---------------------------------------------------------------------------
// Temporal Engine Tests
// ---------------------------------------------------------------------------

describe('createTurnDurationConfig', () => {
  it('creates a config with the given unit and default start date', () => {
    const cfg = createTurnDurationConfig('months');
    expect(cfg.unit).toBe('months');
    expect(cfg.simulatedStartDate).toBe(GAME_CONFIG.temporal.defaultStartDate);
    expect(cfg.currentSimulatedDate).toBe(cfg.simulatedStartDate);
    expect(cfg.scalingMultiplier).toBe(1);
  });

  it('creates a config with a custom start date', () => {
    const cfg = createTurnDurationConfig('weeks', '2027-01-15');
    expect(cfg.simulatedStartDate).toBe('2027-01-15');
    expect(cfg.currentSimulatedDate).toBe('2027-01-15');
  });

  it.each(['days', 'weeks', 'months', 'years'] as const)(
    'creates a config for unit "%s" with the correct multiplier',
    (unit) => {
      const cfg = createTurnDurationConfig(unit);
      expect(cfg.unit).toBe(unit);
      expect(cfg.scalingMultiplier).toBe(
        GAME_CONFIG.temporal.scalingMultipliers[unit],
      );
    },
  );
});

// ---------------------------------------------------------------------------

describe('getScalingMultiplier', () => {
  it('returns 1/30 for days', () => {
    expect(getScalingMultiplier('days')).toBeCloseTo(1 / 30);
  });

  it('returns 1/4.33 for weeks', () => {
    expect(getScalingMultiplier('weeks')).toBeCloseTo(1 / 4.33);
  });

  it('returns 1 for months', () => {
    expect(getScalingMultiplier('months')).toBe(1);
  });

  it('returns 12 for years', () => {
    expect(getScalingMultiplier('years')).toBe(12);
  });
});

// ---------------------------------------------------------------------------

describe('computeTemporalScaling', () => {
  const monthsCfg = createTurnDurationConfig('months', '2026-03-01');
  const daysCfg = createTurnDurationConfig('days', '2026-03-01');
  const weeksCfg = createTurnDurationConfig('weeks', '2026-03-01');
  const yearsCfg = createTurnDurationConfig('years', '2026-01-01');

  it('returns the correct multiplier', () => {
    expect(computeTemporalScaling(monthsCfg, 1).multiplier).toBe(1);
    expect(computeTemporalScaling(daysCfg, 1).multiplier).toBeCloseTo(1 / 30);
    expect(computeTemporalScaling(yearsCfg, 1).multiplier).toBe(12);
  });

  it('returns correct date range for months turn 1', () => {
    const result = computeTemporalScaling(monthsCfg, 1);
    expect(result.turnStartDate).toBe('2026-03-01');
    expect(result.turnEndDate).toBe('2026-04-01');
    expect(result.dateLabel).toBe('March 2026 – April 2026');
  });

  it('returns correct date range for months turn 3', () => {
    const result = computeTemporalScaling(monthsCfg, 3);
    expect(result.turnStartDate).toBe('2026-05-01');
    expect(result.turnEndDate).toBe('2026-06-01');
  });

  it('returns correct date range for days turn 1', () => {
    const result = computeTemporalScaling(daysCfg, 1);
    expect(result.turnStartDate).toBe('2026-03-01');
    expect(result.turnEndDate).toBe('2026-03-02');
    expect(result.dateLabel).toBe('March 1, 2026 – March 2, 2026');
  });

  it('returns correct date range for weeks turn 1', () => {
    const result = computeTemporalScaling(weeksCfg, 1);
    expect(result.turnStartDate).toBe('2026-03-01');
    expect(result.turnEndDate).toBe('2026-03-08');
    expect(result.dateLabel).toBe('March 1, 2026 – March 8, 2026');
  });

  it('returns correct date label for years turn 1', () => {
    const result = computeTemporalScaling(yearsCfg, 1);
    expect(result.turnStartDate).toBe('2026-01-01');
    expect(result.turnEndDate).toBe('2027-01-01');
    expect(result.dateLabel).toBe('2026 – 2027');
  });

  it('handles turn 100 without error (months)', () => {
    const result = computeTemporalScaling(monthsCfg, 100);
    expect(result.turnStartDate).toBeTruthy();
    expect(result.turnEndDate).toBeTruthy();
    // Turn 100 starts 99 months after March 2026 → June 2034
    expect(result.turnStartDate).toBe('2034-06-01');
  });
});

// ---------------------------------------------------------------------------

describe('scaleRate', () => {
  it('returns the same rate for months (multiplier = 1)', () => {
    const cfg = createTurnDurationConfig('months');
    expect(scaleRate(10, cfg)).toBe(10);
  });

  it('scales to ~1/30 for days', () => {
    const cfg = createTurnDurationConfig('days');
    expect(scaleRate(30, cfg)).toBeCloseTo(1);
  });

  it('scales to ~1/4.33 for weeks', () => {
    const cfg = createTurnDurationConfig('weeks');
    expect(scaleRate(4.33, cfg)).toBeCloseTo(1);
  });

  it('scales to 12× for years', () => {
    const cfg = createTurnDurationConfig('years');
    expect(scaleRate(1, cfg)).toBe(12);
  });

  it('handles zero rate', () => {
    const cfg = createTurnDurationConfig('years');
    expect(scaleRate(0, cfg)).toBe(0);
  });

  it('handles negative rate', () => {
    const cfg = createTurnDurationConfig('months');
    expect(scaleRate(-5, cfg)).toBe(-5);
  });
});

// ---------------------------------------------------------------------------

describe('advanceSimulatedDate', () => {
  it('advances by 1 day for days unit', () => {
    const cfg = createTurnDurationConfig('days', '2026-03-01');
    expect(advanceSimulatedDate(cfg, 1)).toBe('2026-03-02');
  });

  it('advances by 7 days for weeks unit', () => {
    const cfg = createTurnDurationConfig('weeks', '2026-03-01');
    expect(advanceSimulatedDate(cfg, 1)).toBe('2026-03-08');
  });

  it('advances by 1 month for months unit', () => {
    const cfg = createTurnDurationConfig('months', '2026-03-01');
    expect(advanceSimulatedDate(cfg, 1)).toBe('2026-04-01');
  });

  it('advances by 1 year for years unit', () => {
    const cfg = createTurnDurationConfig('years', '2026-01-01');
    expect(advanceSimulatedDate(cfg, 1)).toBe('2027-01-01');
  });

  it('returns the start date when turnNumber is 0', () => {
    const cfg = createTurnDurationConfig('months', '2026-03-01');
    expect(advanceSimulatedDate(cfg, 0)).toBe('2026-03-01');
  });

  it('advances multiple turns correctly (months)', () => {
    const cfg = createTurnDurationConfig('months', '2026-03-01');
    expect(advanceSimulatedDate(cfg, 12)).toBe('2027-03-01');
  });

  it('advances multiple turns correctly (days)', () => {
    const cfg = createTurnDurationConfig('days', '2026-03-01');
    expect(advanceSimulatedDate(cfg, 30)).toBe('2026-03-31');
  });

  it('handles leap year: Feb 28 + 1 day in 2028', () => {
    const cfg = createTurnDurationConfig('days', '2028-02-28');
    expect(advanceSimulatedDate(cfg, 1)).toBe('2028-02-29');
  });

  it('handles leap year: Feb 29 + 1 day in 2028', () => {
    const cfg = createTurnDurationConfig('days', '2028-02-29');
    expect(advanceSimulatedDate(cfg, 1)).toBe('2028-03-01');
  });

  it('handles turn 100 (weeks)', () => {
    const cfg = createTurnDurationConfig('weeks', '2026-03-01');
    const result = advanceSimulatedDate(cfg, 100);
    // 100 weeks = 700 days from March 1, 2026 → January 30, 2028
    expect(result).toBeTruthy();
    expect(result).toBe('2028-01-30');
  });
});

// ---------------------------------------------------------------------------

describe('formatTurnDateLabel', () => {
  it('returns a date range string for months', () => {
    const cfg = createTurnDurationConfig('months', '2026-03-01');
    expect(formatTurnDateLabel(cfg, 1)).toBe('March 2026 – April 2026');
  });

  it('returns a date range string for days', () => {
    const cfg = createTurnDurationConfig('days', '2026-06-15');
    expect(formatTurnDateLabel(cfg, 1)).toBe('June 15, 2026 – June 16, 2026');
  });

  it('returns a year range for years', () => {
    const cfg = createTurnDurationConfig('years', '2026-01-01');
    expect(formatTurnDateLabel(cfg, 2)).toBe('2027 – 2028');
  });
});
