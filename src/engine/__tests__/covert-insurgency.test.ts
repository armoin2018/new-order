import { describe, it, expect, beforeEach } from 'vitest';
import { CovertInsurgencyEngine } from '@/engine/covert-insurgency';
import { GAME_CONFIG } from '@/engine/config';
import { SeededRandom } from '@/engine/rng';
import type { FactionId as FactionIdType, TurnNumber, NationState } from '@/data/types';
import { FactionId } from '@/data/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockNation(overrides: Partial<NationState> = {}): NationState {
  return {
    factionId: 'us' as FactionIdType,
    stability: 55,
    treasury: 800,
    gdp: 28_000,
    inflation: 6,
    militaryReadiness: 85,
    nuclearThreshold: 25,
    diplomaticInfluence: 80,
    popularity: 48,
    allianceCredibility: 65,
    techLevel: 90,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CovertInsurgencyEngine', () => {
  let engine: CovertInsurgencyEngine;
  let rng: SeededRandom;
  const cfg = GAME_CONFIG.greyZone.insurgency;

  beforeEach(() => {
    rng = new SeededRandom(42);
    engine = new CovertInsurgencyEngine(cfg, rng);
  });

  // ── canInitiateInsurgency ──────────────────────────────

  describe('canInitiateInsurgency', () => {
    it('passes when all preconditions are met', () => {
      const sponsor = makeMockNation({
        diplomaticInfluence: cfg.minDIToInitiate,
        treasury: cfg.treasuryCostPerTurn,
      });
      const result = engine.canInitiateInsurgency(sponsor, 0);
      expect(result.valid).toBe(true);
      expect(result.reason).toContain('All preconditions met');
    });

    it('rejects when diplomatic influence is below threshold', () => {
      const sponsor = makeMockNation({
        diplomaticInfluence: cfg.minDIToInitiate - 1,
        treasury: cfg.treasuryCostPerTurn,
      });
      const result = engine.canInitiateInsurgency(sponsor, 0);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Diplomatic Influence');
    });

    it('rejects when treasury is insufficient', () => {
      const sponsor = makeMockNation({
        diplomaticInfluence: cfg.minDIToInitiate,
        treasury: cfg.treasuryCostPerTurn - 1,
      });
      const result = engine.canInitiateInsurgency(sponsor, 0);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Treasury');
    });

    it('rejects when max concurrent insurgencies are reached', () => {
      const sponsor = makeMockNation({
        diplomaticInfluence: cfg.minDIToInitiate,
        treasury: cfg.treasuryCostPerTurn,
      });
      const result = engine.canInitiateInsurgency(
        sponsor,
        cfg.maxConcurrentInsurgencies,
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Maximum concurrent insurgencies');
    });

    it('checks DI before treasury (priority order)', () => {
      const sponsor = makeMockNation({
        diplomaticInfluence: 0,
        treasury: 0,
      });
      const result = engine.canInitiateInsurgency(sponsor, 0);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Diplomatic Influence');
    });
  });

  // ── initiateInsurgency ─────────────────────────────────

  describe('initiateInsurgency', () => {
    it('creates a record with correct faction IDs', () => {
      const record = engine.initiateInsurgency(
        FactionId.US as FactionIdType,
        FactionId.China as FactionIdType,
        1 as TurnNumber,
      );
      expect(record.sponsorFaction).toBe(FactionId.US);
      expect(record.targetFaction).toBe(FactionId.China);
    });

    it('starts active with null endTurn', () => {
      const record = engine.initiateInsurgency(
        FactionId.US as FactionIdType,
        FactionId.China as FactionIdType,
        1 as TurnNumber,
      );
      expect(record.active).toBe(true);
      expect(record.endTurn).toBeNull();
    });

    it('computes effectiveTurn = startTurn + rampUpTurns', () => {
      const startTurn = 5 as TurnNumber;
      const record = engine.initiateInsurgency(
        FactionId.US as FactionIdType,
        FactionId.China as FactionIdType,
        startTurn,
      );
      expect(record.startTurn).toBe(5);
      expect(record.effectiveTurn).toBe(5 + cfg.rampUpTurns);
    });

    it('initialises cumulative stability damage to zero', () => {
      const record = engine.initiateInsurgency(
        FactionId.US as FactionIdType,
        FactionId.China as FactionIdType,
        1 as TurnNumber,
      );
      expect(record.cumulativeStabilityDamage).toBe(0);
    });

    it('generates unique IDs for different insurgencies', () => {
      const r1 = engine.initiateInsurgency(
        FactionId.US as FactionIdType,
        FactionId.China as FactionIdType,
        1 as TurnNumber,
      );
      const r2 = engine.initiateInsurgency(
        FactionId.US as FactionIdType,
        FactionId.Russia as FactionIdType,
        1 as TurnNumber,
      );
      expect(r1.id).not.toBe(r2.id);
    });
  });

  // ── processTurnEffects ─────────────────────────────────

  describe('processTurnEffects', () => {
    it('returns zero stability delta during ramp-up period', () => {
      const record = engine.initiateInsurgency(
        FactionId.US as FactionIdType,
        FactionId.China as FactionIdType,
        1 as TurnNumber,
      );
      // Process on start turn (before effective turn)
      const result = engine.processTurnEffects(record, 1 as TurnNumber);
      expect(result.stabilityDelta).toBe(0);
      expect(result.inRampUp).toBe(true);
    });

    it('still costs treasury during ramp-up period', () => {
      const record = engine.initiateInsurgency(
        FactionId.US as FactionIdType,
        FactionId.China as FactionIdType,
        1 as TurnNumber,
      );
      const result = engine.processTurnEffects(record, 1 as TurnNumber);
      expect(result.treasuryCost).toBe(cfg.treasuryCostPerTurn);
    });

    it('applies stability reduction after ramp-up period', () => {
      const record = engine.initiateInsurgency(
        FactionId.US as FactionIdType,
        FactionId.China as FactionIdType,
        1 as TurnNumber,
      );
      const effectTurn = record.effectiveTurn;
      const result = engine.processTurnEffects(record, effectTurn);
      expect(result.stabilityDelta).toBe(-cfg.stabilityReductionPerTurn);
      expect(result.inRampUp).toBe(false);
    });

    it('tracks cumulative stability damage', () => {
      const record = engine.initiateInsurgency(
        FactionId.US as FactionIdType,
        FactionId.China as FactionIdType,
        1 as TurnNumber,
      );
      const effectTurn = record.effectiveTurn;
      engine.processTurnEffects(record, effectTurn);
      engine.processTurnEffects(record, (effectTurn + 1) as TurnNumber);
      expect(record.cumulativeStabilityDamage).toBe(
        cfg.stabilityReductionPerTurn * 2,
      );
    });

    it('never triggers a war-state flag (FR-401 invariant)', () => {
      const record = engine.initiateInsurgency(
        FactionId.US as FactionIdType,
        FactionId.China as FactionIdType,
        1 as TurnNumber,
      );
      const result = engine.processTurnEffects(
        record,
        record.effectiveTurn,
      );
      // The result type does not contain a triggersWarState field — by design.
      expect(result).not.toHaveProperty('triggersWarState');
    });
  });

  // ── processAllInsurgencies ─────────────────────────────

  describe('processAllInsurgencies', () => {
    it('aggregates per-target stability deltas', () => {
      const i1 = engine.initiateInsurgency(
        FactionId.US as FactionIdType,
        FactionId.China as FactionIdType,
        1 as TurnNumber,
      );
      const i2 = engine.initiateInsurgency(
        FactionId.Russia as FactionIdType,
        FactionId.China as FactionIdType,
        1 as TurnNumber,
      );
      const effectTurn = Math.max(
        i1.effectiveTurn,
        i2.effectiveTurn,
      ) as TurnNumber;
      const result = engine.processAllInsurgencies(
        [i1, i2],
        effectTurn,
      );

      expect(result.perTargetStabilityDelta[FactionId.China]).toBe(
        -cfg.stabilityReductionPerTurn * 2,
      );
    });

    it('aggregates per-sponsor treasury costs', () => {
      const i1 = engine.initiateInsurgency(
        FactionId.US as FactionIdType,
        FactionId.China as FactionIdType,
        1 as TurnNumber,
      );
      const i2 = engine.initiateInsurgency(
        FactionId.US as FactionIdType,
        FactionId.Russia as FactionIdType,
        1 as TurnNumber,
      );
      const result = engine.processAllInsurgencies(
        [i1, i2],
        i1.effectiveTurn,
      );

      expect(result.perSponsorTreasuryCost[FactionId.US]).toBe(
        cfg.treasuryCostPerTurn * 2,
      );
    });

    it('skips inactive insurgencies', () => {
      const i1 = engine.initiateInsurgency(
        FactionId.US as FactionIdType,
        FactionId.China as FactionIdType,
        1 as TurnNumber,
      );
      i1.active = false;
      const result = engine.processAllInsurgencies(
        [i1],
        i1.effectiveTurn,
      );
      expect(result.results).toHaveLength(0);
    });

    it('returns empty aggregates when all inactive', () => {
      const result = engine.processAllInsurgencies([], 1 as TurnNumber);
      expect(result.results).toHaveLength(0);
      expect(Object.keys(result.perTargetStabilityDelta)).toHaveLength(0);
      expect(Object.keys(result.perSponsorTreasuryCost)).toHaveLength(0);
    });
  });

  // ── cancelInsurgency ───────────────────────────────────

  describe('cancelInsurgency', () => {
    it('returns a new record with active: false', () => {
      const record = engine.initiateInsurgency(
        FactionId.US as FactionIdType,
        FactionId.China as FactionIdType,
        1 as TurnNumber,
      );
      const cancelled = engine.cancelInsurgency(record, 5 as TurnNumber);
      expect(cancelled.active).toBe(false);
      expect(cancelled.endTurn).toBe(5);
    });

    it('does not mutate the original record', () => {
      const record = engine.initiateInsurgency(
        FactionId.US as FactionIdType,
        FactionId.China as FactionIdType,
        1 as TurnNumber,
      );
      engine.cancelInsurgency(record, 5 as TurnNumber);
      expect(record.active).toBe(true);
      expect(record.endTurn).toBeNull();
    });

    it('preserves all other fields in the cancelled record', () => {
      const record = engine.initiateInsurgency(
        FactionId.US as FactionIdType,
        FactionId.China as FactionIdType,
        1 as TurnNumber,
      );
      const cancelled = engine.cancelInsurgency(record, 5 as TurnNumber);
      expect(cancelled.id).toBe(record.id);
      expect(cancelled.sponsorFaction).toBe(record.sponsorFaction);
      expect(cancelled.targetFaction).toBe(record.targetFaction);
      expect(cancelled.startTurn).toBe(record.startTurn);
      expect(cancelled.effectiveTurn).toBe(record.effectiveTurn);
    });
  });

  // ── canSponsorAfford ───────────────────────────────────

  describe('canSponsorAfford', () => {
    it('returns true when treasury meets cost', () => {
      expect(engine.canSponsorAfford(cfg.treasuryCostPerTurn)).toBe(true);
    });

    it('returns true when treasury exceeds cost', () => {
      expect(engine.canSponsorAfford(cfg.treasuryCostPerTurn + 100)).toBe(true);
    });

    it('returns false when treasury is below cost', () => {
      expect(engine.canSponsorAfford(cfg.treasuryCostPerTurn - 1)).toBe(false);
    });

    it('returns false for zero treasury', () => {
      expect(engine.canSponsorAfford(0)).toBe(false);
    });
  });
});
