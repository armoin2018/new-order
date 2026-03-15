import { describe, it, expect, beforeEach } from 'vitest';
import { SanctionsEngine } from '@/engine/sanctions-engine';
import type {
  SwiftDisconnectionInput,
  SanctionTierInput,
  SanctionsFatigueInput,
} from '@/engine/sanctions-engine';
import { GAME_CONFIG } from '@/engine/config';
import { SanctionTier } from '@/data/types';
import type { FactionId, TurnNumber } from '@/data/types';

const US = 'us' as FactionId;
const RUSSIA = 'russia' as FactionId;
const TURN = 5 as TurnNumber;

describe('SanctionsEngine', () => {
  let engine: SanctionsEngine;

  beforeEach(() => {
    engine = new SanctionsEngine(GAME_CONFIG.financial);
  });

  // =========================================================================
  // evaluateSwiftDisconnection
  // =========================================================================

  describe('evaluateSwiftDisconnection', () => {
    const baseInput: SwiftDisconnectionInput = {
      imposerDI: 70,
      coalitionGDPShare: 0.7,
      targetFactionId: RUSSIA,
      turnsDisconnected: 0,
      currentTurn: TURN,
    };

    it('should be ineligible when DI < 60 AND coalitionGDP < 0.6', () => {
      const result = engine.evaluateSwiftDisconnection({
        ...baseInput,
        imposerDI: 50,
        coalitionGDPShare: 0.4,
      });

      expect(result.eligible).toBe(false);
      expect(result.targetTradeReduction).toBe(0);
      expect(result.targetGDPDecay).toBe(0);
      expect(result.altPaymentEffectiveness).toBe(0);
    });

    it('should be eligible when DI >= 60 (even if coalitionGDP < 0.6)', () => {
      const result = engine.evaluateSwiftDisconnection({
        ...baseInput,
        imposerDI: 60,
        coalitionGDPShare: 0.3,
      });

      expect(result.eligible).toBe(true);
      expect(result.targetTradeReduction).toBe(-0.7);
      expect(result.targetGDPDecay).toBe(-0.05);
    });

    it('should be eligible when coalitionGDP >= 0.6 (even if DI < 60)', () => {
      const result = engine.evaluateSwiftDisconnection({
        ...baseInput,
        imposerDI: 30,
        coalitionGDPShare: 0.6,
      });

      expect(result.eligible).toBe(true);
      expect(result.targetTradeReduction).toBe(-0.7);
      expect(result.targetGDPDecay).toBe(-0.05);
    });

    it('should be eligible when both thresholds are met', () => {
      const result = engine.evaluateSwiftDisconnection({
        ...baseInput,
        imposerDI: 80,
        coalitionGDPShare: 0.8,
      });

      expect(result.eligible).toBe(true);
      expect(result.targetTradeReduction).toBe(-0.7);
      expect(result.targetGDPDecay).toBe(-0.05);
    });

    it('should return altPaymentEffectiveness = 0 when turnsDisconnected = 0', () => {
      const result = engine.evaluateSwiftDisconnection({
        ...baseInput,
        turnsDisconnected: 0,
      });

      expect(result.eligible).toBe(true);
      expect(result.altPaymentEffectiveness).toBe(0);
    });

    it('should return altPaymentEffectiveness = 0.35 when turnsDisconnected = 1', () => {
      const result = engine.evaluateSwiftDisconnection({
        ...baseInput,
        turnsDisconnected: 1,
      });

      expect(result.eligible).toBe(true);
      // 0.3 + 1 * 0.05 = 0.35
      expect(result.altPaymentEffectiveness).toBeCloseTo(0.35, 10);
    });

    it('should cap altPaymentEffectiveness at 1.0 when many turns disconnected', () => {
      const result = engine.evaluateSwiftDisconnection({
        ...baseInput,
        turnsDisconnected: 20,
      });

      expect(result.eligible).toBe(true);
      // 0.3 + 20 * 0.05 = 1.3 → clamped to 1.0
      expect(result.altPaymentEffectiveness).toBe(1.0);
    });

    it('should include targetFactionId in the reason string when eligible', () => {
      const result = engine.evaluateSwiftDisconnection(baseInput);

      expect(result.reason).toContain(RUSSIA);
    });

    it('should include targetFactionId in the reason string when ineligible', () => {
      const result = engine.evaluateSwiftDisconnection({
        ...baseInput,
        imposerDI: 10,
        coalitionGDPShare: 0.1,
      });

      expect(result.eligible).toBe(false);
      expect(result.reason).toContain(RUSSIA);
    });

    it('should be eligible at boundary DI exactly 60', () => {
      const result = engine.evaluateSwiftDisconnection({
        ...baseInput,
        imposerDI: 60,
        coalitionGDPShare: 0.0,
      });

      expect(result.eligible).toBe(true);
    });

    it('should be eligible at boundary coalitionGDP exactly 0.6', () => {
      const result = engine.evaluateSwiftDisconnection({
        ...baseInput,
        imposerDI: 0,
        coalitionGDPShare: 0.6,
      });

      expect(result.eligible).toBe(true);
    });

    it('should compute altPaymentEffectiveness correctly for intermediate turns', () => {
      const result = engine.evaluateSwiftDisconnection({
        ...baseInput,
        turnsDisconnected: 5,
      });

      // 0.3 + 5 * 0.05 = 0.55
      expect(result.altPaymentEffectiveness).toBeCloseTo(0.55, 10);
    });

    it('should compute altPaymentEffectiveness at the cap boundary (14 turns)', () => {
      const result = engine.evaluateSwiftDisconnection({
        ...baseInput,
        turnsDisconnected: 14,
      });

      // 0.3 + 14 * 0.05 = 1.0 — exactly at the cap
      expect(result.altPaymentEffectiveness).toBeCloseTo(1.0, 10);
    });
  });

  // =========================================================================
  // applySanctionTier
  // =========================================================================

  describe('applySanctionTier', () => {
    const baseInput: SanctionTierInput = {
      imposerFaction: US,
      targetFaction: RUSSIA,
      tier: SanctionTier.Targeted,
      sectorCount: 1,
      turnsActive: 1,
      fatigueDecay: 0,
      targetIsWeak: false,
      currentTurn: TURN,
    };

    // ── Targeted ──────────────────────────────────────────────────────────

    it('Targeted: should apply oligarchsHit = -10 * mult and imposer diCost = -3', () => {
      const result = engine.applySanctionTier({
        ...baseInput,
        tier: SanctionTier.Targeted,
        fatigueDecay: 0,
      });

      expect(result.tier).toBe(SanctionTier.Targeted);
      expect(result.effectivenessMultiplier).toBeCloseTo(1.0, 10);
      expect(result.targetEffects.oligarchsHit).toBeCloseTo(-10, 10);
      expect(result.targetEffects.gdpDecay).toBe(0);
      expect(result.targetEffects.treasuryHit).toBe(0);
      expect(result.targetEffects.civilUnrestPerTurn).toBe(0);
      expect(result.imposerEffects.diCost).toBe(-3);
      expect(result.imposerEffects.ownTradeReduction).toBe(0);
      expect(result.imposerEffects.legitimacyCost).toBe(0);
    });

    // ── Sectoral ──────────────────────────────────────────────────────────

    it('Sectoral: should apply gdpDecay = -0.02 * sectorCount * mult with 1 sector', () => {
      const result = engine.applySanctionTier({
        ...baseInput,
        tier: SanctionTier.Sectoral,
        sectorCount: 1,
        fatigueDecay: 0,
      });

      expect(result.tier).toBe(SanctionTier.Sectoral);
      expect(result.targetEffects.gdpDecay).toBeCloseTo(-0.02, 10);
      expect(result.targetEffects.oligarchsHit).toBe(0);
      expect(result.targetEffects.treasuryHit).toBe(0);
      expect(result.targetEffects.civilUnrestPerTurn).toBe(0);
      expect(result.imposerEffects.ownTradeReduction).toBe(-0.5);
      expect(result.imposerEffects.diCost).toBe(0);
      expect(result.imposerEffects.legitimacyCost).toBe(0);
    });

    it('Sectoral with 3 sectors: should apply gdpDecay = -0.06 * mult', () => {
      const result = engine.applySanctionTier({
        ...baseInput,
        tier: SanctionTier.Sectoral,
        sectorCount: 3,
        fatigueDecay: 0,
      });

      // -0.02 * 3 * 1.0 = -0.06
      expect(result.targetEffects.gdpDecay).toBeCloseTo(-0.06, 10);
    });

    // ── Comprehensive ─────────────────────────────────────────────────────

    it('Comprehensive: should apply gdpDecay, treasuryHit, and civilUnrest', () => {
      const result = engine.applySanctionTier({
        ...baseInput,
        tier: SanctionTier.Comprehensive,
        fatigueDecay: 0,
        targetIsWeak: false,
      });

      expect(result.tier).toBe(SanctionTier.Comprehensive);
      expect(result.effectivenessMultiplier).toBeCloseTo(1.0, 10);
      expect(result.targetEffects.gdpDecay).toBeCloseTo(-0.05, 10);
      expect(result.targetEffects.treasuryHit).toBeCloseTo(-0.4, 10);
      expect(result.targetEffects.civilUnrestPerTurn).toBeCloseTo(5, 10);
      expect(result.targetEffects.oligarchsHit).toBe(0);
    });

    it('Comprehensive with targetIsWeak=true: imposer legitimacyCost = -5', () => {
      const result = engine.applySanctionTier({
        ...baseInput,
        tier: SanctionTier.Comprehensive,
        targetIsWeak: true,
      });

      expect(result.imposerEffects.legitimacyCost).toBe(-5);
    });

    it('Comprehensive with targetIsWeak=false: imposer legitimacyCost = 0', () => {
      const result = engine.applySanctionTier({
        ...baseInput,
        tier: SanctionTier.Comprehensive,
        targetIsWeak: false,
      });

      expect(result.imposerEffects.legitimacyCost).toBe(0);
    });

    // ── Fatigue effects on multiplier ─────────────────────────────────────

    it('Fatigue 0: multiplier = 1.0, effects at full strength', () => {
      const result = engine.applySanctionTier({
        ...baseInput,
        tier: SanctionTier.Targeted,
        fatigueDecay: 0,
      });

      expect(result.effectivenessMultiplier).toBeCloseTo(1.0, 10);
      expect(result.targetEffects.oligarchsHit).toBeCloseTo(-10, 10);
    });

    it('Fatigue 0.5: multiplier = 0.5, effects halved', () => {
      const result = engine.applySanctionTier({
        ...baseInput,
        tier: SanctionTier.Targeted,
        fatigueDecay: 0.5,
      });

      expect(result.effectivenessMultiplier).toBeCloseTo(0.5, 10);
      // -10 * 0.5 = -5
      expect(result.targetEffects.oligarchsHit).toBeCloseTo(-5, 10);
    });

    it('Fatigue 1.0: multiplier = 0.0, all target effects zeroed', () => {
      const result = engine.applySanctionTier({
        ...baseInput,
        tier: SanctionTier.Comprehensive,
        fatigueDecay: 1.0,
      });

      expect(result.effectivenessMultiplier).toBeCloseTo(0.0, 10);
      expect(result.targetEffects.gdpDecay).toBeCloseTo(0, 10);
      expect(result.targetEffects.treasuryHit).toBeCloseTo(0, 10);
      expect(result.targetEffects.civilUnrestPerTurn).toBeCloseTo(0, 10);
      expect(result.targetEffects.oligarchsHit).toBe(0);
    });

    it('Fatigue > 1: multiplier clamped to 0', () => {
      const result = engine.applySanctionTier({
        ...baseInput,
        tier: SanctionTier.Sectoral,
        sectorCount: 2,
        fatigueDecay: 1.5,
      });

      expect(result.effectivenessMultiplier).toBeCloseTo(0.0, 10);
      expect(result.targetEffects.gdpDecay).toBeCloseTo(0, 10);
    });

    it('Fatigue applied to Sectoral with 3 sectors: gdpDecay halved', () => {
      const result = engine.applySanctionTier({
        ...baseInput,
        tier: SanctionTier.Sectoral,
        sectorCount: 3,
        fatigueDecay: 0.5,
      });

      // -0.02 * 3 * 0.5 = -0.03
      expect(result.effectivenessMultiplier).toBeCloseTo(0.5, 10);
      expect(result.targetEffects.gdpDecay).toBeCloseTo(-0.03, 10);
    });

    it('Fatigue applied to Comprehensive: all target effects scale', () => {
      const result = engine.applySanctionTier({
        ...baseInput,
        tier: SanctionTier.Comprehensive,
        fatigueDecay: 0.3,
        targetIsWeak: true,
      });

      const mult = 0.7;
      expect(result.effectivenessMultiplier).toBeCloseTo(mult, 10);
      expect(result.targetEffects.gdpDecay).toBeCloseTo(-0.05 * mult, 10);
      expect(result.targetEffects.treasuryHit).toBeCloseTo(-0.4 * mult, 10);
      expect(result.targetEffects.civilUnrestPerTurn).toBeCloseTo(5 * mult, 10);
      // imposer legitimacy cost is NOT affected by fatigue
      expect(result.imposerEffects.legitimacyCost).toBe(-5);
    });

    it('reason string contains imposer and target faction IDs', () => {
      const result = engine.applySanctionTier(baseInput);

      expect(result.reason).toContain(US);
      expect(result.reason).toContain(RUSSIA);
    });
  });

  // =========================================================================
  // computeSanctionsFatigue
  // =========================================================================

  describe('computeSanctionsFatigue', () => {
    const baseInput: SanctionsFatigueInput = {
      currentFatigue: 0,
      turnsActive: 1,
      evasionNetworkCount: 0,
      currentTurn: TURN,
    };

    it('should grow fatigue from 0 by base decay alone (no evasion)', () => {
      const result = engine.computeSanctionsFatigue(baseInput);

      // 0 + 0.05 + 0 = 0.05
      expect(result.previousFatigue).toBe(0);
      expect(result.newFatigue).toBeCloseTo(0.05, 10);
      expect(result.fatigueGrowth).toBeCloseTo(0.05, 10);
      expect(result.effectivenessRemaining).toBeCloseTo(0.95, 10);
    });

    it('should add evasion network contribution (2 networks)', () => {
      const result = engine.computeSanctionsFatigue({
        ...baseInput,
        evasionNetworkCount: 2,
      });

      // 0 + 0.05 + 2*0.1 = 0.25
      expect(result.newFatigue).toBeCloseTo(0.25, 10);
      expect(result.effectivenessRemaining).toBeCloseTo(0.75, 10);
    });

    it('should clamp newFatigue at 1.0', () => {
      const result = engine.computeSanctionsFatigue({
        ...baseInput,
        currentFatigue: 0.98,
      });

      // 0.98 + 0.05 + 0 = 1.03 → clamped to 1.0
      expect(result.newFatigue).toBe(1.0);
      expect(result.effectivenessRemaining).toBe(0);
    });

    it('should clamp effectivenessRemaining to [0, 1]', () => {
      const result = engine.computeSanctionsFatigue({
        ...baseInput,
        currentFatigue: 0.96,
        evasionNetworkCount: 1,
      });

      // 0.96 + 0.05 + 0.1 = 1.11 → clamped to 1.0
      expect(result.newFatigue).toBe(1.0);
      expect(result.effectivenessRemaining).toBe(0);
    });

    it('should compute fatigueGrowth = newFatigue - currentFatigue', () => {
      const result = engine.computeSanctionsFatigue({
        ...baseInput,
        currentFatigue: 0.2,
        evasionNetworkCount: 1,
      });

      // 0.2 + 0.05 + 0.1 = 0.35
      expect(result.newFatigue).toBeCloseTo(0.35, 10);
      expect(result.fatigueGrowth).toBeCloseTo(0.15, 10);
    });

    it('should preserve previousFatigue from input', () => {
      const result = engine.computeSanctionsFatigue({
        ...baseInput,
        currentFatigue: 0.42,
      });

      expect(result.previousFatigue).toBe(0.42);
    });

    it('should handle high evasion network counts', () => {
      const result = engine.computeSanctionsFatigue({
        ...baseInput,
        currentFatigue: 0,
        evasionNetworkCount: 5,
      });

      // 0 + 0.05 + 5*0.1 = 0.55
      expect(result.newFatigue).toBeCloseTo(0.55, 10);
      expect(result.effectivenessRemaining).toBeCloseTo(0.45, 10);
    });

    it('should clamp when evasion networks push fatigue above 1', () => {
      const result = engine.computeSanctionsFatigue({
        ...baseInput,
        currentFatigue: 0.5,
        evasionNetworkCount: 10,
      });

      // 0.5 + 0.05 + 10*0.1 = 1.55 → clamped to 1.0
      expect(result.newFatigue).toBe(1.0);
      expect(result.fatigueGrowth).toBeCloseTo(0.5, 10);
      expect(result.effectivenessRemaining).toBe(0);
    });

    it('should compute correctly at mid-range fatigue', () => {
      const result = engine.computeSanctionsFatigue({
        ...baseInput,
        currentFatigue: 0.5,
        evasionNetworkCount: 1,
      });

      // 0.5 + 0.05 + 0.1 = 0.65
      expect(result.newFatigue).toBeCloseTo(0.65, 10);
      expect(result.fatigueGrowth).toBeCloseTo(0.15, 10);
      expect(result.effectivenessRemaining).toBeCloseTo(0.35, 10);
    });

    it('should include turn number in reason string', () => {
      const result = engine.computeSanctionsFatigue({
        ...baseInput,
        currentTurn: 12 as TurnNumber,
      });

      expect(result.reason).toContain('12');
    });

    it('should handle zero evasion with existing fatigue', () => {
      const result = engine.computeSanctionsFatigue({
        ...baseInput,
        currentFatigue: 0.7,
        evasionNetworkCount: 0,
      });

      // 0.7 + 0.05 + 0 = 0.75
      expect(result.newFatigue).toBeCloseTo(0.75, 10);
      expect(result.effectivenessRemaining).toBeCloseTo(0.25, 10);
    });

    it('fatigueGrowth is reduced when clamped at ceiling', () => {
      const result = engine.computeSanctionsFatigue({
        ...baseInput,
        currentFatigue: 0.99,
        evasionNetworkCount: 0,
      });

      // raw = 0.99 + 0.05 = 1.04 → clamped to 1.0
      // growth = 1.0 - 0.99 = 0.01
      expect(result.newFatigue).toBe(1.0);
      expect(result.fatigueGrowth).toBeCloseTo(0.01, 10);
    });
  });
});
