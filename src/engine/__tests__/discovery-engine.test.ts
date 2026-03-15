import { describe, it, expect, beforeEach } from 'vitest';
import { DiscoveryEngine } from '@/engine/discovery-engine';
import { GAME_CONFIG } from '@/engine/config';
import { SeededRandom } from '@/engine/rng';
import type { FactionId as FactionIdType, TurnNumber } from '@/data/types';
import { FactionId } from '@/data/types';
import type { GreyZoneAction, GreyZoneActionType } from '@/engine/discovery-engine';

// ---------------------------------------------------------------------------
// Constants from the engine (mirrored for test assertions)
// ---------------------------------------------------------------------------

const SEVERITY_MULTIPLIERS: Record<GreyZoneActionType, number> = {
  insurgency: 1.0,
  blockade: 0.8,
  cyberOp: 1.2,
};

const RETALIATION_TENSION_THRESHOLD = 50;
const TARGET_COUNTER_INTEL_MODIFIER = 0.003;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DiscoveryEngine', () => {
  let engine: DiscoveryEngine;
  let rng: SeededRandom;
  const cfg = GAME_CONFIG.greyZone.discovery;

  beforeEach(() => {
    rng = new SeededRandom(42);
    engine = new DiscoveryEngine(cfg, rng);
  });

  // ── calculateDiscoveryChance ──────────────────────────

  describe('calculateDiscoveryChance', () => {
    it('returns baseChance when actor covert = 100 and target counterIntel = 0', () => {
      const chance = engine.calculateDiscoveryChance(100, 0);
      // base + (100-100)*covertMod + 0*counterIntelMod = base
      expect(chance).toBeCloseTo(cfg.baseChance, 5);
    });

    it('increases with lower actor covert capability', () => {
      const highCovert = engine.calculateDiscoveryChance(80, 50);
      const lowCovert = engine.calculateDiscoveryChance(20, 50);
      expect(lowCovert).toBeGreaterThan(highCovert);
    });

    it('increases with higher target counter-intelligence', () => {
      const lowCI = engine.calculateDiscoveryChance(50, 10);
      const highCI = engine.calculateDiscoveryChance(50, 90);
      expect(highCI).toBeGreaterThan(lowCI);
    });

    it('follows the formula: base + (100-covert)*covertMod + ci*ciMod', () => {
      const covert = 60;
      const counterIntel = 40;
      const expected =
        cfg.baseChance +
        (100 - covert) * cfg.covertModifier +
        counterIntel * TARGET_COUNTER_INTEL_MODIFIER;
      const result = engine.calculateDiscoveryChance(covert, counterIntel);
      expect(result).toBeCloseTo(expected, 5);
    });

    it('clamps to 0 when formula yields negative', () => {
      // Very high covert + very low counterIntel + low base could go negative
      // with extreme values (unlikely in production, but test clamp)
      const result = engine.calculateDiscoveryChance(100, 0, -0.5);
      expect(result).toBe(0);
    });

    it('clamps to 1 when formula exceeds 1', () => {
      // Very low covert + high counterIntel + high base
      const result = engine.calculateDiscoveryChance(0, 100, 0.9);
      expect(result).toBeLessThanOrEqual(1);
    });

    it('accepts a per-action base chance override', () => {
      const withDefault = engine.calculateDiscoveryChance(50, 50);
      const withOverride = engine.calculateDiscoveryChance(50, 50, 0.5);
      expect(withOverride).not.toBeCloseTo(withDefault, 2);
    });
  });

  // ── rollDiscovery ─────────────────────────────────────

  describe('rollDiscovery', () => {
    it('always returns true with chance = 1', () => {
      expect(engine.rollDiscovery(1)).toBe(true);
    });

    it('always returns false with chance = 0', () => {
      expect(engine.rollDiscovery(0)).toBe(false);
    });

    it('is deterministic with the same seed', () => {
      const rng1 = new SeededRandom(999);
      const rng2 = new SeededRandom(999);
      const engine1 = new DiscoveryEngine(cfg, rng1);
      const engine2 = new DiscoveryEngine(cfg, rng2);
      const results1 = Array.from({ length: 20 }, () =>
        engine1.rollDiscovery(0.5),
      );
      const results2 = Array.from({ length: 20 }, () =>
        engine2.rollDiscovery(0.5),
      );
      expect(results1).toEqual(results2);
    });
  });

  // ── computeConsequences ───────────────────────────────

  describe('computeConsequences', () => {
    it.each<GreyZoneActionType>(['insurgency', 'blockade', 'cyberOp'])(
      'computes consequences for %s with correct severity multiplier',
      (actionType) => {
        const consequences = engine.computeConsequences(actionType);
        const multiplier = SEVERITY_MULTIPLIERS[actionType];

        expect(consequences.tensionDelta).toBe(
          Math.round(cfg.tensionSpikeOnDiscovery * multiplier),
        );
        expect(consequences.legitimacyDelta).toBe(
          Math.round(cfg.legitimacyPenaltyOnDiscovery * multiplier),
        );
        expect(consequences.targetStabilityDelta).toBe(
          Math.round(cfg.targetStabilityBoostOnDiscovery * multiplier),
        );
      },
    );

    it('insurgency has multiplier 1.0 (baseline)', () => {
      const result = engine.computeConsequences('insurgency');
      expect(result.tensionDelta).toBe(cfg.tensionSpikeOnDiscovery);
    });

    it('blockade has multiplier 0.8 (more deniable)', () => {
      const result = engine.computeConsequences('blockade');
      expect(result.tensionDelta).toBe(
        Math.round(cfg.tensionSpikeOnDiscovery * 0.8),
      );
    });

    it('cyberOp has multiplier 1.2 (more aggressive)', () => {
      const result = engine.computeConsequences('cyberOp');
      expect(result.tensionDelta).toBe(
        Math.round(cfg.tensionSpikeOnDiscovery * 1.2),
      );
    });
  });

  // ── evaluateDiscovery ─────────────────────────────────

  describe('evaluateDiscovery', () => {
    it('returns consequences when discovered (chance = 1)', () => {
      // Force discovery with baseChance override of 1.0
      const result = engine.evaluateDiscovery(
        FactionId.China as FactionIdType,
        FactionId.US as FactionIdType,
        0,   // zero covert → high discovery chance
        100, // max counter-intel
        'insurgency',
        1 as TurnNumber,
        1.0, // 100% discovery chance override
      );
      expect(result.discovered).toBe(true);
      expect(result.consequences.tensionDelta).toBeGreaterThan(0);
      expect(result.consequences.legitimacyDelta).toBeLessThan(0);
      expect(result.consequences.targetStabilityDelta).toBeGreaterThan(0);
    });

    it('returns zero consequences when not discovered (chance = 0)', () => {
      // Force no discovery with baseChance override of -1 (will clamp to 0)
      const result = engine.evaluateDiscovery(
        FactionId.China as FactionIdType,
        FactionId.US as FactionIdType,
        100, // max covert
        0,   // min counter-intel
        'insurgency',
        1 as TurnNumber,
        -1.0, // will clamp to 0% discovery chance
      );
      expect(result.discovered).toBe(false);
      expect(result.consequences.tensionDelta).toBe(0);
      expect(result.consequences.legitimacyDelta).toBe(0);
      expect(result.consequences.targetStabilityDelta).toBe(0);
    });

    it('populates the action metadata correctly', () => {
      const result = engine.evaluateDiscovery(
        FactionId.Russia as FactionIdType,
        FactionId.EU as FactionIdType,
        50,
        50,
        'cyberOp',
        3 as TurnNumber,
      );
      expect(result.action.actorFaction).toBe(FactionId.Russia);
      expect(result.action.targetFaction).toBe(FactionId.EU);
      expect(result.action.actionType).toBe('cyberOp');
      expect(result.turn).toBe(3);
    });

    it('discoveryChance is correctly calculated', () => {
      const covert = 60;
      const ci = 40;
      const result = engine.evaluateDiscovery(
        FactionId.China as FactionIdType,
        FactionId.US as FactionIdType,
        covert,
        ci,
        'blockade',
        1 as TurnNumber,
      );
      const expected = engine.calculateDiscoveryChance(covert, ci);
      expect(result.discoveryChance).toBeCloseTo(expected, 5);
    });
  });

  // ── shouldRetaliateOnDiscovery ────────────────────────

  describe('shouldRetaliateOnDiscovery', () => {
    it('returns true when tension exceeds threshold', () => {
      expect(
        engine.shouldRetaliateOnDiscovery(RETALIATION_TENSION_THRESHOLD + 1),
      ).toBe(true);
    });

    it('returns false when tension equals threshold', () => {
      expect(
        engine.shouldRetaliateOnDiscovery(RETALIATION_TENSION_THRESHOLD),
      ).toBe(false);
    });

    it('returns false when tension is below threshold', () => {
      expect(
        engine.shouldRetaliateOnDiscovery(RETALIATION_TENSION_THRESHOLD - 10),
      ).toBe(false);
    });
  });

  // ── processDiscoveriesForTurn ─────────────────────────

  describe('processDiscoveriesForTurn', () => {
    function makeAction(
      overrides: Partial<GreyZoneAction> = {},
    ): GreyZoneAction {
      return {
        actorFaction: FactionId.China as FactionIdType,
        targetFaction: FactionId.US as FactionIdType,
        actionType: 'insurgency',
        actorCovert: 50,
        targetCounterIntel: 50,
        ...overrides,
      };
    }

    it('returns empty results for empty actions array', () => {
      const result = engine.processDiscoveriesForTurn([], 1 as TurnNumber);
      expect(result.results).toHaveLength(0);
      expect(result.discovered).toHaveLength(0);
      expect(result.undiscovered).toHaveLength(0);
    });

    it('processes multiple actions and partitions discovered/undiscovered', () => {
      const actions: GreyZoneAction[] = [
        makeAction({ actionBaseChance: 1.0 }), // guaranteed discovery
        makeAction({ actionBaseChance: -1.0 }), // guaranteed undiscovered
      ];
      const result = engine.processDiscoveriesForTurn(
        actions,
        1 as TurnNumber,
      );
      expect(result.results).toHaveLength(2);
      expect(result.discovered).toHaveLength(1);
      expect(result.undiscovered).toHaveLength(1);
    });

    it('aggregates tension deltas per bilateral pair', () => {
      const actions: GreyZoneAction[] = [
        makeAction({
          actorFaction: FactionId.China as FactionIdType,
          targetFaction: FactionId.US as FactionIdType,
          actionBaseChance: 1.0,
        }),
        makeAction({
          actorFaction: FactionId.China as FactionIdType,
          targetFaction: FactionId.US as FactionIdType,
          actionBaseChance: 1.0,
          actionType: 'cyberOp',
        }),
      ];
      const result = engine.processDiscoveriesForTurn(
        actions,
        1 as TurnNumber,
      );
      const pairKey = `${FactionId.China as string}→${FactionId.US as string}`;
      const pairDelta = result.aggregateTensionDeltas[pairKey];
      expect(pairDelta).toBeDefined();
      // insurgency tension + cyberOp tension
      const expectedInsurgency = Math.round(
        cfg.tensionSpikeOnDiscovery * SEVERITY_MULTIPLIERS.insurgency,
      );
      const expectedCyberOp = Math.round(
        cfg.tensionSpikeOnDiscovery * SEVERITY_MULTIPLIERS.cyberOp,
      );
      expect(pairDelta).toBe(expectedInsurgency + expectedCyberOp);
    });

    it('aggregates legitimacy deltas per actor', () => {
      const actions: GreyZoneAction[] = [
        makeAction({
          actorFaction: FactionId.China as FactionIdType,
          actionBaseChance: 1.0,
        }),
      ];
      const result = engine.processDiscoveriesForTurn(
        actions,
        1 as TurnNumber,
      );
      const actorDelta =
        result.aggregateLegitimacyDeltas[FactionId.China as string];
      expect(actorDelta).toBeDefined();
      expect(actorDelta).toBeLessThan(0); // penalty
    });

    it('aggregates stability deltas per target', () => {
      const actions: GreyZoneAction[] = [
        makeAction({
          targetFaction: FactionId.US as FactionIdType,
          actionBaseChance: 1.0,
        }),
      ];
      const result = engine.processDiscoveriesForTurn(
        actions,
        1 as TurnNumber,
      );
      const targetDelta =
        result.aggregateStabilityDeltas[FactionId.US as string];
      expect(targetDelta).toBeDefined();
      expect(targetDelta).toBeGreaterThan(0); // rally-around-flag boost
    });

    it('does not aggregate deltas for undiscovered actions', () => {
      const actions: GreyZoneAction[] = [
        makeAction({ actionBaseChance: -1.0 }), // guaranteed undiscovered
      ];
      const result = engine.processDiscoveriesForTurn(
        actions,
        1 as TurnNumber,
      );
      expect(Object.keys(result.aggregateTensionDeltas)).toHaveLength(0);
      expect(Object.keys(result.aggregateLegitimacyDeltas)).toHaveLength(0);
      expect(Object.keys(result.aggregateStabilityDeltas)).toHaveLength(0);
    });
  });
});
