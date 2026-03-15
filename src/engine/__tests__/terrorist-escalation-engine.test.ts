/**
 * Tests for TerroristEscalationEngine
 *
 * Covers terrorist proxy discovery consequences, War-on-Terror legitimacy
 * gains, four-rung proxy escalation ladder mechanics, escalation step
 * computation, and terrorist proxy public-acknowledgement constraints.
 *
 * @see FR-2007 — Terrorist proxy discovery, coalition response, and War on Terror
 * @see FR-2008 — Proxy escalation ladder (Shadow War → Direct Confrontation)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { TerroristEscalationEngine } from '@/engine/terrorist-escalation-engine';
import { GAME_CONFIG } from '@/engine/config';
import { ProxyEscalationLevel } from '@/data/types';
import type { FactionId, TurnNumber } from '@/data/types';

const US = 'us' as FactionId;
const CHINA = 'china' as FactionId;
const IRAN = 'iran' as FactionId;
const RUSSIA = 'russia' as FactionId;
const TURN = 5 as TurnNumber;

describe('TerroristEscalationEngine', () => {
  let engine: TerroristEscalationEngine;

  beforeEach(() => {
    engine = new TerroristEscalationEngine(GAME_CONFIG.proxy);
  });

  // ─────────────────────────────────────────────────────────
  // evaluateTerroristDiscovery
  // ─────────────────────────────────────────────────────────

  describe('evaluateTerroristDiscovery', () => {
    it('should return legitimacyPenalty of -20', () => {
      const result = engine.evaluateTerroristDiscovery({
        sponsorFaction: IRAN,
        discoveredByFaction: US,
        currentTurn: TURN,
      });
      expect(result.legitimacyPenalty).toBe(-20);
    });

    it('should return tensionIncreaseAllNations of 20', () => {
      const result = engine.evaluateTerroristDiscovery({
        sponsorFaction: IRAN,
        discoveredByFaction: US,
        currentTurn: TURN,
      });
      expect(result.tensionIncreaseAllNations).toBe(20);
    });

    it('should always trigger coalition response', () => {
      const result = engine.evaluateTerroristDiscovery({
        sponsorFaction: IRAN,
        discoveredByFaction: US,
        currentTurn: TURN,
      });
      expect(result.coalitionResponseTriggered).toBe(true);
    });

    it('should include sponsor faction in reason', () => {
      const result = engine.evaluateTerroristDiscovery({
        sponsorFaction: IRAN,
        discoveredByFaction: US,
        currentTurn: TURN,
      });
      expect(result.reason).toContain('iran');
    });

    it('should include discoverer faction in reason', () => {
      const result = engine.evaluateTerroristDiscovery({
        sponsorFaction: IRAN,
        discoveredByFaction: US,
        currentTurn: TURN,
      });
      expect(result.reason).toContain('us');
    });

    it('should work with different faction pairs (Russia discovered by China)', () => {
      const result = engine.evaluateTerroristDiscovery({
        sponsorFaction: RUSSIA,
        discoveredByFaction: CHINA,
        currentTurn: TURN,
      });
      expect(result.legitimacyPenalty).toBe(-20);
      expect(result.tensionIncreaseAllNations).toBe(20);
      expect(result.coalitionResponseTriggered).toBe(true);
      expect(result.reason).toContain('russia');
      expect(result.reason).toContain('china');
    });
  });

  // ─────────────────────────────────────────────────────────
  // evaluateWarOnTerror
  // ─────────────────────────────────────────────────────────

  describe('evaluateWarOnTerror', () => {
    it('should return legitimacyBonus of 15', () => {
      const result = engine.evaluateWarOnTerror({
        prosecutingFaction: US,
        targetFaction: IRAN,
        currentTurn: TURN,
      });
      expect(result.legitimacyBonus).toBe(15);
    });

    it('should grant military access', () => {
      const result = engine.evaluateWarOnTerror({
        prosecutingFaction: US,
        targetFaction: IRAN,
        currentTurn: TURN,
      });
      expect(result.militaryAccessGranted).toBe(true);
    });

    it('should mention sovereign territory in reason', () => {
      const result = engine.evaluateWarOnTerror({
        prosecutingFaction: US,
        targetFaction: IRAN,
        currentTurn: TURN,
      });
      expect(result.reason).toContain('sovereign territory');
    });

    it('should work with different faction pairs (China prosecutes against Russia)', () => {
      const result = engine.evaluateWarOnTerror({
        prosecutingFaction: CHINA,
        targetFaction: RUSSIA,
        currentTurn: TURN,
      });
      expect(result.legitimacyBonus).toBe(15);
      expect(result.militaryAccessGranted).toBe(true);
      expect(result.reason).toContain('china');
      expect(result.reason).toContain('russia');
    });
  });

  // ─────────────────────────────────────────────────────────
  // evaluateEscalationLevel
  // ─────────────────────────────────────────────────────────

  describe('evaluateEscalationLevel', () => {
    it('ShadowWar (1): tensionIncrease=15, capabilityBonus=0, deniabilityOverride=null, militaryDeployed=false, directConfrontation=false', () => {
      const result = engine.evaluateEscalationLevel({
        sponsorFaction: IRAN,
        targetFaction: US,
        currentLevel: ProxyEscalationLevel.ShadowWar,
        currentTurn: TURN,
      });
      expect(result.tensionIncrease).toBe(15);
      expect(result.capabilityBonus).toBe(0);
      expect(result.deniabilityOverride).toBe(null);
      expect(result.militaryDeployed).toBe(false);
      expect(result.directConfrontation).toBe(false);
    });

    it('ShadowWar (1): cumulativeTension=15', () => {
      const result = engine.evaluateEscalationLevel({
        sponsorFaction: IRAN,
        targetFaction: US,
        currentLevel: ProxyEscalationLevel.ShadowWar,
        currentTurn: TURN,
      });
      expect(result.cumulativeTension).toBe(15);
    });

    it('AcknowledgedSupport (2): tensionIncrease=15, capabilityBonus=15, deniabilityOverride=0, militaryDeployed=false, directConfrontation=false', () => {
      const result = engine.evaluateEscalationLevel({
        sponsorFaction: RUSSIA,
        targetFaction: US,
        currentLevel: ProxyEscalationLevel.AcknowledgedSupport,
        currentTurn: TURN,
      });
      expect(result.tensionIncrease).toBe(15);
      expect(result.capabilityBonus).toBe(15);
      expect(result.deniabilityOverride).toBe(0);
      expect(result.militaryDeployed).toBe(false);
      expect(result.directConfrontation).toBe(false);
    });

    it('AcknowledgedSupport (2): cumulativeTension=30', () => {
      const result = engine.evaluateEscalationLevel({
        sponsorFaction: RUSSIA,
        targetFaction: US,
        currentLevel: ProxyEscalationLevel.AcknowledgedSupport,
        currentTurn: TURN,
      });
      expect(result.cumulativeTension).toBe(30);
    });

    it('LimitedIntervention (3): tensionIncrease=15, capabilityBonus=0, deniabilityOverride=0, militaryDeployed=true, directConfrontation=false', () => {
      const result = engine.evaluateEscalationLevel({
        sponsorFaction: US,
        targetFaction: IRAN,
        currentLevel: ProxyEscalationLevel.LimitedIntervention,
        currentTurn: TURN,
      });
      expect(result.tensionIncrease).toBe(15);
      expect(result.capabilityBonus).toBe(0);
      expect(result.deniabilityOverride).toBe(0);
      expect(result.militaryDeployed).toBe(true);
      expect(result.directConfrontation).toBe(false);
    });

    it('LimitedIntervention (3): cumulativeTension=45', () => {
      const result = engine.evaluateEscalationLevel({
        sponsorFaction: US,
        targetFaction: IRAN,
        currentLevel: ProxyEscalationLevel.LimitedIntervention,
        currentTurn: TURN,
      });
      expect(result.cumulativeTension).toBe(45);
    });

    it('DirectConfrontation (4): tensionIncrease=15, capabilityBonus=0, deniabilityOverride=0, militaryDeployed=true, directConfrontation=true', () => {
      const result = engine.evaluateEscalationLevel({
        sponsorFaction: CHINA,
        targetFaction: US,
        currentLevel: ProxyEscalationLevel.DirectConfrontation,
        currentTurn: TURN,
      });
      expect(result.tensionIncrease).toBe(15);
      expect(result.capabilityBonus).toBe(0);
      expect(result.deniabilityOverride).toBe(0);
      expect(result.militaryDeployed).toBe(true);
      expect(result.directConfrontation).toBe(true);
    });

    it('DirectConfrontation (4): cumulativeTension=60', () => {
      const result = engine.evaluateEscalationLevel({
        sponsorFaction: CHINA,
        targetFaction: US,
        currentLevel: ProxyEscalationLevel.DirectConfrontation,
        currentTurn: TURN,
      });
      expect(result.cumulativeTension).toBe(60);
    });
  });

  // ─────────────────────────────────────────────────────────
  // computeEscalationStep
  // ─────────────────────────────────────────────────────────

  describe('computeEscalationStep', () => {
    it('escalate=true from level 1 → newLevel=2, changed=true', () => {
      const result = engine.computeEscalationStep({
        currentLevel: ProxyEscalationLevel.ShadowWar,
        escalate: true,
        currentTurn: TURN,
      });
      expect(result.newLevel).toBe(ProxyEscalationLevel.AcknowledgedSupport);
      expect(result.changed).toBe(true);
    });

    it('escalate=true from level 2 → newLevel=3, changed=true', () => {
      const result = engine.computeEscalationStep({
        currentLevel: ProxyEscalationLevel.AcknowledgedSupport,
        escalate: true,
        currentTurn: TURN,
      });
      expect(result.newLevel).toBe(ProxyEscalationLevel.LimitedIntervention);
      expect(result.changed).toBe(true);
    });

    it('escalate=true from level 3 → newLevel=4, changed=true', () => {
      const result = engine.computeEscalationStep({
        currentLevel: ProxyEscalationLevel.LimitedIntervention,
        escalate: true,
        currentTurn: TURN,
      });
      expect(result.newLevel).toBe(ProxyEscalationLevel.DirectConfrontation);
      expect(result.changed).toBe(true);
    });

    it('escalate=true from level 4 → newLevel=4, changed=false (already max)', () => {
      const result = engine.computeEscalationStep({
        currentLevel: ProxyEscalationLevel.DirectConfrontation,
        escalate: true,
        currentTurn: TURN,
      });
      expect(result.newLevel).toBe(ProxyEscalationLevel.DirectConfrontation);
      expect(result.changed).toBe(false);
    });

    it('escalate=false from level 1 → newLevel=1, changed=false', () => {
      const result = engine.computeEscalationStep({
        currentLevel: ProxyEscalationLevel.ShadowWar,
        escalate: false,
        currentTurn: TURN,
      });
      expect(result.newLevel).toBe(ProxyEscalationLevel.ShadowWar);
      expect(result.changed).toBe(false);
    });

    it('escalate=false from level 3 → newLevel=3, changed=false', () => {
      const result = engine.computeEscalationStep({
        currentLevel: ProxyEscalationLevel.LimitedIntervention,
        escalate: false,
        currentTurn: TURN,
      });
      expect(result.newLevel).toBe(ProxyEscalationLevel.LimitedIntervention);
      expect(result.changed).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────
  // evaluateTerroristProxyConstraints
  // ─────────────────────────────────────────────────────────

  describe('evaluateTerroristProxyConstraints', () => {
    it('isPubliclyAcknowledged=false → valid=true', () => {
      const result = engine.evaluateTerroristProxyConstraints({
        sponsorFaction: IRAN,
        isPubliclyAcknowledged: false,
        currentTurn: TURN,
      });
      expect(result.valid).toBe(true);
    });

    it('isPubliclyAcknowledged=true → valid=false', () => {
      const result = engine.evaluateTerroristProxyConstraints({
        sponsorFaction: IRAN,
        isPubliclyAcknowledged: true,
        currentTurn: TURN,
      });
      expect(result.valid).toBe(false);
    });

    it('reason mentions "covert" when valid', () => {
      const result = engine.evaluateTerroristProxyConstraints({
        sponsorFaction: RUSSIA,
        isPubliclyAcknowledged: false,
        currentTurn: TURN,
      });
      expect(result.reason).toContain('covert');
    });

    it('reason mentions "cannot be publicly acknowledged" when invalid', () => {
      const result = engine.evaluateTerroristProxyConstraints({
        sponsorFaction: RUSSIA,
        isPubliclyAcknowledged: true,
        currentTurn: TURN,
      });
      expect(result.reason).toContain('cannot be publicly acknowledged');
    });
  });
});
