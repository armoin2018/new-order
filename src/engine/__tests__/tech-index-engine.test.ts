import { describe, it, expect, beforeEach } from 'vitest';
import { TechIndexEngine } from '@/engine/tech-index-engine';
import { GAME_CONFIG } from '@/engine/config';
import { TechDomain, TechBlocAlignment } from '@/data/types';
import type { FactionId, TurnNumber } from '@/data/types';
import type { TechnologyIndex } from '@/data/types';

const US = 'us' as FactionId;
const CHINA = 'china' as FactionId;
const TURN = 5 as TurnNumber;

function makeTechIndex(overrides: Partial<TechnologyIndex> = {}): TechnologyIndex {
  return {
    factionId: US,
    ai: 0,
    semiconductors: 0,
    space: 0,
    cyber: 0,
    biotech: 0,
    quantum: 0,
    techBlocAlignment: TechBlocAlignment.NonAligned,
    activeResearch: [],
    exportControls: {},
    ...overrides,
  };
}

describe('TechIndexEngine', () => {
  let engine: TechIndexEngine;

  beforeEach(() => {
    engine = new TechIndexEngine(GAME_CONFIG.technology);
  });

  // -------------------------------------------------------------------------
  // getDomainLevel (FR-1801)
  // -------------------------------------------------------------------------
  describe('getDomainLevel', () => {
    it('returns ai level for TechDomain.AI', () => {
      const idx = makeTechIndex({ ai: 42 });
      expect(engine.getDomainLevel({ techIndex: idx, domain: TechDomain.AI })).toBe(42);
    });

    it('returns semiconductors level for TechDomain.Semiconductors', () => {
      const idx = makeTechIndex({ semiconductors: 55 });
      expect(engine.getDomainLevel({ techIndex: idx, domain: TechDomain.Semiconductors })).toBe(55);
    });

    it('returns space level for TechDomain.Space', () => {
      const idx = makeTechIndex({ space: 30 });
      expect(engine.getDomainLevel({ techIndex: idx, domain: TechDomain.Space })).toBe(30);
    });

    it('returns cyber level for TechDomain.Cyber', () => {
      const idx = makeTechIndex({ cyber: 88 });
      expect(engine.getDomainLevel({ techIndex: idx, domain: TechDomain.Cyber })).toBe(88);
    });

    it('returns biotech level for TechDomain.Biotech', () => {
      const idx = makeTechIndex({ biotech: 15 });
      expect(engine.getDomainLevel({ techIndex: idx, domain: TechDomain.Biotech })).toBe(15);
    });

    it('returns quantum level for TechDomain.Quantum', () => {
      const idx = makeTechIndex({ quantum: 99 });
      expect(engine.getDomainLevel({ techIndex: idx, domain: TechDomain.Quantum })).toBe(99);
    });
  });

  // -------------------------------------------------------------------------
  // computeCompoundingBonuses (FR-1801)
  // -------------------------------------------------------------------------
  describe('computeCompoundingBonuses', () => {
    it('returns all zeros / false when every domain is 0', () => {
      const result = engine.computeCompoundingBonuses({
        techIndex: makeTechIndex(),
        currentTurn: TURN,
      });

      expect(result.factionId).toBe(US);
      expect(result.aiIntelligenceBonus).toBe(0);
      expect(result.semiconductorsGateMilitary).toBe(false);
      expect(result.spaceEnablesSatelliteIntel).toBe(false);
      expect(result.cyberEnablesInfoWar).toBe(false);
      expect(result.biotechPandemicResilience).toBe(0);
      expect(result.quantumThreatActive).toBe(false);
    });

    it('computes aiIntelligenceBonus = floor(ai/10) * 0.01 for AI=70', () => {
      const result = engine.computeCompoundingBonuses({
        techIndex: makeTechIndex({ ai: 70 }),
        currentTurn: TURN,
      });

      // floor(70/10) * 0.01 = 7 * 0.01 = 0.07
      expect(result.aiIntelligenceBonus).toBeCloseTo(0.07, 5);
    });

    it('computes aiIntelligenceBonus correctly for AI=25 (floor truncation)', () => {
      const result = engine.computeCompoundingBonuses({
        techIndex: makeTechIndex({ ai: 25 }),
        currentTurn: TURN,
      });

      // floor(25/10) * 0.01 = 2 * 0.01 = 0.02
      expect(result.aiIntelligenceBonus).toBeCloseTo(0.02, 5);
    });

    it('enables semiconductorsGateMilitary when semiconductors > 0', () => {
      const result = engine.computeCompoundingBonuses({
        techIndex: makeTechIndex({ semiconductors: 1 }),
        currentTurn: TURN,
      });

      expect(result.semiconductorsGateMilitary).toBe(true);
    });

    it('enables spaceEnablesSatelliteIntel when space > 0', () => {
      const result = engine.computeCompoundingBonuses({
        techIndex: makeTechIndex({ space: 10 }),
        currentTurn: TURN,
      });

      expect(result.spaceEnablesSatelliteIntel).toBe(true);
    });

    it('enables cyberEnablesInfoWar when cyber > 0', () => {
      const result = engine.computeCompoundingBonuses({
        techIndex: makeTechIndex({ cyber: 5 }),
        currentTurn: TURN,
      });

      expect(result.cyberEnablesInfoWar).toBe(true);
    });

    it('computes biotechPandemicResilience = biotech / 100', () => {
      const result = engine.computeCompoundingBonuses({
        techIndex: makeTechIndex({ biotech: 45 }),
        currentTurn: TURN,
      });

      expect(result.biotechPandemicResilience).toBeCloseTo(0.45, 5);
    });

    it('activates quantumThreatActive when quantum >= 70', () => {
      const result = engine.computeCompoundingBonuses({
        techIndex: makeTechIndex({ quantum: 70 }),
        currentTurn: TURN,
      });

      expect(result.quantumThreatActive).toBe(true);
    });

    it('does NOT activate quantumThreatActive when quantum = 69', () => {
      const result = engine.computeCompoundingBonuses({
        techIndex: makeTechIndex({ quantum: 69 }),
        currentTurn: TURN,
      });

      expect(result.quantumThreatActive).toBe(false);
    });

    it('enables everything when all domains are at 100', () => {
      const result = engine.computeCompoundingBonuses({
        techIndex: makeTechIndex({
          ai: 100,
          semiconductors: 100,
          space: 100,
          cyber: 100,
          biotech: 100,
          quantum: 100,
        }),
        currentTurn: TURN,
      });

      // floor(100/10) * 0.01 = 10 * 0.01 = 0.10
      expect(result.aiIntelligenceBonus).toBeCloseTo(0.10, 5);
      expect(result.semiconductorsGateMilitary).toBe(true);
      expect(result.spaceEnablesSatelliteIntel).toBe(true);
      expect(result.cyberEnablesInfoWar).toBe(true);
      expect(result.biotechPandemicResilience).toBeCloseTo(1.0, 5);
      expect(result.quantumThreatActive).toBe(true);
    });

    it('includes a reason string', () => {
      const result = engine.computeCompoundingBonuses({
        techIndex: makeTechIndex({ ai: 50 }),
        currentTurn: TURN,
      });

      expect(result.reason).toContain('Compounding bonuses');
    });
  });

  // -------------------------------------------------------------------------
  // computeInvestmentCost (FR-1802)
  // -------------------------------------------------------------------------
  describe('computeInvestmentCost', () => {
    it('computes pure linear cost for levels 0→10', () => {
      const result = engine.computeInvestmentCost({
        currentLevel: 0,
        targetLevel: 10,
        domain: TechDomain.AI,
        isUnderExportControls: false,
        isSemiconductorChokepoint: false,
        currentTurn: TURN,
      });

      // 10 levels × 10 cost each = 100
      expect(result.baseCost).toBe(100);
      expect(result.exponentialCost).toBe(0);
      expect(result.controlsPenalty).toBe(0);
      expect(result.totalCost).toBe(100);
      expect(result.levelsGained).toBe(10);
    });

    it('computes pure linear cost for levels 0→50', () => {
      const result = engine.computeInvestmentCost({
        currentLevel: 0,
        targetLevel: 50,
        domain: TechDomain.Semiconductors,
        isUnderExportControls: false,
        isSemiconductorChokepoint: false,
        currentTurn: TURN,
      });

      // 50 levels × 10 = 500
      expect(result.baseCost).toBe(500);
      expect(result.exponentialCost).toBe(0);
      expect(result.totalCost).toBe(500);
      expect(result.levelsGained).toBe(50);
    });

    it('computes mixed linear + exponential cost for levels 45→55', () => {
      const result = engine.computeInvestmentCost({
        currentLevel: 45,
        targetLevel: 55,
        domain: TechDomain.Space,
        isUnderExportControls: false,
        isSemiconductorChokepoint: false,
        currentTurn: TURN,
      });

      // Levels 46–50 (5 linear): 5 × 10 = 50
      expect(result.baseCost).toBe(50);

      // Levels 51–55 exponential: sum of 10 * 2^((level-50)/10)
      // level 51: 10 * 2^(1/10) ≈ 10.718
      // level 52: 10 * 2^(2/10) ≈ 11.487
      // level 53: 10 * 2^(3/10) ≈ 12.311
      // level 54: 10 * 2^(4/10) ≈ 13.195
      // level 55: 10 * 2^(5/10) ≈ 14.142
      const expectedExp =
        10 * Math.pow(2, 1 / 10) +
        10 * Math.pow(2, 2 / 10) +
        10 * Math.pow(2, 3 / 10) +
        10 * Math.pow(2, 4 / 10) +
        10 * Math.pow(2, 5 / 10);

      expect(result.exponentialCost).toBeCloseTo(expectedExp, 2);
      expect(result.levelsGained).toBe(10);
      expect(result.totalCost).toBeCloseTo(50 + expectedExp, 2);
    });

    it('applies +50% export controls penalty', () => {
      const result = engine.computeInvestmentCost({
        currentLevel: 0,
        targetLevel: 10,
        domain: TechDomain.Cyber,
        isUnderExportControls: true,
        isSemiconductorChokepoint: false,
        currentTurn: TURN,
      });

      // raw = 100, penalty = 100 * 0.5 = 50, total = 150
      expect(result.baseCost).toBe(100);
      expect(result.controlsPenalty).toBeCloseTo(50, 2);
      expect(result.totalCost).toBeCloseTo(150, 2);
    });

    it('applies +100% semiconductor chokepoint penalty on AI domain', () => {
      const result = engine.computeInvestmentCost({
        currentLevel: 0,
        targetLevel: 10,
        domain: TechDomain.AI,
        isUnderExportControls: false,
        isSemiconductorChokepoint: true,
        currentTurn: TURN,
      });

      // raw = 100, penalty = 100 * 1.0 = 100, total = 200
      expect(result.baseCost).toBe(100);
      expect(result.controlsPenalty).toBeCloseTo(100, 2);
      expect(result.totalCost).toBeCloseTo(200, 2);
    });

    it('does NOT apply semiconductor chokepoint penalty on non-AI domain', () => {
      const result = engine.computeInvestmentCost({
        currentLevel: 0,
        targetLevel: 10,
        domain: TechDomain.Cyber,
        isUnderExportControls: false,
        isSemiconductorChokepoint: true,
        currentTurn: TURN,
      });

      // No penalty because domain is Cyber, not AI
      expect(result.controlsPenalty).toBe(0);
      expect(result.totalCost).toBe(100);
    });

    it('stacks export controls (+50%) and semiconductor chokepoint (+100%) on AI', () => {
      const result = engine.computeInvestmentCost({
        currentLevel: 0,
        targetLevel: 10,
        domain: TechDomain.AI,
        isUnderExportControls: true,
        isSemiconductorChokepoint: true,
        currentTurn: TURN,
      });

      // raw = 100, export penalty = 50, chokepoint penalty = 100, total penalty = 150
      expect(result.baseCost).toBe(100);
      expect(result.controlsPenalty).toBeCloseTo(150, 2);
      expect(result.totalCost).toBeCloseTo(250, 2);
    });

    it('returns 0 cost when currentLevel equals targetLevel', () => {
      const result = engine.computeInvestmentCost({
        currentLevel: 50,
        targetLevel: 50,
        domain: TechDomain.Biotech,
        isUnderExportControls: false,
        isSemiconductorChokepoint: false,
        currentTurn: TURN,
      });

      expect(result.levelsGained).toBe(0);
      expect(result.baseCost).toBe(0);
      expect(result.exponentialCost).toBe(0);
      expect(result.totalCost).toBe(0);
    });

    it('clamps targetLevel to 100', () => {
      const result = engine.computeInvestmentCost({
        currentLevel: 98,
        targetLevel: 105,
        domain: TechDomain.Quantum,
        isUnderExportControls: false,
        isSemiconductorChokepoint: false,
        currentTurn: TURN,
      });

      // Only levels 99 and 100 are gained
      expect(result.levelsGained).toBe(2);
    });

    it('includes a reason string', () => {
      const result = engine.computeInvestmentCost({
        currentLevel: 0,
        targetLevel: 5,
        domain: TechDomain.AI,
        isUnderExportControls: false,
        isSemiconductorChokepoint: false,
        currentTurn: TURN,
      });

      expect(result.reason).toContain('Investment cost');
    });
  });

  // -------------------------------------------------------------------------
  // computeDecay (FR-1802)
  // -------------------------------------------------------------------------
  describe('computeDecay', () => {
    it('decays all 6 domains when all are idle >= 5 turns with levels > 0', () => {
      const idx = makeTechIndex({
        ai: 10,
        semiconductors: 20,
        space: 30,
        cyber: 40,
        biotech: 50,
        quantum: 60,
      });

      const turnsSince: Record<string, number> = {
        [TechDomain.AI]: 5,
        [TechDomain.Semiconductors]: 6,
        [TechDomain.Space]: 10,
        [TechDomain.Cyber]: 5,
        [TechDomain.Biotech]: 7,
        [TechDomain.Quantum]: 5,
      };

      const result = engine.computeDecay({
        factionId: US,
        techIndex: idx,
        turnsSinceInvestment: turnsSince,
        currentTurn: TURN,
      });

      expect(result.factionId).toBe(US);
      expect(result.decayedDomains).toHaveLength(6);

      // Check each domain lost exactly 1 level
      for (const d of result.decayedDomains) {
        expect(d.newLevel).toBe(d.previousLevel - 1);
      }
    });

    it('does NOT decay domains idle for only 4 turns', () => {
      const idx = makeTechIndex({ ai: 50, semiconductors: 50 });

      const turnsSince: Record<string, number> = {
        [TechDomain.AI]: 4,
        [TechDomain.Semiconductors]: 4,
        [TechDomain.Space]: 4,
        [TechDomain.Cyber]: 4,
        [TechDomain.Biotech]: 4,
        [TechDomain.Quantum]: 4,
      };

      const result = engine.computeDecay({
        factionId: US,
        techIndex: idx,
        turnsSinceInvestment: turnsSince,
        currentTurn: TURN,
      });

      expect(result.decayedDomains).toHaveLength(0);
    });

    it('does NOT decay a domain that is already at level 0', () => {
      const idx = makeTechIndex({ ai: 0 });

      const turnsSince: Record<string, number> = {
        [TechDomain.AI]: 10,
        [TechDomain.Semiconductors]: 0,
        [TechDomain.Space]: 0,
        [TechDomain.Cyber]: 0,
        [TechDomain.Biotech]: 0,
        [TechDomain.Quantum]: 0,
      };

      const result = engine.computeDecay({
        factionId: US,
        techIndex: idx,
        turnsSinceInvestment: turnsSince,
        currentTurn: TURN,
      });

      // AI is level 0, so even with 10 idle turns it doesn't appear
      expect(result.decayedDomains).toHaveLength(0);
    });

    it('clamps decay result to 0 (level 1 → 0, not -1)', () => {
      const idx = makeTechIndex({ ai: 1 });

      const turnsSince: Record<string, number> = {
        [TechDomain.AI]: 5,
        [TechDomain.Semiconductors]: 0,
        [TechDomain.Space]: 0,
        [TechDomain.Cyber]: 0,
        [TechDomain.Biotech]: 0,
        [TechDomain.Quantum]: 0,
      };

      const result = engine.computeDecay({
        factionId: US,
        techIndex: idx,
        turnsSinceInvestment: turnsSince,
        currentTurn: TURN,
      });

      expect(result.decayedDomains).toHaveLength(1);
      expect(result.decayedDomains[0].previousLevel).toBe(1);
      expect(result.decayedDomains[0].newLevel).toBe(0);
    });

    it('handles mixed scenario — some idle, some invested', () => {
      const idx = makeTechIndex({
        ai: 50,
        semiconductors: 30,
        space: 10,
        cyber: 0,
        biotech: 20,
        quantum: 5,
      });

      const turnsSince: Record<string, number> = {
        [TechDomain.AI]: 5,           // idle >= 5, level > 0 → decays
        [TechDomain.Semiconductors]: 3, // idle < 5 → no decay
        [TechDomain.Space]: 5,         // idle >= 5, level > 0 → decays
        [TechDomain.Cyber]: 10,        // idle >= 5, level = 0 → no decay
        [TechDomain.Biotech]: 1,       // idle < 5 → no decay
        [TechDomain.Quantum]: 5,       // idle >= 5, level > 0 → decays
      };

      const result = engine.computeDecay({
        factionId: US,
        techIndex: idx,
        turnsSinceInvestment: turnsSince,
        currentTurn: TURN,
      });

      expect(result.decayedDomains).toHaveLength(3);

      const domains = result.decayedDomains.map((d) => d.domain);
      expect(domains).toContain(TechDomain.AI);
      expect(domains).toContain(TechDomain.Space);
      expect(domains).toContain(TechDomain.Quantum);
    });

    it('treats missing turnsSinceInvestment entries as 0 (no decay)', () => {
      const idx = makeTechIndex({ ai: 50 });

      // Empty map — all domains default to 0 turns idle
      const result = engine.computeDecay({
        factionId: US,
        techIndex: idx,
        turnsSinceInvestment: {},
        currentTurn: TURN,
      });

      expect(result.decayedDomains).toHaveLength(0);
    });

    it('includes a reason string', () => {
      const idx = makeTechIndex({ ai: 10 });

      const result = engine.computeDecay({
        factionId: US,
        techIndex: idx,
        turnsSinceInvestment: { [TechDomain.AI]: 5 },
        currentTurn: TURN,
      });

      expect(result.reason).toContain('Decay evaluation');
    });
  });

  // -------------------------------------------------------------------------
  // evaluateTechEspionage (FR-1802)
  // -------------------------------------------------------------------------
  describe('evaluateTechEspionage', () => {
    const cfg = GAME_CONFIG.technology;

    it('succeeds + discovered: gains 5 levels, tension +20, legitimacy -10', () => {
      const result = engine.evaluateTechEspionage({
        spyFaction: US,
        targetFaction: CHINA,
        domain: TechDomain.AI,
        spyCurrentLevel: 30,
        targetCurrentLevel: 60,
        operationSucceeded: true,
        discoveredByTarget: true,
        currentTurn: TURN,
      });

      expect(result.eligible).toBe(true);
      expect(result.levelGained).toBe(cfg.espionage.levelBonus);
      expect(result.newLevel).toBe(35);
      expect(result.discovered).toBe(true);
      expect(result.diplomaticConsequences.tensionIncrease).toBe(cfg.espionage.discoveryTensionIncrease);
      expect(result.diplomaticConsequences.legitimacyPenalty).toBe(cfg.espionage.discoveryLegitimacyPenalty);
    });

    it('succeeds + undiscovered: gains 5 levels, no diplomatic consequences', () => {
      const result = engine.evaluateTechEspionage({
        spyFaction: US,
        targetFaction: CHINA,
        domain: TechDomain.Cyber,
        spyCurrentLevel: 40,
        targetCurrentLevel: 80,
        operationSucceeded: true,
        discoveredByTarget: false,
        currentTurn: TURN,
      });

      expect(result.eligible).toBe(true);
      expect(result.levelGained).toBe(5);
      expect(result.newLevel).toBe(45);
      expect(result.discovered).toBe(false);
      expect(result.diplomaticConsequences.tensionIncrease).toBe(0);
      expect(result.diplomaticConsequences.legitimacyPenalty).toBe(0);
    });

    it('eligible but operation failed: no levels gained', () => {
      const result = engine.evaluateTechEspionage({
        spyFaction: US,
        targetFaction: CHINA,
        domain: TechDomain.Quantum,
        spyCurrentLevel: 20,
        targetCurrentLevel: 50,
        operationSucceeded: false,
        discoveredByTarget: false,
        currentTurn: TURN,
      });

      expect(result.eligible).toBe(true);
      expect(result.levelGained).toBe(0);
      expect(result.newLevel).toBe(20);
    });

    it('ineligible when spy level >= target level: no gain', () => {
      const result = engine.evaluateTechEspionage({
        spyFaction: US,
        targetFaction: CHINA,
        domain: TechDomain.Biotech,
        spyCurrentLevel: 50,
        targetCurrentLevel: 50,
        operationSucceeded: true,
        discoveredByTarget: false,
        currentTurn: TURN,
      });

      expect(result.eligible).toBe(false);
      expect(result.levelGained).toBe(0);
      expect(result.newLevel).toBe(50);
    });

    it('ineligible when spy level > target level', () => {
      const result = engine.evaluateTechEspionage({
        spyFaction: US,
        targetFaction: CHINA,
        domain: TechDomain.Space,
        spyCurrentLevel: 60,
        targetCurrentLevel: 40,
        operationSucceeded: true,
        discoveredByTarget: false,
        currentTurn: TURN,
      });

      expect(result.eligible).toBe(false);
      expect(result.levelGained).toBe(0);
      expect(result.newLevel).toBe(60);
    });

    it('caps new level at 100 when spy=97 and gains 5', () => {
      const result = engine.evaluateTechEspionage({
        spyFaction: US,
        targetFaction: CHINA,
        domain: TechDomain.AI,
        spyCurrentLevel: 97,
        targetCurrentLevel: 100,
        operationSucceeded: true,
        discoveredByTarget: false,
        currentTurn: TURN,
      });

      expect(result.eligible).toBe(true);
      expect(result.levelGained).toBe(5);
      // 97 + 5 = 102 → clamped to 100
      expect(result.newLevel).toBe(100);
    });

    it('eligible + failed + discovered: no gain but diplomatic consequences apply', () => {
      const result = engine.evaluateTechEspionage({
        spyFaction: CHINA,
        targetFaction: US,
        domain: TechDomain.Semiconductors,
        spyCurrentLevel: 30,
        targetCurrentLevel: 70,
        operationSucceeded: false,
        discoveredByTarget: true,
        currentTurn: TURN,
      });

      expect(result.eligible).toBe(true);
      expect(result.levelGained).toBe(0);
      expect(result.newLevel).toBe(30);
      expect(result.discovered).toBe(true);
      expect(result.diplomaticConsequences.tensionIncrease).toBe(20);
      expect(result.diplomaticConsequences.legitimacyPenalty).toBe(-10);
    });

    it('includes a reason string', () => {
      const result = engine.evaluateTechEspionage({
        spyFaction: US,
        targetFaction: CHINA,
        domain: TechDomain.AI,
        spyCurrentLevel: 30,
        targetCurrentLevel: 60,
        operationSucceeded: true,
        discoveredByTarget: false,
        currentTurn: TURN,
      });

      expect(result.reason).toContain('espionage');
    });
  });
});
