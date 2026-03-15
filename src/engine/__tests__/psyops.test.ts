import { describe, it, expect, beforeEach } from 'vitest';
import { PsyOpsEngine } from '@/engine/psyops';
import type { PsyOpInput, CounterIntelInput, BehavioralAssessmentInput, EmotionalSnapshot } from '@/engine/psyops';
import { GAME_CONFIG } from '@/engine/config';
import { PsyOpType, CounterIntelType } from '@/data/types';
import type { LeaderId, FactionId, TurnNumber } from '@/data/types';

const LEADER = 'leader-1' as LeaderId;
const FACTION = 'us' as FactionId;
const TURN = 5 as TurnNumber;

describe('PsyOpsEngine', () => {
  let engine: PsyOpsEngine;

  beforeEach(() => {
    engine = new PsyOpsEngine(GAME_CONFIG.psychology);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // executePsyOp (FR-1512)
  // ─────────────────────────────────────────────────────────────────────────

  describe('executePsyOp', () => {
    const baseInput: PsyOpInput = {
      psyOpType: PsyOpType.PublicHumiliation,
      executingFaction: FACTION,
      targetLeader: LEADER,
      targetParanoia: 50,
      targetResolve: 50,
      currentTurn: TURN,
      discoveryRoll: 0.5,
    };

    it('PublicHumiliation discovered when discoveryRoll < discoveryChance', () => {
      const result = engine.executePsyOp({
        ...baseInput,
        psyOpType: PsyOpType.PublicHumiliation,
        discoveryRoll: 0.1, // < 0.3
      });
      expect(result.success).toBe(true);
      expect(result.discovered).toBe(true);
      expect(result.emotionalEffects.anger).toBe(20);
      expect(result.emotionalEffects.confidence).toBe(-15);
      expect(result.executorCosts.diPenalty).toBe(-10);
    });

    it('PublicHumiliation not discovered when discoveryRoll >= discoveryChance', () => {
      const result = engine.executePsyOp({
        ...baseInput,
        psyOpType: PsyOpType.PublicHumiliation,
        discoveryRoll: 0.5, // >= 0.3
      });
      expect(result.discovered).toBe(false);
      expect(result.executorCosts.diPenalty).toBe(0);
    });

    it('StrategicAmbiguity applies fear and stress with readiness cost', () => {
      const result = engine.executePsyOp({
        ...baseInput,
        psyOpType: PsyOpType.StrategicAmbiguity,
      });
      expect(result.success).toBe(true);
      expect(result.discovered).toBe(false);
      expect(result.emotionalEffects.fear).toBe(15);
      expect(result.emotionalEffects.stress).toBe(10);
      expect(result.executorCosts.readinessCost).toBe(-5);
    });

    it('DiplomaticGhosting applies paranoia and anger with tension increase', () => {
      const result = engine.executePsyOp({
        ...baseInput,
        psyOpType: PsyOpType.DiplomaticGhosting,
      });
      expect(result.success).toBe(true);
      expect(result.discovered).toBe(false);
      expect(result.emotionalEffects.paranoia).toBe(10);
      expect(result.emotionalEffects.anger).toBe(10);
      expect(result.executorCosts.tensionIncrease).toBe(15);
    });

    it('ProvocativePosturing does not trigger conflict when roll >= threshold', () => {
      const result = engine.executePsyOp({
        ...baseInput,
        psyOpType: PsyOpType.ProvocativePosturing,
        targetParanoia: 10,
        discoveryRoll: 0.99, // threshold = 10 * 0.05 = 0.5
      });
      expect(result.conflictTriggered).toBe(false);
      expect(result.emotionalEffects.fear).toBe(10);
    });

    it('ProvocativePosturing triggers conflict when roll < threshold', () => {
      const result = engine.executePsyOp({
        ...baseInput,
        psyOpType: PsyOpType.ProvocativePosturing,
        targetParanoia: 10,
        discoveryRoll: 0.01, // < 0.5
      });
      expect(result.conflictTriggered).toBe(true);
    });

    it('all psyops always succeed', () => {
      const result = engine.executePsyOp({
        ...baseInput,
        psyOpType: PsyOpType.StrategicAmbiguity,
      });
      expect(result.success).toBe(true);
    });

    it('StrategicAmbiguity has no tension increase', () => {
      const result = engine.executePsyOp({
        ...baseInput,
        psyOpType: PsyOpType.StrategicAmbiguity,
      });
      expect(result.executorCosts.tensionIncrease).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // applyCounterIntel (FR-1513)
  // ─────────────────────────────────────────────────────────────────────────

  describe('applyCounterIntel', () => {
    const baseInput: CounterIntelInput = {
      counterType: CounterIntelType.MediaCounterNarrative,
      targetLeader: LEADER,
      targetResolve: 50,
      incomingEffects: { anger: 20, confidence: -15 },
      detected: false,
      currentTurn: TURN,
    };

    it('MediaCounterNarrative zeroes confidence effect and applies DI cost', () => {
      const result = engine.applyCounterIntel(baseInput);
      expect(result.applied).toBe(true);
      expect(result.modifiedEffects.confidence).toBe(0);
      expect(result.diCost).toBe(-5);
    });

    it('MediaCounterNarrative preserves non-confidence effects unchanged', () => {
      const result = engine.applyCounterIntel(baseInput);
      expect(result.modifiedEffects.anger).toBe(20);
    });

    it('EmotionalDiscipline reduces all effects by 30% when resolve >= 70', () => {
      const result = engine.applyCounterIntel({
        ...baseInput,
        counterType: CounterIntelType.EmotionalDiscipline,
        targetResolve: 70,
      });
      expect(result.applied).toBe(true);
      expect(result.modifiedEffects.anger).toBe(Math.round(20 * 0.7));   // 14
      expect(result.modifiedEffects.confidence).toBe(Math.round(-15 * 0.7)); // -11
    });

    it('EmotionalDiscipline not applied when resolve < 70', () => {
      const result = engine.applyCounterIntel({
        ...baseInput,
        counterType: CounterIntelType.EmotionalDiscipline,
        targetResolve: 60,
      });
      expect(result.applied).toBe(false);
      expect(result.modifiedEffects.anger).toBe(20);
      expect(result.modifiedEffects.confidence).toBe(-15);
    });

    it('IntelligenceInoculation zeroes all effects and boosts nationalism when detected', () => {
      const result = engine.applyCounterIntel({
        ...baseInput,
        counterType: CounterIntelType.IntelligenceInoculation,
        detected: true,
      });
      expect(result.applied).toBe(true);
      expect(result.modifiedEffects.anger).toBe(0);
      expect(result.modifiedEffects.confidence).toBe(0);
      expect(result.nationalismBoost).toBe(5);
    });

    it('IntelligenceInoculation not applied when not detected', () => {
      const result = engine.applyCounterIntel({
        ...baseInput,
        counterType: CounterIntelType.IntelligenceInoculation,
        detected: false,
      });
      expect(result.applied).toBe(false);
      expect(result.modifiedEffects.anger).toBe(20);
      expect(result.modifiedEffects.confidence).toBe(-15);
    });

    it('IntelligenceInoculation has no DI cost when detected', () => {
      const result = engine.applyCounterIntel({
        ...baseInput,
        counterType: CounterIntelType.IntelligenceInoculation,
        detected: true,
      });
      expect(result.diCost).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // assessBehavior (FR-1514)
  // ─────────────────────────────────────────────────────────────────────────

  describe('assessBehavior', () => {
    const stableState: EmotionalSnapshot = {
      stress: 40,
      confidence: 50,
      anger: 30,
      fear: 20,
      resolve: 60,
    };

    const baseInput: BehavioralAssessmentInput = {
      targetLeader: LEADER,
      previousEmotionalState: stableState,
      currentEmotionalState: stableState,
      humintClarity: 80,
    };

    it('returns no signals and stable shift when all deltas within ±5', () => {
      const result = engine.assessBehavior(baseInput);
      expect(result.signals.length).toBe(0);
      expect(result.overallShift).toBe('stable');
    });

    it('detects single rising signal with severe intensity for large delta', () => {
      const result = engine.assessBehavior({
        ...baseInput,
        currentEmotionalState: { ...stableState, anger: 52 }, // delta = 22
      });
      expect(result.signals.length).toBe(1);
      expect(result.signals[0].dimension).toBe('anger');
      expect(result.signals[0].trend).toBe('rising');
      expect(result.signals[0].intensity).toBe('severe');
      expect(result.overallShift).toBe('destabilized');
    });

    it('reports destabilized when two signals present', () => {
      const result = engine.assessBehavior({
        ...baseInput,
        currentEmotionalState: {
          ...stableState,
          anger: 45,      // delta = +15 → rising
          confidence: 35,  // delta = -15 → falling
        },
      });
      expect(result.signals.length).toBe(2);
      expect(result.overallShift).toBe('destabilized');
    });

    it('reports volatile when three or more signals present', () => {
      const result = engine.assessBehavior({
        ...baseInput,
        currentEmotionalState: {
          ...stableState,
          anger: 45,       // delta = +15 → rising
          confidence: 35,  // delta = -15 → falling
          stress: 55,      // delta = +15 → rising
        },
      });
      expect(result.signals.length).toBe(3);
      expect(result.overallShift).toBe('volatile');
    });

    it('classifies mild intensity for delta between 6 and 9', () => {
      const result = engine.assessBehavior({
        ...baseInput,
        currentEmotionalState: { ...stableState, anger: 38 }, // delta = 8
      });
      expect(result.signals.length).toBe(1);
      expect(result.signals[0].intensity).toBe('mild');
    });

    it('classifies moderate intensity for delta between 10 and 19', () => {
      const result = engine.assessBehavior({
        ...baseInput,
        currentEmotionalState: { ...stableState, anger: 45 }, // delta = 15
      });
      expect(result.signals.length).toBe(1);
      expect(result.signals[0].intensity).toBe('moderate');
    });

    it('classifies severe intensity for delta >= 20', () => {
      const result = engine.assessBehavior({
        ...baseInput,
        currentEmotionalState: { ...stableState, anger: 50 }, // delta = 20
      });
      expect(result.signals.length).toBe(1);
      expect(result.signals[0].intensity).toBe('severe');
    });

    it('scales assessment reliability by humintClarity / 100', () => {
      const r80 = engine.assessBehavior({ ...baseInput, humintClarity: 80 });
      expect(r80.assessmentReliability).toBe(0.8);

      const r0 = engine.assessBehavior({ ...baseInput, humintClarity: 0 });
      expect(r0.assessmentReliability).toBe(0);

      const r100 = engine.assessBehavior({ ...baseInput, humintClarity: 100 });
      expect(r100.assessmentReliability).toBe(1.0);
    });
  });
});
