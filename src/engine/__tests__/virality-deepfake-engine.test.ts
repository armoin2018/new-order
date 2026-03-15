import { describe, it, expect } from 'vitest';
import { ViralityDeepfakeEngine } from '@/engine';
import type {
  ViralityDeepfakeConfig,
  ViralityComputeInput,
  EffectiveViralityInput,
  DeepfakePrereqInput,
  DeepfakeExecutionInput,
} from '@/engine';
import type { FactionId, TurnNumber, ViralityEvent, SocialMediaViralityQueue } from '@/data/types';

// ─────────────────────────────────────────────────────────
// Shared deterministic config override
// ─────────────────────────────────────────────────────────

const TEST_CONFIG: ViralityDeepfakeConfig = {
  viralityFactors: { violenceBonus: 20, scandalBonus: 15, triumphBonus: 10 },
  censorshipEffectiveness: {
    freePress: 0.05,
    stateMedia: 0.70,
    closedSystem: 0.95,
    fragmented: 0.30,
  },
  counterNarrativeEffectTurns: 1,
  counterNarrativeReductionFactor: 0.5,
  platformPenetration: {
    us: 0.9,
    eu: 0.85,
    japan: 0.8,
    china: 0.3,
    russia: 0.4,
    dprk: 0.05,
    iran: 0.2,
    syria: 0.15,
  },
  viralityDecayPerTurn: 15,
  deepfake: {
    cyberThreshold: 60,
    treasuryCost: 10,
    fabricateStatements: { targetLegitimacyPenalty: -15 },
    fakeAtrocityEvidence: { targetLegitimacyPenalty: -20, targetUnrestBoost: 10 },
    syntheticIntelligence: { persistenceTurns: 3 },
    detectionBackfire: { deployerLegitimacyPenalty: -25, trustPenaltyAllNations: -15 },
  },
};

// ─────────────────────────────────────────────────────────
// Helper factories
// ─────────────────────────────────────────────────────────

function makeEngine(overrides?: Partial<ViralityDeepfakeConfig>): ViralityDeepfakeEngine {
  return new ViralityDeepfakeEngine({ ...TEST_CONFIG, ...overrides });
}

function makeEvent(overrides: Partial<ViralityEvent> = {}): ViralityEvent {
  return {
    source: 'us' as FactionId,
    content: 'Test viral event',
    virality: 50,
    spreadMap: {},
    counterNarrativeActive: false,
    turnsToDecay: 3,
    ...overrides,
  };
}

function makeQueue(
  events: ViralityEvent[],
  turn: TurnNumber = 5 as TurnNumber,
): SocialMediaViralityQueue {
  return { turn, events };
}

// ─────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────

describe('ViralityDeepfakeEngine', () => {
  const engine = makeEngine();

  // -----------------------------------------------------------------------
  // computeBaseVirality (FR-1603)
  // -----------------------------------------------------------------------
  describe('computeBaseVirality', () => {
    it('returns base when no categories are provided', () => {
      const input: ViralityComputeInput = { baseVirality: 40, categories: [] };
      expect(engine.computeBaseVirality(input)).toBe(40);
    });

    it('adds violence bonus (+20)', () => {
      const input: ViralityComputeInput = { baseVirality: 30, categories: ['Violence'] };
      expect(engine.computeBaseVirality(input)).toBe(50);
    });

    it('adds scandal bonus (+15)', () => {
      const input: ViralityComputeInput = { baseVirality: 30, categories: ['Scandal'] };
      expect(engine.computeBaseVirality(input)).toBe(45);
    });

    it('adds triumph bonus (+10)', () => {
      const input: ViralityComputeInput = { baseVirality: 30, categories: ['Triumph'] };
      expect(engine.computeBaseVirality(input)).toBe(40);
    });

    it('adds multiple categories cumulatively', () => {
      const input: ViralityComputeInput = {
        baseVirality: 30,
        categories: ['Violence', 'Scandal', 'Triumph'],
      };
      // 30 + 20 + 15 + 10 = 75
      expect(engine.computeBaseVirality(input)).toBe(75);
    });

    it('clamps result at 100', () => {
      const input: ViralityComputeInput = {
        baseVirality: 80,
        categories: ['Violence', 'Scandal'],
      };
      // 80 + 20 + 15 = 115 → clamped to 100
      expect(engine.computeBaseVirality(input)).toBe(100);
    });

    it('handles base of 0', () => {
      const input: ViralityComputeInput = { baseVirality: 0, categories: ['Triumph'] };
      expect(engine.computeBaseVirality(input)).toBe(10);
    });
  });

  // -----------------------------------------------------------------------
  // computeEffectiveVirality (FR-1603)
  // -----------------------------------------------------------------------
  describe('computeEffectiveVirality', () => {
    it('computes effective virality for free-press nation (US)', () => {
      const input: EffectiveViralityInput = {
        baseVirality: 100,
        targetFactions: ['us' as FactionId],
      };
      const result = engine.computeEffectiveVirality(input);
      // 100 × 0.9 × (1 - 0.05) = 100 × 0.9 × 0.95 = 85.5
      expect(result.perNation['us' as FactionId]).toBeCloseTo(85.5, 5);
    });

    it('computes effective virality for state-media nation (China)', () => {
      const input: EffectiveViralityInput = {
        baseVirality: 100,
        targetFactions: ['china' as FactionId],
      };
      const result = engine.computeEffectiveVirality(input);
      // 100 × 0.3 × (1 - 0.70) = 100 × 0.3 × 0.3 = 9
      expect(result.perNation['china' as FactionId]).toBeCloseTo(9, 5);
    });

    it('computes effective virality for closed-system nation (DPRK)', () => {
      const input: EffectiveViralityInput = {
        baseVirality: 100,
        targetFactions: ['dprk' as FactionId],
      };
      const result = engine.computeEffectiveVirality(input);
      // 100 × 0.05 × (1 - 0.95) = 100 × 0.05 × 0.05 = 0.25
      expect(result.perNation['dprk' as FactionId]).toBeCloseTo(0.25, 5);
    });

    it('computes averageVirality as mean of per-nation values', () => {
      const input: EffectiveViralityInput = {
        baseVirality: 100,
        targetFactions: ['us' as FactionId, 'china' as FactionId],
      };
      const result = engine.computeEffectiveVirality(input);
      const usVal = result.perNation['us' as FactionId]!;
      const cnVal = result.perNation['china' as FactionId]!;
      expect(result.averageVirality).toBeCloseTo((usVal + cnVal) / 2, 5);
    });

    it('handles empty target list (averageVirality = 0)', () => {
      const input: EffectiveViralityInput = {
        baseVirality: 100,
        targetFactions: [],
      };
      const result = engine.computeEffectiveVirality(input);
      expect(result.averageVirality).toBe(0);
      expect(Object.keys(result.perNation)).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // applyCounterNarrative (FR-1603)
  // -----------------------------------------------------------------------
  describe('applyCounterNarrative', () => {
    it('halves virality (80 → 40)', () => {
      const event = makeEvent({ virality: 80 });
      const result = engine.applyCounterNarrative(event);
      expect(result.virality).toBe(40);
    });

    it('sets counterNarrativeActive to true', () => {
      const event = makeEvent({ counterNarrativeActive: false });
      const result = engine.applyCounterNarrative(event);
      expect(result.counterNarrativeActive).toBe(true);
    });

    it('reduces spread map values proportionally', () => {
      const event = makeEvent({
        virality: 60,
        spreadMap: {
          ['us' as FactionId]: 80,
          ['china' as FactionId]: 40,
        },
      });
      const result = engine.applyCounterNarrative(event);
      expect(result.spreadMap['us' as FactionId]).toBe(40);
      expect(result.spreadMap['china' as FactionId]).toBe(20);
    });

    it('clamps at 0', () => {
      const event = makeEvent({ virality: 0 });
      const result = engine.applyCounterNarrative(event);
      expect(result.virality).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // decayViralityQueue (FR-1603)
  // -----------------------------------------------------------------------
  describe('decayViralityQueue', () => {
    it('reduces virality by decay amount', () => {
      const queue = makeQueue([makeEvent({ virality: 50, turnsToDecay: 5 })]);
      const result = engine.decayViralityQueue(queue);
      // 50 - 15 = 35
      expect(result.events[0]!.virality).toBe(35);
    });

    it('decrements turnsToDecay', () => {
      const queue = makeQueue([makeEvent({ virality: 50, turnsToDecay: 5 })]);
      const result = engine.decayViralityQueue(queue);
      expect(result.events[0]!.turnsToDecay).toBe(4);
    });

    it('removes expired events (turnsToDecay reaches 0)', () => {
      const queue = makeQueue([makeEvent({ virality: 80, turnsToDecay: 1 })]);
      const result = engine.decayViralityQueue(queue);
      // turnsToDecay 1 - 1 = 0 → removed
      expect(result.events).toHaveLength(0);
    });

    it('removes events with virality reaching 0', () => {
      const queue = makeQueue([makeEvent({ virality: 10, turnsToDecay: 5 })]);
      const result = engine.decayViralityQueue(queue);
      // 10 - 15 = -5 → ≤ 0 → removed
      expect(result.events).toHaveLength(0);
    });

    it('keeps surviving events', () => {
      const queue = makeQueue([
        makeEvent({ virality: 80, turnsToDecay: 4 }),
        makeEvent({ virality: 5, turnsToDecay: 2 }),
        makeEvent({ virality: 60, turnsToDecay: 3 }),
      ]);
      const result = engine.decayViralityQueue(queue);
      // Event 0: 80-15=65, turns=3 → survives
      // Event 1: 5-15=-10 → removed
      // Event 2: 60-15=45, turns=2 → survives
      expect(result.events).toHaveLength(2);
      expect(result.events[0]!.virality).toBe(65);
      expect(result.events[1]!.virality).toBe(45);
    });

    it('returns empty array when all events expire', () => {
      const queue = makeQueue([
        makeEvent({ virality: 10, turnsToDecay: 1 }),
        makeEvent({ virality: 5, turnsToDecay: 1 }),
      ]);
      const result = engine.decayViralityQueue(queue);
      expect(result.events).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // validateDeepfakePrerequisites (FR-1604)
  // -----------------------------------------------------------------------
  describe('validateDeepfakePrerequisites', () => {
    it('returns eligible when all conditions met', () => {
      const input: DeepfakePrereqInput = {
        deployerCyber: 70,
        deployerTreasury: 20,
        hasAvailableSlot: true,
      };
      const result = engine.validateDeepfakePrerequisites(input);
      expect(result.eligible).toBe(true);
      expect(result.reasons).toHaveLength(0);
    });

    it('returns ineligible when CYBER below threshold', () => {
      const input: DeepfakePrereqInput = {
        deployerCyber: 55,
        deployerTreasury: 20,
        hasAvailableSlot: true,
      };
      const result = engine.validateDeepfakePrerequisites(input);
      expect(result.eligible).toBe(false);
      expect(result.reasons.length).toBeGreaterThanOrEqual(1);
      expect(result.reasons.some((r) => r.includes('CYBER'))).toBe(true);
    });

    it('returns ineligible when treasury insufficient', () => {
      const input: DeepfakePrereqInput = {
        deployerCyber: 70,
        deployerTreasury: 5,
        hasAvailableSlot: true,
      };
      const result = engine.validateDeepfakePrerequisites(input);
      expect(result.eligible).toBe(false);
      expect(result.reasons.some((r) => r.includes('Treasury'))).toBe(true);
    });

    it('returns ineligible when no slot available', () => {
      const input: DeepfakePrereqInput = {
        deployerCyber: 70,
        deployerTreasury: 20,
        hasAvailableSlot: false,
      };
      const result = engine.validateDeepfakePrerequisites(input);
      expect(result.eligible).toBe(false);
      expect(result.reasons.some((r) => r.includes('slot'))).toBe(true);
    });

    it('collects multiple failure reasons', () => {
      const input: DeepfakePrereqInput = {
        deployerCyber: 30,
        deployerTreasury: 2,
        hasAvailableSlot: false,
      };
      const result = engine.validateDeepfakePrerequisites(input);
      expect(result.eligible).toBe(false);
      expect(result.reasons).toHaveLength(3);
    });
  });

  // -----------------------------------------------------------------------
  // executeDeepfake (FR-1604)
  // -----------------------------------------------------------------------
  describe('executeDeepfake', () => {
    const baseInput: DeepfakeExecutionInput = {
      type: 'FabricateStatements',
      deployerFaction: 'russia' as FactionId,
      targetFaction: 'us' as FactionId,
      deployerCyber: 70,
      targetCyber: 50,
      detectionRoll: 0.9, // > 0.5 risk → not detected
    };

    it('applies FabricateStatements undetected: targetLegitimacyDelta = -15', () => {
      const result = engine.executeDeepfake({
        ...baseInput,
        type: 'FabricateStatements',
        detectionRoll: 0.9, // > 0.5 → not detected
      });
      expect(result.detected).toBe(false);
      expect(result.targetLegitimacyDelta).toBe(-15);
      expect(result.targetUnrestDelta).toBe(0);
      expect(result.syntheticPersistenceTurns).toBe(0);
    });

    it('applies FakeAtrocityEvidence undetected: targetLegitimacyDelta = -20, targetUnrestDelta = 10', () => {
      const result = engine.executeDeepfake({
        ...baseInput,
        type: 'FakeAtrocityEvidence',
        detectionRoll: 0.9,
      });
      expect(result.detected).toBe(false);
      expect(result.targetLegitimacyDelta).toBe(-20);
      expect(result.targetUnrestDelta).toBe(10);
    });

    it('applies SyntheticIntelligence undetected: syntheticPersistenceTurns = 3', () => {
      const result = engine.executeDeepfake({
        ...baseInput,
        type: 'SyntheticIntelligence',
        detectionRoll: 0.9,
      });
      expect(result.detected).toBe(false);
      expect(result.syntheticPersistenceTurns).toBe(3);
      expect(result.targetLegitimacyDelta).toBe(0);
    });

    it('applies detected backfire: deployerLegitimacyDelta = -25, allNationTrustDelta = -15, target unaffected', () => {
      const result = engine.executeDeepfake({
        ...baseInput,
        type: 'FabricateStatements',
        targetCyber: 80,
        detectionRoll: 0.1, // < 0.8 risk → detected
      });
      expect(result.detected).toBe(true);
      expect(result.deployerLegitimacyDelta).toBe(-25);
      expect(result.allNationTrustDelta).toBe(-15);
      expect(result.targetLegitimacyDelta).toBe(0);
      expect(result.targetUnrestDelta).toBe(0);
    });

    it('always applies treasury cost', () => {
      // Undetected
      const success = engine.executeDeepfake({
        ...baseInput,
        detectionRoll: 0.9,
      });
      expect(success.treasuryCost).toBe(10);

      // Detected
      const failure = engine.executeDeepfake({
        ...baseInput,
        targetCyber: 90,
        detectionRoll: 0.1,
      });
      expect(failure.treasuryCost).toBe(10);
    });
  });

  // -----------------------------------------------------------------------
  // computeDetectionRisk (FR-1604)
  // -----------------------------------------------------------------------
  describe('computeDetectionRisk', () => {
    it('returns target cyber / 100 for normal values', () => {
      expect(engine.computeDetectionRisk(70, 50)).toBeCloseTo(0.5, 5);
      expect(engine.computeDetectionRisk(70, 85)).toBeCloseTo(0.85, 5);
    });

    it('clamps at floor 0.05', () => {
      expect(engine.computeDetectionRisk(90, 2)).toBe(0.05);
      expect(engine.computeDetectionRisk(90, 0)).toBe(0.05);
    });

    it('clamps at ceiling 0.95', () => {
      expect(engine.computeDetectionRisk(50, 99)).toBe(0.95);
      expect(engine.computeDetectionRisk(50, 100)).toBe(0.95);
    });
  });
});
