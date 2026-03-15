/**
 * Arms Bazaar & Failed State Exploitation Engine — Unit Tests
 *
 * Validates black-market pricing, surplus sales, failed-state classification,
 * exploitation legitimacy effects, stabilization progress, and proxy-spawn
 * timing against configured thresholds and multipliers.
 *
 * @see FR-2004 — Arms Bazaar: black-market pricing, surplus sales, weapon leaks
 * @see FR-2005 — Failed State Exploitation: classification, peacekeeping,
 *                stabilization, proxy spawning
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ArmsFailedStateEngine } from '@/engine/arms-failedstate-engine';
import { GAME_CONFIG } from '@/engine/config';
import type { FactionId, TurnNumber } from '@/data/types';

const US = 'us' as FactionId;
const IRAN = 'iran' as FactionId;
const RUSSIA = 'russia' as FactionId;
const SYRIA = 'syria' as FactionId;
const TURN = 5 as TurnNumber;

describe('ArmsFailedStateEngine', () => {
  let engine: ArmsFailedStateEngine;

  beforeEach(() => {
    engine = new ArmsFailedStateEngine(GAME_CONFIG.proxy);
  });

  // ─────────────────────────────────────────────────────────
  // computeBlackMarketPurchase
  // ─────────────────────────────────────────────────────────

  describe('computeBlackMarketPurchase', () => {
    it('should double the price for a sanctioned buyer (basePrice=100)', () => {
      const result = engine.computeBlackMarketPurchase({
        buyerFaction: IRAN,
        basePrice: 100,
        isSanctioned: true,
        currentTurn: TURN,
      });

      expect(result.finalPrice).toBe(200);
      expect(result.deliveryDelay).toBe(2);
      expect(result.defectiveChance).toBeCloseTo(0.2);
      expect(result.reason).toContain('sanctioned');
    });

    it('should return standard pricing for a non-sanctioned buyer (basePrice=100)', () => {
      const result = engine.computeBlackMarketPurchase({
        buyerFaction: US,
        basePrice: 100,
        isSanctioned: false,
        currentTurn: TURN,
      });

      expect(result.finalPrice).toBe(100);
      expect(result.deliveryDelay).toBe(0);
      expect(result.defectiveChance).toBe(0);
      expect(result.reason).toContain('not sanctioned');
    });

    it('should double the price for a sanctioned buyer (basePrice=50)', () => {
      const result = engine.computeBlackMarketPurchase({
        buyerFaction: IRAN,
        basePrice: 50,
        isSanctioned: true,
        currentTurn: TURN,
      });

      expect(result.finalPrice).toBe(100);
      expect(result.reason).toContain('sanctioned');
    });

    it('should return 0 final price when basePrice is 0 and sanctioned', () => {
      const result = engine.computeBlackMarketPurchase({
        buyerFaction: IRAN,
        basePrice: 0,
        isSanctioned: true,
        currentTurn: TURN,
      });

      expect(result.finalPrice).toBe(0);
      expect(result.reason).toContain('sanctioned');
    });
  });

  // ─────────────────────────────────────────────────────────
  // computeSurplusSale
  // ─────────────────────────────────────────────────────────

  describe('computeSurplusSale', () => {
    it('should return 50% revenue and weapon leak chance for baseValue=100', () => {
      const result = engine.computeSurplusSale({
        sellerFaction: RUSSIA,
        baseValue: 100,
        currentTurn: TURN,
      });

      expect(result.saleRevenue).toBe(50);
      expect(result.weaponLeakChance).toBeCloseTo(0.1);
      expect(result.reason).toContain('surplus');
    });

    it('should return 100 revenue for baseValue=200', () => {
      const result = engine.computeSurplusSale({
        sellerFaction: RUSSIA,
        baseValue: 200,
        currentTurn: TURN,
      });

      expect(result.saleRevenue).toBe(100);
      expect(result.reason).toContain('surplus');
    });

    it('should return 0 revenue for baseValue=0', () => {
      const result = engine.computeSurplusSale({
        sellerFaction: US,
        baseValue: 0,
        currentTurn: TURN,
      });

      expect(result.saleRevenue).toBe(0);
      expect(result.reason).toContain('surplus');
    });
  });

  // ─────────────────────────────────────────────────────────
  // evaluateFailedState
  // ─────────────────────────────────────────────────────────

  describe('evaluateFailedState', () => {
    it('should classify stability=9 as a failed state', () => {
      const result = engine.evaluateFailedState({
        targetFaction: SYRIA,
        targetStability: 9,
        currentTurn: TURN,
      });

      expect(result.isFailed).toBe(true);
      expect(result.intelCostReduction).toBeCloseTo(0.5);
      expect(result.proxySpawnRateTurns).toBe(3);
      expect(result.reason).toContain('failed state');
    });

    it('should NOT classify stability=10 as a failed state (threshold is strict <)', () => {
      const result = engine.evaluateFailedState({
        targetFaction: SYRIA,
        targetStability: 10,
        currentTurn: TURN,
      });

      expect(result.isFailed).toBe(false);
      expect(result.intelCostReduction).toBe(0);
      expect(result.proxySpawnRateTurns).toBe(0);
      expect(result.reason).toContain('not a failed state');
    });

    it('should classify stability=0 as a failed state', () => {
      const result = engine.evaluateFailedState({
        targetFaction: SYRIA,
        targetStability: 0,
        currentTurn: TURN,
      });

      expect(result.isFailed).toBe(true);
      expect(result.intelCostReduction).toBeCloseTo(0.5);
      expect(result.proxySpawnRateTurns).toBe(3);
      expect(result.reason).toContain('failed state');
    });

    it('should NOT classify stability=50 as a failed state', () => {
      const result = engine.evaluateFailedState({
        targetFaction: IRAN,
        targetStability: 50,
        currentTurn: TURN,
      });

      expect(result.isFailed).toBe(false);
      expect(result.intelCostReduction).toBe(0);
      expect(result.proxySpawnRateTurns).toBe(0);
      expect(result.reason).toContain('not a failed state');
    });
  });

  // ─────────────────────────────────────────────────────────
  // evaluateFailedStateExploitation
  // ─────────────────────────────────────────────────────────

  describe('evaluateFailedStateExploitation', () => {
    it('should grant +10 legitimacy for peacekeeping', () => {
      const result = engine.evaluateFailedStateExploitation({
        exploiterFaction: US,
        isPeacekeeping: true,
        currentTurn: TURN,
      });

      expect(result.legitimacyChange).toBe(10);
      expect(result.reason).toContain('peacekeeping');
    });

    it('should impose -10 legitimacy for exploitation', () => {
      const result = engine.evaluateFailedStateExploitation({
        exploiterFaction: RUSSIA,
        isPeacekeeping: false,
        currentTurn: TURN,
      });

      expect(result.legitimacyChange).toBe(-10);
      expect(result.reason).toContain('exploits');
    });
  });

  // ─────────────────────────────────────────────────────────
  // computeStabilizationEffort
  // ─────────────────────────────────────────────────────────

  describe('computeStabilizationEffort', () => {
    it('should be complete when turnsInvested equals stabilizationTurns (6)', () => {
      const result = engine.computeStabilizationEffort({
        stabilizingFaction: US,
        turnsInvested: 6,
        currentTurn: TURN,
      });

      expect(result.complete).toBe(true);
      expect(result.turnsRemaining).toBe(0);
      expect(result.reason).toContain('complete');
    });

    it('should be complete and clamped when turnsInvested exceeds required (7)', () => {
      const result = engine.computeStabilizationEffort({
        stabilizingFaction: US,
        turnsInvested: 7,
        currentTurn: TURN,
      });

      expect(result.complete).toBe(true);
      expect(result.turnsRemaining).toBe(0);
      expect(result.reason).toContain('complete');
    });

    it('should be incomplete with 1 turn remaining when turnsInvested=5', () => {
      const result = engine.computeStabilizationEffort({
        stabilizingFaction: RUSSIA,
        turnsInvested: 5,
        currentTurn: TURN,
      });

      expect(result.complete).toBe(false);
      expect(result.turnsRemaining).toBe(1);
      expect(result.reason).toContain('remaining');
    });

    it('should be incomplete with 6 turns remaining when turnsInvested=0', () => {
      const result = engine.computeStabilizationEffort({
        stabilizingFaction: IRAN,
        turnsInvested: 0,
        currentTurn: TURN,
      });

      expect(result.complete).toBe(false);
      expect(result.turnsRemaining).toBe(6);
      expect(result.reason).toContain('remaining');
    });

    it('should be incomplete with 3 turns remaining when turnsInvested=3', () => {
      const result = engine.computeStabilizationEffort({
        stabilizingFaction: US,
        turnsInvested: 3,
        currentTurn: TURN,
      });

      expect(result.complete).toBe(false);
      expect(result.turnsRemaining).toBe(3);
      expect(result.reason).toContain('remaining');
    });
  });

  // ─────────────────────────────────────────────────────────
  // computeProxySpawnCheck
  // ─────────────────────────────────────────────────────────

  describe('computeProxySpawnCheck', () => {
    it('should spawn a proxy when turnsSinceFailed=3 (3 % 3 === 0 and > 0)', () => {
      const result = engine.computeProxySpawnCheck({
        targetFaction: SYRIA,
        turnsSinceFailed: 3,
        currentTurn: TURN,
      });

      expect(result.spawnsProxy).toBe(true);
      expect(result.reason).toContain('spawns');
    });

    it('should spawn a proxy when turnsSinceFailed=6', () => {
      const result = engine.computeProxySpawnCheck({
        targetFaction: SYRIA,
        turnsSinceFailed: 6,
        currentTurn: TURN,
      });

      expect(result.spawnsProxy).toBe(true);
      expect(result.reason).toContain('spawns');
    });

    it('should NOT spawn a proxy when turnsSinceFailed=0 (0 > 0 is false)', () => {
      const result = engine.computeProxySpawnCheck({
        targetFaction: SYRIA,
        turnsSinceFailed: 0,
        currentTurn: TURN,
      });

      expect(result.spawnsProxy).toBe(false);
      expect(result.reason).toContain('no proxy spawn');
    });

    it('should NOT spawn a proxy when turnsSinceFailed=1 (1 % 3 !== 0)', () => {
      const result = engine.computeProxySpawnCheck({
        targetFaction: SYRIA,
        turnsSinceFailed: 1,
        currentTurn: TURN,
      });

      expect(result.spawnsProxy).toBe(false);
      expect(result.reason).toContain('no proxy spawn');
    });

    it('should NOT spawn a proxy when turnsSinceFailed=2', () => {
      const result = engine.computeProxySpawnCheck({
        targetFaction: SYRIA,
        turnsSinceFailed: 2,
        currentTurn: TURN,
      });

      expect(result.spawnsProxy).toBe(false);
      expect(result.reason).toContain('no proxy spawn');
    });

    it('should NOT spawn a proxy when turnsSinceFailed=4', () => {
      const result = engine.computeProxySpawnCheck({
        targetFaction: SYRIA,
        turnsSinceFailed: 4,
        currentTurn: TURN,
      });

      expect(result.spawnsProxy).toBe(false);
      expect(result.reason).toContain('no proxy spawn');
    });

    it('should spawn a proxy when turnsSinceFailed=9 (9 % 3 === 0 and > 0)', () => {
      const result = engine.computeProxySpawnCheck({
        targetFaction: SYRIA,
        turnsSinceFailed: 9,
        currentTurn: TURN,
      });

      expect(result.spawnsProxy).toBe(true);
      expect(result.reason).toContain('spawns');
    });
  });
});
