/**
 * Unit tests for ProxyNetworkEngine.
 *
 * Covers discovery probability, discovery consequences, proxy operation
 * evaluation (Activate / Arm / PoliticalCampaign), and arming effects.
 *
 * @see FR-2001 — Proxy discovery probability and consequences
 * @see FR-2002 — Proxy operation evaluation and arming effects
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ProxyNetworkEngine } from '@/engine/proxy-network-engine';
import { GAME_CONFIG } from '@/engine/config';
import { ProxyOperationType } from '@/data/types';
import type { FactionId, TurnNumber } from '@/data/types';

const US = 'us' as FactionId;
const CHINA = 'china' as FactionId;
const IRAN = 'iran' as FactionId;
const TURN = 5 as TurnNumber;

describe('ProxyNetworkEngine', () => {
  let engine: ProxyNetworkEngine;

  beforeEach(() => {
    engine = new ProxyNetworkEngine(GAME_CONFIG.proxy);
  });

  // ─────────────────────────────────────────────────────────
  // computeDiscoveryProbability
  // ─────────────────────────────────────────────────────────

  describe('computeDiscoveryProbability', () => {
    it('returns probability 0 when deniability is 100', () => {
      const result = engine.computeDiscoveryProbability({
        deniability: 100,
        currentTurn: TURN,
      });
      expect(result.probability).toBe(0);
    });

    it('returns probability 1 when deniability is 0', () => {
      const result = engine.computeDiscoveryProbability({
        deniability: 0,
        currentTurn: TURN,
      });
      expect(result.probability).toBe(1);
    });

    it('returns probability 0.5 when deniability is 50', () => {
      const result = engine.computeDiscoveryProbability({
        deniability: 50,
        currentTurn: TURN,
      });
      expect(result.probability).toBeCloseTo(0.5);
    });

    it('returns probability 0.25 when deniability is 75', () => {
      const result = engine.computeDiscoveryProbability({
        deniability: 75,
        currentTurn: TURN,
      });
      expect(result.probability).toBeCloseTo(0.25);
    });

    it('clamps probability to 0 when deniability exceeds 100', () => {
      const result = engine.computeDiscoveryProbability({
        deniability: 150,
        currentTurn: TURN,
      });
      expect(result.probability).toBe(0);
    });

    it('includes a reason string referencing the turn', () => {
      const result = engine.computeDiscoveryProbability({
        deniability: 50,
        currentTurn: TURN,
      });
      expect(result.reason).toContain(String(TURN));
    });
  });

  // ─────────────────────────────────────────────────────────
  // evaluateDiscoveryConsequences
  // ─────────────────────────────────────────────────────────

  describe('evaluateDiscoveryConsequences', () => {
    it('returns tensionIncrease of 15', () => {
      const result = engine.evaluateDiscoveryConsequences({
        sponsorFaction: US,
        discoveredByFaction: CHINA,
        currentTurn: TURN,
      });
      expect(result.tensionIncrease).toBe(15);
    });

    it('returns legitimacyPenalty of -10', () => {
      const result = engine.evaluateDiscoveryConsequences({
        sponsorFaction: US,
        discoveredByFaction: CHINA,
        currentTurn: TURN,
      });
      expect(result.legitimacyPenalty).toBe(-10);
    });

    it('reason contains the sponsor faction name', () => {
      const result = engine.evaluateDiscoveryConsequences({
        sponsorFaction: US,
        discoveredByFaction: CHINA,
        currentTurn: TURN,
      });
      expect(result.reason).toContain(US);
    });

    it('reason contains the discoverer faction name', () => {
      const result = engine.evaluateDiscoveryConsequences({
        sponsorFaction: US,
        discoveredByFaction: IRAN,
        currentTurn: TURN,
      });
      expect(result.reason).toContain(IRAN);
    });
  });

  // ─────────────────────────────────────────────────────────
  // evaluateProxyOperation — Activate
  // ─────────────────────────────────────────────────────────

  describe('evaluateProxyOperation (Activate)', () => {
    it('computes effectScaling and discoveryProbability for capability=80 deniability=60', () => {
      const result = engine.evaluateProxyOperation({
        sponsorFaction: US,
        targetFaction: CHINA,
        operationType: ProxyOperationType.Activate,
        proxyCapability: 80,
        proxyDeniability: 60,
        currentTurn: TURN,
      });
      expect(result.effectScaling).toBeCloseTo(0.8);
      expect(result.discoveryProbability).toBeCloseTo(0.4);
    });

    it('returns effectScaling 0 when capability is 0', () => {
      const result = engine.evaluateProxyOperation({
        sponsorFaction: US,
        targetFaction: CHINA,
        operationType: ProxyOperationType.Activate,
        proxyCapability: 0,
        proxyDeniability: 50,
        currentTurn: TURN,
      });
      expect(result.effectScaling).toBe(0);
    });

    it('sets capabilityBoost, treasuryCost, diCost, and targetCivilUnrestIncrease to 0', () => {
      const result = engine.evaluateProxyOperation({
        sponsorFaction: US,
        targetFaction: CHINA,
        operationType: ProxyOperationType.Activate,
        proxyCapability: 80,
        proxyDeniability: 60,
        currentTurn: TURN,
      });
      expect(result.capabilityBoost).toBe(0);
      expect(result.treasuryCost).toBe(0);
      expect(result.diCost).toBe(0);
      expect(result.targetCivilUnrestIncrease).toBe(0);
    });

    it('reason contains sponsor and target factions', () => {
      const result = engine.evaluateProxyOperation({
        sponsorFaction: US,
        targetFaction: IRAN,
        operationType: ProxyOperationType.Activate,
        proxyCapability: 50,
        proxyDeniability: 50,
        currentTurn: TURN,
      });
      expect(result.reason).toContain(US);
      expect(result.reason).toContain(IRAN);
    });
  });

  // ─────────────────────────────────────────────────────────
  // evaluateProxyOperation — Arm
  // ─────────────────────────────────────────────────────────

  describe('evaluateProxyOperation (Arm)', () => {
    it('returns capabilityBoost=10, deniabilityReduction=-10, treasuryCost=-5', () => {
      const result = engine.evaluateProxyOperation({
        sponsorFaction: US,
        targetFaction: CHINA,
        operationType: ProxyOperationType.Arm,
        proxyCapability: 50,
        proxyDeniability: 50,
        currentTurn: TURN,
      });
      expect(result.capabilityBoost).toBe(10);
      expect(result.deniabilityReduction).toBe(-10);
      expect(result.treasuryCost).toBe(-5);
    });

    it('sets effectScaling, discoveryProbability, targetCivilUnrestIncrease, and diCost to 0', () => {
      const result = engine.evaluateProxyOperation({
        sponsorFaction: US,
        targetFaction: CHINA,
        operationType: ProxyOperationType.Arm,
        proxyCapability: 50,
        proxyDeniability: 50,
        currentTurn: TURN,
      });
      expect(result.effectScaling).toBe(0);
      expect(result.discoveryProbability).toBe(0);
      expect(result.targetCivilUnrestIncrease).toBe(0);
      expect(result.diCost).toBe(0);
    });

    it('reason mentions the Arm operation', () => {
      const result = engine.evaluateProxyOperation({
        sponsorFaction: US,
        targetFaction: IRAN,
        operationType: ProxyOperationType.Arm,
        proxyCapability: 40,
        proxyDeniability: 70,
        currentTurn: TURN,
      });
      expect(result.reason).toContain('Arm');
    });
  });

  // ─────────────────────────────────────────────────────────
  // evaluateProxyOperation — PoliticalCampaign
  // ─────────────────────────────────────────────────────────

  describe('evaluateProxyOperation (PoliticalCampaign)', () => {
    it('returns targetCivilUnrestIncrease=5, diCost=-3, deniabilityReduction=-5', () => {
      const result = engine.evaluateProxyOperation({
        sponsorFaction: US,
        targetFaction: CHINA,
        operationType: ProxyOperationType.PoliticalCampaign,
        proxyCapability: 50,
        proxyDeniability: 50,
        currentTurn: TURN,
      });
      expect(result.targetCivilUnrestIncrease).toBe(5);
      expect(result.diCost).toBe(-3);
      expect(result.deniabilityReduction).toBe(-5);
    });

    it('sets effectScaling, discoveryProbability, capabilityBoost, and treasuryCost to 0', () => {
      const result = engine.evaluateProxyOperation({
        sponsorFaction: US,
        targetFaction: CHINA,
        operationType: ProxyOperationType.PoliticalCampaign,
        proxyCapability: 50,
        proxyDeniability: 50,
        currentTurn: TURN,
      });
      expect(result.effectScaling).toBe(0);
      expect(result.discoveryProbability).toBe(0);
      expect(result.capabilityBoost).toBe(0);
      expect(result.treasuryCost).toBe(0);
    });

    it('reason mentions PoliticalCampaign', () => {
      const result = engine.evaluateProxyOperation({
        sponsorFaction: IRAN,
        targetFaction: US,
        operationType: ProxyOperationType.PoliticalCampaign,
        proxyCapability: 30,
        proxyDeniability: 80,
        currentTurn: TURN,
      });
      expect(result.reason).toContain('PoliticalCampaign');
    });
  });

  // ─────────────────────────────────────────────────────────
  // computeArmingEffects
  // ─────────────────────────────────────────────────────────

  describe('computeArmingEffects', () => {
    it('boosts capability by 10 and reduces deniability by 10 for mid-range values', () => {
      const result = engine.computeArmingEffects({
        sponsorFaction: US,
        currentCapability: 50,
        currentDeniability: 60,
        currentTurn: TURN,
      });
      expect(result.newCapability).toBe(60);
      expect(result.newDeniability).toBe(50);
      expect(result.treasuryCost).toBe(-5);
    });

    it('clamps capability to 100 and deniability to 0 at boundary values', () => {
      const result = engine.computeArmingEffects({
        sponsorFaction: CHINA,
        currentCapability: 95,
        currentDeniability: 5,
        currentTurn: TURN,
      });
      expect(result.newCapability).toBe(100);
      expect(result.newDeniability).toBe(0);
    });

    it('handles zero capability and full deniability', () => {
      const result = engine.computeArmingEffects({
        sponsorFaction: IRAN,
        currentCapability: 0,
        currentDeniability: 100,
        currentTurn: TURN,
      });
      expect(result.newCapability).toBe(10);
      expect(result.newDeniability).toBe(90);
    });

    it('always returns treasuryCost of -5', () => {
      const result = engine.computeArmingEffects({
        sponsorFaction: US,
        currentCapability: 20,
        currentDeniability: 80,
        currentTurn: TURN,
      });
      expect(result.treasuryCost).toBe(-5);
    });

    it('reason contains the sponsor faction', () => {
      const result = engine.computeArmingEffects({
        sponsorFaction: CHINA,
        currentCapability: 40,
        currentDeniability: 70,
        currentTurn: TURN,
      });
      expect(result.reason).toContain(CHINA);
    });

    it('reason contains the turn number', () => {
      const result = engine.computeArmingEffects({
        sponsorFaction: US,
        currentCapability: 50,
        currentDeniability: 50,
        currentTurn: TURN,
      });
      expect(result.reason).toContain(String(TURN));
    });
  });
});
