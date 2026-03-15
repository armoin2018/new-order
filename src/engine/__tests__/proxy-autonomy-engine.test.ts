/**
 * Proxy Autonomy Engine — Unit Tests
 *
 * Covers autonomous operations, defection risk, independence evaluation,
 * deniability degradation by source, and blowback consequences.
 *
 * @see FR-2003 — Proxy autonomy, defection, independence, and blowback
 * @see FR-2006 — Deniability degradation by source type
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ProxyAutonomyEngine } from '@/engine/proxy-autonomy-engine';
import { GAME_CONFIG } from '@/engine/config';
import { DeniabilitySource } from '@/data/types';
import type { FactionId, TurnNumber } from '@/data/types';

const US = 'us' as FactionId;
const CHINA = 'china' as FactionId;
const IRAN = 'iran' as FactionId;
const TURN = 5 as TurnNumber;

describe('ProxyAutonomyEngine', () => {
  let engine: ProxyAutonomyEngine;

  beforeEach(() => {
    engine = new ProxyAutonomyEngine(GAME_CONFIG.proxy);
  });

  // ─────────────────────────────────────────────────────────
  // evaluateAutonomousOperation
  // ─────────────────────────────────────────────────────────

  describe('evaluateAutonomousOperation', () => {
    it('should mark proxy as eligible when autonomy exceeds threshold (61 > 60)', () => {
      const result = engine.evaluateAutonomousOperation({
        factionId: US,
        proxyAutonomy: 61,
        proxyDeniability: 70,
        currentTurn: TURN,
      });

      expect(result.eligible).toBe(true);
      expect(result.operationChance).toBeCloseTo(0.3);
      expect(result.useSponsorDeniability).toBe(true);
      expect(result.reason).toContain('eligible for autonomous operations');
    });

    it('should mark proxy as NOT eligible when autonomy equals threshold (60 <= 60)', () => {
      const result = engine.evaluateAutonomousOperation({
        factionId: CHINA,
        proxyAutonomy: 60,
        proxyDeniability: 50,
        currentTurn: TURN,
      });

      expect(result.eligible).toBe(false);
      expect(result.operationChance).toBe(0);
      expect(result.useSponsorDeniability).toBe(false);
      expect(result.reason).toContain('NOT eligible');
    });

    it('should mark proxy as eligible when autonomy is at maximum (100 > 60)', () => {
      const result = engine.evaluateAutonomousOperation({
        factionId: IRAN,
        proxyAutonomy: 100,
        proxyDeniability: 90,
        currentTurn: TURN,
      });

      expect(result.eligible).toBe(true);
      expect(result.operationChance).toBeCloseTo(0.3);
      expect(result.useSponsorDeniability).toBe(true);
      expect(result.reason).toContain('eligible for autonomous operations');
    });

    it('should mark proxy as NOT eligible when autonomy is zero', () => {
      const result = engine.evaluateAutonomousOperation({
        factionId: US,
        proxyAutonomy: 0,
        proxyDeniability: 50,
        currentTurn: TURN,
      });

      expect(result.eligible).toBe(false);
      expect(result.operationChance).toBe(0);
      expect(result.useSponsorDeniability).toBe(false);
      expect(result.reason).toContain('NOT eligible');
    });

    it('should include faction and turn in the reason string', () => {
      const result = engine.evaluateAutonomousOperation({
        factionId: IRAN,
        proxyAutonomy: 61,
        proxyDeniability: 50,
        currentTurn: TURN,
      });

      expect(result.reason).toContain(String(IRAN));
      expect(result.reason).toContain(String(TURN));
    });
  });

  // ─────────────────────────────────────────────────────────
  // evaluateDefectionRisk
  // ─────────────────────────────────────────────────────────

  describe('evaluateDefectionRisk', () => {
    it('should flag at-risk when loyalty is below threshold (29 < 30)', () => {
      const result = engine.evaluateDefectionRisk({
        factionId: US,
        proxyLoyalty: 29,
        rivalOfferBonus: 0,
        currentTurn: TURN,
      });

      expect(result.atRisk).toBe(true);
      expect(result.effectiveLoyalty).toBe(29);
      expect(result.reason).toContain('AT RISK');
    });

    it('should NOT flag at-risk when loyalty equals threshold (30 >= 30)', () => {
      const result = engine.evaluateDefectionRisk({
        factionId: CHINA,
        proxyLoyalty: 30,
        rivalOfferBonus: 0,
        currentTurn: TURN,
      });

      expect(result.atRisk).toBe(false);
      expect(result.effectiveLoyalty).toBe(30);
      expect(result.reason).toContain('NOT at risk');
    });

    it('should NOT flag at-risk when loyalty is high with no rival offer', () => {
      const result = engine.evaluateDefectionRisk({
        factionId: US,
        proxyLoyalty: 50,
        rivalOfferBonus: 0,
        currentTurn: TURN,
      });

      expect(result.atRisk).toBe(false);
      expect(result.effectiveLoyalty).toBe(50);
      expect(result.reason).toContain('NOT at risk');
    });

    it('should reduce effective loyalty by rival offer bonus but keep atRisk based on raw loyalty', () => {
      const result = engine.evaluateDefectionRisk({
        factionId: IRAN,
        proxyLoyalty: 50,
        rivalOfferBonus: 30,
        currentTurn: TURN,
      });

      expect(result.atRisk).toBe(false);
      expect(result.effectiveLoyalty).toBe(20);
      expect(result.reason).toContain('NOT at risk');
    });

    it('should clamp effective loyalty to 0 when rival offer exceeds loyalty', () => {
      const result = engine.evaluateDefectionRisk({
        factionId: US,
        proxyLoyalty: 10,
        rivalOfferBonus: 20,
        currentTurn: TURN,
      });

      expect(result.atRisk).toBe(true);
      expect(result.effectiveLoyalty).toBe(0);
      expect(result.reason).toContain('AT RISK');
    });
  });

  // ─────────────────────────────────────────────────────────
  // evaluateIndependence
  // ─────────────────────────────────────────────────────────

  describe('evaluateIndependence', () => {
    it('should declare independence when both thresholds exceeded (81 > 80, 81 > 80)', () => {
      const result = engine.evaluateIndependence({
        factionId: US,
        proxyCapability: 81,
        proxyAutonomy: 81,
        currentTurn: TURN,
      });

      expect(result.independent).toBe(true);
      expect(result.reason).toContain('INDEPENDENCE');
    });

    it('should NOT declare independence when capability equals threshold (80 is NOT > 80)', () => {
      const result = engine.evaluateIndependence({
        factionId: CHINA,
        proxyCapability: 80,
        proxyAutonomy: 81,
        currentTurn: TURN,
      });

      expect(result.independent).toBe(false);
      expect(result.reason).toContain('does NOT meet independence thresholds');
    });

    it('should NOT declare independence when autonomy equals threshold (80 is NOT > 80)', () => {
      const result = engine.evaluateIndependence({
        factionId: IRAN,
        proxyCapability: 81,
        proxyAutonomy: 80,
        currentTurn: TURN,
      });

      expect(result.independent).toBe(false);
      expect(result.reason).toContain('does NOT meet independence thresholds');
    });

    it('should NOT declare independence when neither threshold exceeded (80, 80)', () => {
      const result = engine.evaluateIndependence({
        factionId: US,
        proxyCapability: 80,
        proxyAutonomy: 80,
        currentTurn: TURN,
      });

      expect(result.independent).toBe(false);
      expect(result.reason).toContain('does NOT meet independence thresholds');
    });

    it('should declare independence at maximum values (100, 100)', () => {
      const result = engine.evaluateIndependence({
        factionId: CHINA,
        proxyCapability: 100,
        proxyAutonomy: 100,
        currentTurn: TURN,
      });

      expect(result.independent).toBe(true);
      expect(result.reason).toContain('INDEPENDENCE');
    });
  });

  // ─────────────────────────────────────────────────────────
  // evaluateDeniabilityDegradation
  // ─────────────────────────────────────────────────────────

  describe('evaluateDeniabilityDegradation', () => {
    it('should degrade deniability by -10 for Arming source', () => {
      const result = engine.evaluateDeniabilityDegradation({
        factionId: US,
        currentDeniability: 50,
        source: DeniabilitySource.Arming,
        currentTurn: TURN,
      });

      expect(result.newDeniability).toBe(40);
      expect(result.degradation).toBe(-10);
      expect(result.isPublicKnowledge).toBe(false);
      expect(result.reason).toContain('Arming');
    });

    it('should degrade deniability by -5 for Directing source', () => {
      const result = engine.evaluateDeniabilityDegradation({
        factionId: CHINA,
        currentDeniability: 50,
        source: DeniabilitySource.Directing,
        currentTurn: TURN,
      });

      expect(result.newDeniability).toBe(45);
      expect(result.degradation).toBe(-5);
      expect(result.isPublicKnowledge).toBe(false);
      expect(result.reason).toContain('Directing');
    });

    it('should degrade deniability by -15 for MediaExposure source', () => {
      const result = engine.evaluateDeniabilityDegradation({
        factionId: IRAN,
        currentDeniability: 50,
        source: DeniabilitySource.MediaExposure,
        currentTurn: TURN,
      });

      expect(result.newDeniability).toBe(35);
      expect(result.degradation).toBe(-15);
      expect(result.isPublicKnowledge).toBe(false);
      expect(result.reason).toContain('MediaExposure');
    });

    it('should degrade deniability by -20 for Humint source', () => {
      const result = engine.evaluateDeniabilityDegradation({
        factionId: US,
        currentDeniability: 50,
        source: DeniabilitySource.Humint,
        currentTurn: TURN,
      });

      expect(result.newDeniability).toBe(30);
      expect(result.degradation).toBe(-20);
      expect(result.isPublicKnowledge).toBe(false);
      expect(result.reason).toContain('Humint');
    });

    it('should clamp deniability to 0 and flag public knowledge (Arming, den=5)', () => {
      const result = engine.evaluateDeniabilityDegradation({
        factionId: US,
        currentDeniability: 5,
        source: DeniabilitySource.Arming,
        currentTurn: TURN,
      });

      expect(result.newDeniability).toBe(0);
      expect(result.degradation).toBe(-10);
      expect(result.isPublicKnowledge).toBe(true);
      expect(result.reason).toContain('PUBLIC KNOWLEDGE');
    });

    it('should clamp deniability to 0 and flag public knowledge (Humint, den=15)', () => {
      const result = engine.evaluateDeniabilityDegradation({
        factionId: CHINA,
        currentDeniability: 15,
        source: DeniabilitySource.Humint,
        currentTurn: TURN,
      });

      expect(result.newDeniability).toBe(0);
      expect(result.degradation).toBe(-20);
      expect(result.isPublicKnowledge).toBe(true);
      expect(result.reason).toContain('PUBLIC KNOWLEDGE');
    });

    it('should NOT flag public knowledge when deniability remains positive (Arming, den=100)', () => {
      const result = engine.evaluateDeniabilityDegradation({
        factionId: IRAN,
        currentDeniability: 100,
        source: DeniabilitySource.Arming,
        currentTurn: TURN,
      });

      expect(result.newDeniability).toBe(90);
      expect(result.degradation).toBe(-10);
      expect(result.isPublicKnowledge).toBe(false);
    });

    it('should reach exactly zero and flag public knowledge (Directing, den=5)', () => {
      const result = engine.evaluateDeniabilityDegradation({
        factionId: US,
        currentDeniability: 5,
        source: DeniabilitySource.Directing,
        currentTurn: TURN,
      });

      expect(result.newDeniability).toBe(0);
      expect(result.degradation).toBe(-5);
      expect(result.isPublicKnowledge).toBe(true);
      expect(result.reason).toContain('PUBLIC KNOWLEDGE');
    });

    it('should include faction, turn, and source in the reason string', () => {
      const result = engine.evaluateDeniabilityDegradation({
        factionId: CHINA,
        currentDeniability: 80,
        source: DeniabilitySource.MediaExposure,
        currentTurn: TURN,
      });

      expect(result.reason).toContain(String(CHINA));
      expect(result.reason).toContain(String(TURN));
      expect(result.reason).toContain('MediaExposure');
    });
  });

  // ─────────────────────────────────────────────────────────
  // evaluateBlowback
  // ─────────────────────────────────────────────────────────

  describe('evaluateBlowback', () => {
    it('should be hostile and capturable when abandoned with low loyalty and high capability', () => {
      const result = engine.evaluateBlowback({
        factionId: US,
        proxyCapability: 60,
        proxyLoyalty: 20,
        wasAbandoned: true,
        currentTurn: TURN,
      });

      expect(result.hostile).toBe(true);
      expect(result.capturedByRival).toBe(true);
      expect(result.threatLevel).toBe(40);
      expect(result.reason).toContain('HOSTILE');
      expect(result.reason).toContain('CAPTURED BY RIVAL');
    });

    it('should be hostile but NOT capturable when abandoned with low loyalty and low capability', () => {
      const result = engine.evaluateBlowback({
        factionId: CHINA,
        proxyCapability: 40,
        proxyLoyalty: 20,
        wasAbandoned: true,
        currentTurn: TURN,
      });

      expect(result.hostile).toBe(true);
      expect(result.capturedByRival).toBe(false);
      expect(result.threatLevel).toBe(20);
      expect(result.reason).toContain('HOSTILE');
    });

    it('should NOT be hostile when abandoned but loyalty is above threshold (40 >= 30)', () => {
      const result = engine.evaluateBlowback({
        factionId: IRAN,
        proxyCapability: 60,
        proxyLoyalty: 40,
        wasAbandoned: true,
        currentTurn: TURN,
      });

      expect(result.hostile).toBe(false);
      expect(result.capturedByRival).toBe(true);
      expect(result.threatLevel).toBe(0);
      expect(result.reason).toContain('NOT hostile');
      expect(result.reason).toContain('CAPTURED BY RIVAL');
    });

    it('should NOT be hostile or capturable when not abandoned regardless of stats', () => {
      const result = engine.evaluateBlowback({
        factionId: US,
        proxyCapability: 90,
        proxyLoyalty: 10,
        wasAbandoned: false,
        currentTurn: TURN,
      });

      expect(result.hostile).toBe(false);
      expect(result.capturedByRival).toBe(false);
      expect(result.threatLevel).toBe(0);
      expect(result.reason).toContain('NOT hostile');
    });

    it('should produce maximum threat level when abandoned with zero loyalty and max capability', () => {
      const result = engine.evaluateBlowback({
        factionId: CHINA,
        proxyCapability: 100,
        proxyLoyalty: 0,
        wasAbandoned: true,
        currentTurn: TURN,
      });

      expect(result.hostile).toBe(true);
      expect(result.capturedByRival).toBe(true);
      expect(result.threatLevel).toBe(100);
      expect(result.reason).toContain('HOSTILE');
      expect(result.reason).toContain('CAPTURED BY RIVAL');
    });

    it('should include faction and turn in the blowback reason', () => {
      const result = engine.evaluateBlowback({
        factionId: IRAN,
        proxyCapability: 30,
        proxyLoyalty: 50,
        wasAbandoned: false,
        currentTurn: TURN,
      });

      expect(result.reason).toContain(String(IRAN));
      expect(result.reason).toContain(String(TURN));
    });
  });
});
