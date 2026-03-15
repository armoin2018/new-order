import { describe, it, expect, beforeEach } from 'vitest';
import { SpaceAIEngine } from '@/engine/space-ai-engine';
import type {
  SpaceActionInput,
  AISupremacyInput,
  AIArmsRaceInput,
  DebrisImpactInput,
} from '@/engine/space-ai-engine';
import { GAME_CONFIG } from '@/engine/config';
import { SpaceAction } from '@/data/types';
import type { FactionId, TurnNumber } from '@/data/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const US = 'us' as FactionId;
const CHINA = 'china' as FactionId;
const RUSSIA = 'russia' as FactionId;
const TURN = 5 as TurnNumber;

// Hardcoded engine constants (FR-1804)
const SATELLITE_SIGINT_BONUS = 15;
const ASAT_SPACE_REQUIREMENT = 60;
const ASAT_DISABLED_TURNS = 5;
const ASAT_DEBRIS_PENALTY = -5;
const ASAT_LEGITIMACY_COST = -10;
const GPS_DISRUPTION_SPACE_REQUIREMENT = 40;
const GPS_DISRUPTION_READINESS_PENALTY = -10;
const GPS_DISRUPTION_PENALTY_DURATION = 3;

// Config values (FR-1805)
const aiThresholds = GAME_CONFIG.technology.aiThresholds;

// ---------------------------------------------------------------------------
// Engine under test
// ---------------------------------------------------------------------------

let engine: SpaceAIEngine;
beforeEach(() => {
  engine = new SpaceAIEngine(GAME_CONFIG.technology);
});

// ===========================================================================
// SpaceAIEngine
// ===========================================================================

describe('SpaceAIEngine', () => {
  // =========================================================================
  // evaluateSpaceAction
  // =========================================================================

  describe('evaluateSpaceAction', () => {
    // -----------------------------------------------------------------------
    // DeploySatellite
    // -----------------------------------------------------------------------

    describe('DeploySatellite', () => {
      it('is eligible at Space level 0', () => {
        const input: SpaceActionInput = {
          factionId: US,
          action: SpaceAction.DeploySatellite,
          factionSpaceLevel: 0,
          targetFaction: null,
          currentTurn: TURN,
        };

        const result = engine.evaluateSpaceAction(input);

        expect(result.action).toBe(SpaceAction.DeploySatellite);
        expect(result.eligible).toBe(true);
        expect(result.factionEffects.sigintBonus).toBe(SATELLITE_SIGINT_BONUS);
        expect(result.factionEffects.legitimacyCost).toBe(0);
        expect(result.targetEffects.satelliteDisabledTurns).toBe(0);
        expect(result.targetEffects.militaryReadinessPenalty).toBe(0);
        expect(result.targetEffects.readinessPenaltyDuration).toBe(0);
        expect(result.globalEffects.debrisSpacePenalty).toBe(0);
        expect(result.globalEffects.permanent).toBe(false);
        expect(result.deniable).toBe(false);
        expect(result.reason).toBeTruthy();
      });

      it('is eligible at Space level 100', () => {
        const input: SpaceActionInput = {
          factionId: CHINA,
          action: SpaceAction.DeploySatellite,
          factionSpaceLevel: 100,
          targetFaction: null,
          currentTurn: TURN,
        };

        const result = engine.evaluateSpaceAction(input);

        expect(result.eligible).toBe(true);
        expect(result.factionEffects.sigintBonus).toBe(SATELLITE_SIGINT_BONUS);
        expect(result.factionEffects.legitimacyCost).toBe(0);
        expect(result.deniable).toBe(false);
      });
    });

    // -----------------------------------------------------------------------
    // ASAT
    // -----------------------------------------------------------------------

    describe('ASAT', () => {
      it('is eligible at exact threshold (Space = 60)', () => {
        const input: SpaceActionInput = {
          factionId: US,
          action: SpaceAction.ASAT,
          factionSpaceLevel: ASAT_SPACE_REQUIREMENT,
          targetFaction: CHINA,
          currentTurn: TURN,
        };

        const result = engine.evaluateSpaceAction(input);

        expect(result.action).toBe(SpaceAction.ASAT);
        expect(result.eligible).toBe(true);
        expect(result.factionEffects.sigintBonus).toBe(0);
        expect(result.factionEffects.legitimacyCost).toBe(ASAT_LEGITIMACY_COST);
        expect(result.targetEffects.satelliteDisabledTurns).toBe(ASAT_DISABLED_TURNS);
        expect(result.targetEffects.militaryReadinessPenalty).toBe(0);
        expect(result.targetEffects.readinessPenaltyDuration).toBe(0);
        expect(result.globalEffects.debrisSpacePenalty).toBe(ASAT_DEBRIS_PENALTY);
        expect(result.globalEffects.permanent).toBe(true);
        expect(result.deniable).toBe(false);
        expect(result.reason).toBeTruthy();
      });

      it('is ineligible when Space is below threshold (Space = 59)', () => {
        const input: SpaceActionInput = {
          factionId: US,
          action: SpaceAction.ASAT,
          factionSpaceLevel: ASAT_SPACE_REQUIREMENT - 1,
          targetFaction: CHINA,
          currentTurn: TURN,
        };

        const result = engine.evaluateSpaceAction(input);

        expect(result.action).toBe(SpaceAction.ASAT);
        expect(result.eligible).toBe(false);
        expect(result.factionEffects.sigintBonus).toBe(0);
        expect(result.factionEffects.legitimacyCost).toBe(0);
        expect(result.targetEffects.satelliteDisabledTurns).toBe(0);
        expect(result.targetEffects.militaryReadinessPenalty).toBe(0);
        expect(result.targetEffects.readinessPenaltyDuration).toBe(0);
        expect(result.globalEffects.debrisSpacePenalty).toBe(0);
        expect(result.globalEffects.permanent).toBe(false);
        expect(result.deniable).toBe(false);
        expect(result.reason).toBeTruthy();
      });

      it('is eligible well above threshold (Space = 100)', () => {
        const input: SpaceActionInput = {
          factionId: RUSSIA,
          action: SpaceAction.ASAT,
          factionSpaceLevel: 100,
          targetFaction: US,
          currentTurn: TURN,
        };

        const result = engine.evaluateSpaceAction(input);

        expect(result.eligible).toBe(true);
        expect(result.factionEffects.legitimacyCost).toBe(ASAT_LEGITIMACY_COST);
        expect(result.targetEffects.satelliteDisabledTurns).toBe(ASAT_DISABLED_TURNS);
        expect(result.globalEffects.debrisSpacePenalty).toBe(ASAT_DEBRIS_PENALTY);
        expect(result.globalEffects.permanent).toBe(true);
      });
    });

    // -----------------------------------------------------------------------
    // GPSDisruption
    // -----------------------------------------------------------------------

    describe('GPSDisruption', () => {
      it('is eligible at exact threshold (Space = 40)', () => {
        const input: SpaceActionInput = {
          factionId: CHINA,
          action: SpaceAction.GPSDisruption,
          factionSpaceLevel: GPS_DISRUPTION_SPACE_REQUIREMENT,
          targetFaction: US,
          currentTurn: TURN,
        };

        const result = engine.evaluateSpaceAction(input);

        expect(result.action).toBe(SpaceAction.GPSDisruption);
        expect(result.eligible).toBe(true);
        expect(result.factionEffects.sigintBonus).toBe(0);
        expect(result.factionEffects.legitimacyCost).toBe(0);
        expect(result.targetEffects.satelliteDisabledTurns).toBe(0);
        expect(result.targetEffects.militaryReadinessPenalty).toBe(GPS_DISRUPTION_READINESS_PENALTY);
        expect(result.targetEffects.readinessPenaltyDuration).toBe(GPS_DISRUPTION_PENALTY_DURATION);
        expect(result.globalEffects.debrisSpacePenalty).toBe(0);
        expect(result.globalEffects.permanent).toBe(false);
        expect(result.deniable).toBe(true);
        expect(result.reason).toBeTruthy();
      });

      it('is ineligible when Space is below threshold (Space = 39)', () => {
        const input: SpaceActionInput = {
          factionId: CHINA,
          action: SpaceAction.GPSDisruption,
          factionSpaceLevel: GPS_DISRUPTION_SPACE_REQUIREMENT - 1,
          targetFaction: US,
          currentTurn: TURN,
        };

        const result = engine.evaluateSpaceAction(input);

        expect(result.action).toBe(SpaceAction.GPSDisruption);
        expect(result.eligible).toBe(false);
        expect(result.factionEffects.sigintBonus).toBe(0);
        expect(result.factionEffects.legitimacyCost).toBe(0);
        expect(result.targetEffects.satelliteDisabledTurns).toBe(0);
        expect(result.targetEffects.militaryReadinessPenalty).toBe(0);
        expect(result.targetEffects.readinessPenaltyDuration).toBe(0);
        expect(result.globalEffects.debrisSpacePenalty).toBe(0);
        expect(result.globalEffects.permanent).toBe(false);
        expect(result.deniable).toBe(false);
        expect(result.reason).toBeTruthy();
      });

      it('is eligible well above threshold (Space = 100)', () => {
        const input: SpaceActionInput = {
          factionId: RUSSIA,
          action: SpaceAction.GPSDisruption,
          factionSpaceLevel: 100,
          targetFaction: CHINA,
          currentTurn: TURN,
        };

        const result = engine.evaluateSpaceAction(input);

        expect(result.eligible).toBe(true);
        expect(result.targetEffects.militaryReadinessPenalty).toBe(GPS_DISRUPTION_READINESS_PENALTY);
        expect(result.targetEffects.readinessPenaltyDuration).toBe(GPS_DISRUPTION_PENALTY_DURATION);
        expect(result.deniable).toBe(true);
      });
    });
  });

  // =========================================================================
  // evaluateAISupremacy
  // =========================================================================

  describe('evaluateAISupremacy', () => {
    it('returns no tiers active when AI level is 0', () => {
      const input: AISupremacyInput = {
        factionId: US,
        factionAILevel: 0,
        currentTurn: TURN,
      };

      const result = engine.evaluateAISupremacy(input);

      expect(result.factionId).toBe(US);
      expect(result.autonomousDrones).toBe(false);
      expect(result.autonomousDronesMilitaryBonus).toBe(0);
      expect(result.predictiveIntel).toBe(false);
      expect(result.predictiveIntelReliabilityBonus).toBe(0);
      expect(result.strategicAIAdvisor).toBe(false);
      expect(result.strategicAIConfidenceImprovement).toBe(0);
      expect(result.activeThresholds).toBe(0);
      expect(result.reason).toBeTruthy();
    });

    it('returns no tiers active at AI level 49 (just below drones)', () => {
      const input: AISupremacyInput = {
        factionId: CHINA,
        factionAILevel: 49,
        currentTurn: TURN,
      };

      const result = engine.evaluateAISupremacy(input);

      expect(result.autonomousDrones).toBe(false);
      expect(result.autonomousDronesMilitaryBonus).toBe(0);
      expect(result.predictiveIntel).toBe(false);
      expect(result.strategicAIAdvisor).toBe(false);
      expect(result.activeThresholds).toBe(0);
    });

    it('unlocks autonomous drones at AI level 50', () => {
      const input: AISupremacyInput = {
        factionId: US,
        factionAILevel: 50,
        currentTurn: TURN,
      };

      const result = engine.evaluateAISupremacy(input);

      expect(result.autonomousDrones).toBe(true);
      expect(result.autonomousDronesMilitaryBonus).toBeCloseTo(aiThresholds.autonomousDronesMilitaryBonus);
      expect(result.predictiveIntel).toBe(false);
      expect(result.predictiveIntelReliabilityBonus).toBe(0);
      expect(result.strategicAIAdvisor).toBe(false);
      expect(result.strategicAIConfidenceImprovement).toBe(0);
      expect(result.activeThresholds).toBe(1);
    });

    it('still only has drones at AI level 69', () => {
      const input: AISupremacyInput = {
        factionId: CHINA,
        factionAILevel: 69,
        currentTurn: TURN,
      };

      const result = engine.evaluateAISupremacy(input);

      expect(result.autonomousDrones).toBe(true);
      expect(result.autonomousDronesMilitaryBonus).toBeCloseTo(aiThresholds.autonomousDronesMilitaryBonus);
      expect(result.predictiveIntel).toBe(false);
      expect(result.strategicAIAdvisor).toBe(false);
      expect(result.activeThresholds).toBe(1);
    });

    it('unlocks drones and predictive intel at AI level 70', () => {
      const input: AISupremacyInput = {
        factionId: US,
        factionAILevel: 70,
        currentTurn: TURN,
      };

      const result = engine.evaluateAISupremacy(input);

      expect(result.autonomousDrones).toBe(true);
      expect(result.autonomousDronesMilitaryBonus).toBeCloseTo(aiThresholds.autonomousDronesMilitaryBonus);
      expect(result.predictiveIntel).toBe(true);
      expect(result.predictiveIntelReliabilityBonus).toBeCloseTo(aiThresholds.predictiveIntelReliabilityBonus);
      expect(result.strategicAIAdvisor).toBe(false);
      expect(result.strategicAIConfidenceImprovement).toBe(0);
      expect(result.activeThresholds).toBe(2);
    });

    it('still only has drones and predictive intel at AI level 89', () => {
      const input: AISupremacyInput = {
        factionId: RUSSIA,
        factionAILevel: 89,
        currentTurn: TURN,
      };

      const result = engine.evaluateAISupremacy(input);

      expect(result.autonomousDrones).toBe(true);
      expect(result.predictiveIntel).toBe(true);
      expect(result.strategicAIAdvisor).toBe(false);
      expect(result.activeThresholds).toBe(2);
    });

    it('unlocks all three tiers at AI level 90', () => {
      const input: AISupremacyInput = {
        factionId: US,
        factionAILevel: 90,
        currentTurn: TURN,
      };

      const result = engine.evaluateAISupremacy(input);

      expect(result.autonomousDrones).toBe(true);
      expect(result.autonomousDronesMilitaryBonus).toBeCloseTo(aiThresholds.autonomousDronesMilitaryBonus);
      expect(result.predictiveIntel).toBe(true);
      expect(result.predictiveIntelReliabilityBonus).toBeCloseTo(aiThresholds.predictiveIntelReliabilityBonus);
      expect(result.strategicAIAdvisor).toBe(true);
      expect(result.strategicAIConfidenceImprovement).toBeCloseTo(aiThresholds.strategicAIConfidenceImprovement);
      expect(result.activeThresholds).toBe(3);
    });

    it('has all three tiers at AI level 100', () => {
      const input: AISupremacyInput = {
        factionId: CHINA,
        factionAILevel: 100,
        currentTurn: TURN,
      };

      const result = engine.evaluateAISupremacy(input);

      expect(result.autonomousDrones).toBe(true);
      expect(result.predictiveIntel).toBe(true);
      expect(result.strategicAIAdvisor).toBe(true);
      expect(result.activeThresholds).toBe(3);
    });
  });

  // =========================================================================
  // evaluateAIArmsRace
  // =========================================================================

  describe('evaluateAIArmsRace', () => {
    it('arms race is active when both factions are at or above threshold', () => {
      const input: AIArmsRaceInput = {
        factionA: US,
        factionB: CHINA,
        factionAAILevel: 80,
        factionBAILevel: 80,
        currentTurn: TURN,
      };

      const result = engine.evaluateAIArmsRace(input);

      expect(result.armsRaceActive).toBe(true);
      expect(result.escalationMultiplier).toBe(aiThresholds.aiArmsRaceEscalationMultiplier);
      expect(result.affectedFactions).toEqual([US, CHINA]);
      expect(result.reason).toBeTruthy();
    });

    it('arms race is inactive when factionA is at 80 and factionB is at 79', () => {
      const input: AIArmsRaceInput = {
        factionA: US,
        factionB: CHINA,
        factionAAILevel: 80,
        factionBAILevel: 79,
        currentTurn: TURN,
      };

      const result = engine.evaluateAIArmsRace(input);

      expect(result.armsRaceActive).toBe(false);
      expect(result.escalationMultiplier).toBe(1);
      expect(result.affectedFactions).toEqual([]);
      expect(result.reason).toBeTruthy();
    });

    it('arms race is inactive when factionA is at 79 and factionB is at 80', () => {
      const input: AIArmsRaceInput = {
        factionA: CHINA,
        factionB: US,
        factionAAILevel: 79,
        factionBAILevel: 80,
        currentTurn: TURN,
      };

      const result = engine.evaluateAIArmsRace(input);

      expect(result.armsRaceActive).toBe(false);
      expect(result.escalationMultiplier).toBe(1);
      expect(result.affectedFactions).toEqual([]);
    });

    it('arms race is inactive when both factions are below threshold', () => {
      const input: AIArmsRaceInput = {
        factionA: US,
        factionB: RUSSIA,
        factionAAILevel: 79,
        factionBAILevel: 79,
        currentTurn: TURN,
      };

      const result = engine.evaluateAIArmsRace(input);

      expect(result.armsRaceActive).toBe(false);
      expect(result.escalationMultiplier).toBe(1);
      expect(result.affectedFactions).toEqual([]);
    });

    it('arms race is active when both factions are at 100', () => {
      const input: AIArmsRaceInput = {
        factionA: US,
        factionB: CHINA,
        factionAAILevel: 100,
        factionBAILevel: 100,
        currentTurn: TURN,
      };

      const result = engine.evaluateAIArmsRace(input);

      expect(result.armsRaceActive).toBe(true);
      expect(result.escalationMultiplier).toBe(aiThresholds.aiArmsRaceEscalationMultiplier);
      expect(result.affectedFactions).toEqual([US, CHINA]);
    });

    it('arms race is active at exact threshold boundary (both = 80)', () => {
      const input: AIArmsRaceInput = {
        factionA: RUSSIA,
        factionB: CHINA,
        factionAAILevel: 80,
        factionBAILevel: 80,
        currentTurn: TURN,
      };

      const result = engine.evaluateAIArmsRace(input);

      expect(result.armsRaceActive).toBe(true);
      expect(result.escalationMultiplier).toBe(aiThresholds.aiArmsRaceEscalationMultiplier);
      expect(result.affectedFactions).toEqual([RUSSIA, CHINA]);
    });
  });

  // =========================================================================
  // computeDebrisImpact
  // =========================================================================

  describe('computeDebrisImpact', () => {
    it('returns zero penalty when no ASAT events have occurred', () => {
      const input: DebrisImpactInput = {
        totalASATEvents: 0,
        currentTurn: TURN,
      };

      const result = engine.computeDebrisImpact(input);

      expect(result.totalDebrisPenalty).toBe(0);
      expect(result.reason).toContain('clear');
    });

    it('returns -5 penalty for 1 ASAT event', () => {
      const input: DebrisImpactInput = {
        totalASATEvents: 1,
        currentTurn: TURN,
      };

      const result = engine.computeDebrisImpact(input);

      expect(result.totalDebrisPenalty).toBe(1 * ASAT_DEBRIS_PENALTY);
      expect(result.reason).toBeTruthy();
    });

    it('returns -15 penalty for 3 ASAT events', () => {
      const input: DebrisImpactInput = {
        totalASATEvents: 3,
        currentTurn: TURN,
      };

      const result = engine.computeDebrisImpact(input);

      expect(result.totalDebrisPenalty).toBe(3 * ASAT_DEBRIS_PENALTY);
      expect(result.reason).toBeTruthy();
    });

    it('returns -50 penalty for 10 ASAT events', () => {
      const input: DebrisImpactInput = {
        totalASATEvents: 10,
        currentTurn: TURN,
      };

      const result = engine.computeDebrisImpact(input);

      expect(result.totalDebrisPenalty).toBe(10 * ASAT_DEBRIS_PENALTY);
      expect(result.reason).toBeTruthy();
    });
  });
});
