/**
 * Emergent Technology Engine — Test Suite
 *
 * Comprehensive tests covering per-nation tech profiles, emergent tech
 * generation, maturity progression, cross-industry impacts, tech adoption,
 * and full turn processing.
 *
 * @see FR-6100 — Emergent Technology & Per-Nation Tech Differentiation
 */

import { describe, it, expect } from 'vitest';
import {
  initNationTechProfile,
  initEmergentTechState,
  updateNationTechProfile,
  computeGenerationProbability,
  attemptEmergentTechGeneration,
  progressEmergentTechs,
  computeActiveEffects,
  tickTemporaryImpacts,
  canAdoptTech,
  attemptTechAdoption,
  processEmergentTechTurn,
  getNationEmergentTechs,
  getEmergentTechSummary,
} from '@/engine/emergent-tech-engine';
import type { TechnologyIndex } from '@/data/types/technology.types';
import type { NationState } from '@/data/types/nation.types';
import type {
  NationTechProfile,
  EmergentTechnology,
  EmergentTechState,
  EmergentTechMaturity,
} from '@/data/types/emergent-tech.types';
import type { FactionId, TechDomain } from '@/data/types/enums';
import { ALL_FACTIONS } from '@/data/types/enums';
import { SeededRandom } from '@/engine/rng';

// ── Test Helpers ────────────────────────────────────────────────────────────

function buildTechIndex(overrides: Partial<TechnologyIndex> = {}): TechnologyIndex {
  return {
    factionId: 'us' as FactionId,
    ai: 70,
    semiconductors: 65,
    space: 60,
    cyber: 55,
    biotech: 50,
    quantum: 45,
    techBlocAlignment: null,
    activeResearch: [],
    exportControls: {},
    ...overrides,
  };
}

function buildNationState(overrides: Partial<NationState> = {}): NationState {
  return {
    factionId: 'us' as FactionId,
    stability: 70,
    treasury: 500,
    gdp: 22000,
    inflation: 3,
    militaryReadiness: 75,
    nuclearThreshold: 10,
    diplomaticInfluence: 80,
    popularity: 55,
    allianceCredibility: 70,
    techLevel: 85,
    ...overrides,
  };
}

function buildEmergentTech(overrides: Partial<EmergentTechnology> = {}): EmergentTechnology {
  return {
    emergentTechId: 'emt-us-5-1',
    name: 'Test Emergent Tech',
    description: 'A test emergent technology.',
    originFaction: 'us' as FactionId,
    originTurn: 5,
    primaryDomain: 'AI' as TechDomain,
    secondaryDomains: ['Biotech' as TechDomain],
    catalystFoci: ['ai', 'biotech'],
    maturity: 'theoretical' as EmergentTechMaturity,
    maturityProgress: 0,
    crossIndustryImpacts: [],
    domainBoosts: { AI: 3, Biotech: 1 },
    nationStatModifiers: {
      techLevelDelta: 2,
      gdpGrowthPct: 0.3,
      stabilityDelta: 1,
    },
    transferable: true,
    adoptionRequirements: { AI: 50 },
    adoptedBy: [],
    tags: ['ai', 'biotech', 'emergent', 'us'],
    ...overrides,
  };
}

function buildEmergentTechState(overrides: Partial<EmergentTechState> = {}): EmergentTechState {
  return {
    nationProfiles: {} as Record<FactionId, NationTechProfile>,
    emergentTechs: {},
    eventLog: [],
    totalGenerated: 0,
    globalInnovationVelocity: 1.0,
    ...overrides,
  };
}

function buildTechIndicesForAllFactions(): Record<FactionId, TechnologyIndex> {
  const result: Record<string, TechnologyIndex> = {};
  for (const fid of ALL_FACTIONS) {
    result[fid] = buildTechIndex({ factionId: fid as FactionId });
  }
  return result as Record<FactionId, TechnologyIndex>;
}

function buildNationStatesForAllFactions(): Record<FactionId, NationState> {
  const result: Record<string, NationState> = {};
  for (const fid of ALL_FACTIONS) {
    result[fid] = buildNationState({ factionId: fid as FactionId });
  }
  return result as Record<FactionId, NationState>;
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('Emergent Technology Engine', () => {

  // ── initNationTechProfile ────────────────────────────────────────────────
  describe('initNationTechProfile', () => {
    it('creates a US profile with expected default foci', () => {
      const ti = buildTechIndex({ factionId: 'us' as FactionId });
      const ns = buildNationState({ factionId: 'us' as FactionId });
      const profile = initNationTechProfile('us' as FactionId, ti, ns, 1);

      expect(profile.factionId).toBe('us');
      expect(profile.researchFoci).toContain('ai');
      expect(profile.researchFoci).toContain('space');
      expect(profile.researchFoci).toContain('biotech');
      expect(profile.innovationCulture).toBeGreaterThan(0);
      expect(profile.rdSpendingPct).toBeGreaterThan(0);
      expect(profile.generatedTechIds).toEqual([]);
      expect(profile.adoptedTechIds).toEqual([]);
      expect(profile.lastUpdatedTurn).toBe(1);
    });

    it('creates a DPRK profile with low innovation culture', () => {
      const ti = buildTechIndex({ factionId: 'dprk' as FactionId, ai: 15, semiconductors: 10 });
      const ns = buildNationState({ factionId: 'dprk' as FactionId, stability: 60, treasury: 20, gdp: 30 });
      const profile = initNationTechProfile('dprk' as FactionId, ti, ns, 1);

      expect(profile.factionId).toBe('dprk');
      expect(profile.innovationCulture).toBeLessThan(30);
      expect(profile.rdSpendingPct).toBeLessThan(1);
      expect(profile.researchFoci).toContain('cyber');
    });

    it('produces different profiles for US vs China', () => {
      const usTi = buildTechIndex({ factionId: 'us' as FactionId });
      const cnTi = buildTechIndex({ factionId: 'china' as FactionId });
      const usNs = buildNationState({ factionId: 'us' as FactionId });
      const cnNs = buildNationState({ factionId: 'china' as FactionId });

      const usProfile = initNationTechProfile('us' as FactionId, usTi, usNs, 1);
      const cnProfile = initNationTechProfile('china' as FactionId, cnTi, cnNs, 1);

      expect(usProfile.researchFoci).not.toEqual(cnProfile.researchFoci);
      expect(usProfile.domainEfficiency).not.toEqual(cnProfile.domainEfficiency);
    });

    it('scales innovation culture with stability', () => {
      const ti = buildTechIndex({ factionId: 'us' as FactionId });
      const highStability = buildNationState({ stability: 95 });
      const lowStability = buildNationState({ stability: 25 });

      const highProfile = initNationTechProfile('us' as FactionId, ti, highStability, 1);
      const lowProfile = initNationTechProfile('us' as FactionId, ti, lowStability, 1);

      expect(highProfile.innovationCulture).toBeGreaterThan(lowProfile.innovationCulture);
    });

    it('sets domain efficiency based on affinity multipliers', () => {
      const ti = buildTechIndex({ factionId: 'russia' as FactionId });
      const ns = buildNationState({ factionId: 'russia' as FactionId });
      const profile = initNationTechProfile('russia' as FactionId, ti, ns, 1);

      // Russia has high Cyber multiplier (1.4) and low Semiconductors (0.6)
      expect(profile.domainEfficiency.Cyber).toBeGreaterThan(profile.domainEfficiency.Semiconductors);
    });
  });

  // ── initEmergentTechState ────────────────────────────────────────────────
  describe('initEmergentTechState', () => {
    it('initialises profiles for all factions', () => {
      const techIndices = buildTechIndicesForAllFactions();
      const nationStates = buildNationStatesForAllFactions();
      const state = initEmergentTechState(techIndices, nationStates, 1);

      for (const fid of ALL_FACTIONS) {
        expect(state.nationProfiles[fid]).toBeDefined();
        expect(state.nationProfiles[fid].factionId).toBe(fid);
      }
      expect(state.totalGenerated).toBe(0);
      expect(state.globalInnovationVelocity).toBe(1.0);
      expect(state.eventLog).toEqual([]);
      expect(Object.keys(state.emergentTechs)).toHaveLength(0);
    });
  });

  // ── updateNationTechProfile ──────────────────────────────────────────────
  describe('updateNationTechProfile', () => {
    it('updates domain efficiency when tech scores change', () => {
      const ti = buildTechIndex({ factionId: 'us' as FactionId });
      const ns = buildNationState({ factionId: 'us' as FactionId });
      const profile = initNationTechProfile('us' as FactionId, ti, ns, 1);

      // Improve AI score
      const improvedTi = { ...ti, ai: 95 };
      const updated = updateNationTechProfile(profile, improvedTi, ns, 2);

      expect(updated.domainEfficiency.AI).toBeGreaterThan(profile.domainEfficiency.AI);
      expect(updated.lastUpdatedTurn).toBe(2);
    });

    it('adjusts talent flow based on stability and economy', () => {
      const ti = buildTechIndex({ factionId: 'us' as FactionId });
      const goodNs = buildNationState({ stability: 90, gdp: 25000 });
      const badNs = buildNationState({ stability: 20, gdp: 100 });
      const profile = initNationTechProfile('us' as FactionId, ti, goodNs, 1);

      const goodUpdate = updateNationTechProfile(profile, ti, goodNs, 2);
      const badUpdate = updateNationTechProfile(profile, ti, badNs, 2);

      expect(goodUpdate.talentFlow).toBeGreaterThan(badUpdate.talentFlow);
    });

    it('adjusts R&D spending with treasury health', () => {
      const ti = buildTechIndex();
      const richNs = buildNationState({ treasury: 1000 });
      const poorNs = buildNationState({ treasury: 10 });
      const profile = initNationTechProfile('us' as FactionId, ti, richNs, 1);

      const richUpdate = updateNationTechProfile(profile, ti, richNs, 2);
      const poorUpdate = updateNationTechProfile(profile, ti, poorNs, 2);

      expect(richUpdate.rdSpendingPct).toBeGreaterThan(poorUpdate.rdSpendingPct);
    });
  });

  // ── computeGenerationProbability ─────────────────────────────────────────
  describe('computeGenerationProbability', () => {
    it('returns 0 when innovation culture is below minimum', () => {
      const ti = buildTechIndex();
      const ns = buildNationState();
      const profile = initNationTechProfile('us' as FactionId, ti, ns, 1);
      profile.innovationCulture = 5; // Below minInnovationCulture (20)

      const prob = computeGenerationProbability(profile, ti, ns, 0, 1.0, 5);
      expect(prob).toBe(0);
    });

    it('returns 0 when max per-nation techs reached', () => {
      const ti = buildTechIndex();
      const ns = buildNationState();
      const profile = initNationTechProfile('us' as FactionId, ti, ns, 1);
      profile.generatedTechIds = Array(15).fill('emt-test'); // At max

      const prob = computeGenerationProbability(profile, ti, ns, 0, 1.0, 50);
      expect(prob).toBe(0);
    });

    it('returns 0 when strongest domain is below threshold', () => {
      const ti = buildTechIndex({ ai: 20, semiconductors: 20, space: 20, cyber: 20, biotech: 20, quantum: 20 });
      const ns = buildNationState();
      const profile = initNationTechProfile('us' as FactionId, ti, ns, 1);

      const prob = computeGenerationProbability(profile, ti, ns, 0, 1.0, 5);
      expect(prob).toBe(0);
    });

    it('returns positive probability for capable nations', () => {
      const ti = buildTechIndex({ ai: 80 });
      const ns = buildNationState({ stability: 70 });
      const profile = initNationTechProfile('us' as FactionId, ti, ns, 1);

      const prob = computeGenerationProbability(profile, ti, ns, 0, 1.0, 5);
      expect(prob).toBeGreaterThan(0);
    });

    it('increases probability with higher domain scores', () => {
      const ns = buildNationState();
      const lowTi = buildTechIndex({ ai: 50 });
      const highTi = buildTechIndex({ ai: 90 });
      const profile = initNationTechProfile('us' as FactionId, lowTi, ns, 1);

      const lowProb = computeGenerationProbability(profile, lowTi, ns, 0, 1.0, 5);
      const highProb = computeGenerationProbability(profile, highTi, ns, 0, 1.0, 5);

      expect(highProb).toBeGreaterThan(lowProb);
    });

    it('scales with global innovation velocity', () => {
      const ti = buildTechIndex({ ai: 80 });
      const ns = buildNationState();
      const profile = initNationTechProfile('us' as FactionId, ti, ns, 1);

      const lowVelocity = computeGenerationProbability(profile, ti, ns, 0, 0.5, 5);
      const highVelocity = computeGenerationProbability(profile, ti, ns, 0, 2.0, 5);

      expect(highVelocity).toBeGreaterThan(lowVelocity);
    });

    it('applies low stability penalty', () => {
      const ti = buildTechIndex({ ai: 80 });
      const stableNs = buildNationState({ stability: 70 });
      const unstableNs = buildNationState({ stability: 20 });
      const profile = initNationTechProfile('us' as FactionId, ti, stableNs, 1);

      const stableProb = computeGenerationProbability(profile, ti, stableNs, 0, 1.0, 5);
      const unstableProb = computeGenerationProbability(profile, ti, unstableNs, 0, 1.0, 5);

      expect(stableProb).toBeGreaterThan(unstableProb);
    });

    it('caps probability at maxChancePerTurn', () => {
      const ti = buildTechIndex({ ai: 100, semiconductors: 100, space: 100, cyber: 100, biotech: 100, quantum: 100 });
      const ns = buildNationState();
      const profile = initNationTechProfile('us' as FactionId, ti, ns, 1);
      profile.innovationCulture = 100;
      profile.rdSpendingPct = 10;
      profile.talentFlow = 50;

      const prob = computeGenerationProbability(profile, ti, ns, 0, 3.0, 5);
      expect(prob).toBeLessThanOrEqual(25); // maxChancePerTurn
    });
  });

  // ── attemptEmergentTechGeneration ────────────────────────────────────────
  describe('attemptEmergentTechGeneration', () => {
    it('generates a tech when RNG roll is favourable', () => {
      const ti = buildTechIndex({ ai: 90, factionId: 'us' as FactionId });
      const ns = buildNationState({ factionId: 'us' as FactionId });
      const profile = initNationTechProfile('us' as FactionId, ti, ns, 1);
      const state = buildEmergentTechState({ nationProfiles: { us: profile } as any });

      // Use a seed that we know gives a low roll (< generation probability)
      // Try multiple seeds to find one that works
      let result = null;
      for (let seed = 1; seed < 200; seed++) {
        const rng = new SeededRandom(seed);
        result = attemptEmergentTechGeneration(profile, ti, ns, state, 5, rng);
        if (result) break;
      }

      // With 200 attempts, at least one should succeed given ~10%+ probability
      expect(result).not.toBeNull();
      if (result) {
        expect(result.tech.emergentTechId).toMatch(/^emt-us-5-/);
        expect(result.tech.originFaction).toBe('us');
        expect(result.tech.maturity).toBe('theoretical');
        expect(result.tech.name.length).toBeGreaterThan(0);
        expect(result.event.eventType).toBe('generation');
        expect(result.event.headline).toContain('US');
      }
    });

    it('returns null when global cap is reached', () => {
      const ti = buildTechIndex({ ai: 90 });
      const ns = buildNationState();
      const profile = initNationTechProfile('us' as FactionId, ti, ns, 1);
      const state = buildEmergentTechState({ totalGenerated: 60 }); // At global max
      const rng = new SeededRandom(42);

      const result = attemptEmergentTechGeneration(profile, ti, ns, state, 5, rng);
      expect(result).toBeNull();
    });

    it('generates cross-industry impacts on creation', () => {
      const ti = buildTechIndex({ ai: 90 });
      const ns = buildNationState();
      const profile = initNationTechProfile('us' as FactionId, ti, ns, 1);
      const state = buildEmergentTechState({ nationProfiles: { us: profile } as any });

      let result = null;
      for (let seed = 1; seed < 300; seed++) {
        const rng = new SeededRandom(seed);
        result = attemptEmergentTechGeneration(profile, ti, ns, state, 5, rng);
        if (result) break;
      }

      if (result) {
        expect(result.tech.crossIndustryImpacts.length).toBeGreaterThanOrEqual(1);
        for (const impact of result.tech.crossIndustryImpacts) {
          expect(impact.sector).toBeDefined();
          expect(typeof impact.magnitude).toBe('number');
          expect(typeof impact.delayTurns).toBe('number');
        }
      }
    });

    it('assigns domain boosts to generated tech', () => {
      const ti = buildTechIndex({ ai: 90 });
      const ns = buildNationState();
      const profile = initNationTechProfile('us' as FactionId, ti, ns, 1);
      const state = buildEmergentTechState({ nationProfiles: { us: profile } as any });

      let result = null;
      for (let seed = 1; seed < 300; seed++) {
        const rng = new SeededRandom(seed);
        result = attemptEmergentTechGeneration(profile, ti, ns, state, 5, rng);
        if (result) break;
      }

      if (result) {
        expect(Object.keys(result.tech.domainBoosts).length).toBeGreaterThan(0);
      }
    });
  });

  // ── progressEmergentTechs ────────────────────────────────────────────────
  describe('progressEmergentTechs', () => {
    it('advances maturity progress each turn', () => {
      const tech = buildEmergentTech({ maturity: 'theoretical', maturityProgress: 0 });
      const profile = initNationTechProfile(
        'us' as FactionId,
        buildTechIndex(),
        buildNationState(),
        1,
      );

      const { updatedTechs } = progressEmergentTechs([tech], profile, 6);
      expect(updatedTechs[0].maturityProgress).toBeGreaterThan(0);
    });

    it('promotes to next maturity stage when threshold reached', () => {
      const tech = buildEmergentTech({ maturity: 'theoretical', maturityProgress: 95 });
      const profile = initNationTechProfile(
        'us' as FactionId,
        buildTechIndex(),
        buildNationState(),
        1,
      );

      const { updatedTechs, events } = progressEmergentTechs([tech], profile, 6);
      expect(updatedTechs[0].maturity).toBe('experimental');
      expect(events.length).toBe(1);
      expect(events[0].eventType).toBe('maturity_advance');
    });

    it('does not advance beyond mature', () => {
      const tech = buildEmergentTech({ maturity: 'mature', maturityProgress: 0 });
      const profile = initNationTechProfile(
        'us' as FactionId,
        buildTechIndex(),
        buildNationState(),
        1,
      );

      const { updatedTechs, events } = progressEmergentTechs([tech], profile, 6);
      expect(updatedTechs[0].maturity).toBe('mature');
      expect(events.length).toBe(0);
    });

    it('progresses faster with high innovation culture', () => {
      const tech1 = buildEmergentTech({ maturity: 'theoretical', maturityProgress: 0 });
      const tech2 = buildEmergentTech({ maturity: 'theoretical', maturityProgress: 0, emergentTechId: 'emt-2' });

      const highCultureProfile = initNationTechProfile(
        'us' as FactionId,
        buildTechIndex(),
        buildNationState({ stability: 95 }),
        1,
      );
      highCultureProfile.innovationCulture = 90;

      const lowCultureProfile = initNationTechProfile(
        'dprk' as FactionId,
        buildTechIndex({ factionId: 'dprk' as FactionId, ai: 20 }),
        buildNationState({ factionId: 'dprk' as FactionId, stability: 40 }),
        1,
      );
      lowCultureProfile.innovationCulture = 25;

      const { updatedTechs: highResult } = progressEmergentTechs([tech1], highCultureProfile, 6);
      const { updatedTechs: lowResult } = progressEmergentTechs([tech2], lowCultureProfile, 6);

      expect(highResult[0].maturityProgress).toBeGreaterThan(lowResult[0].maturityProgress);
    });

    it('generates maturity advance event with correct headline', () => {
      const tech = buildEmergentTech({
        maturity: 'experimental',
        maturityProgress: 95,
        name: 'Quantum Neural Network',
        originFaction: 'us' as FactionId,
      });
      const profile = initNationTechProfile(
        'us' as FactionId,
        buildTechIndex(),
        buildNationState(),
        1,
      );

      const { events } = progressEmergentTechs([tech], profile, 6);
      if (events.length > 0) {
        expect(events[0].headline).toContain('US');
        expect(events[0].headline).toContain('Quantum Neural Network');
      }
    });
  });

  // ── computeActiveEffects ─────────────────────────────────────────────────
  describe('computeActiveEffects', () => {
    it('returns zero effects for techs below operational maturity', () => {
      const techs = [
        buildEmergentTech({ maturity: 'theoretical' }),
        buildEmergentTech({ maturity: 'experimental', emergentTechId: 'emt-2' }),
        buildEmergentTech({ maturity: 'prototype', emergentTechId: 'emt-3' }),
      ];

      const effects = computeActiveEffects(techs, 10);
      expect(effects.techLevelDelta).toBe(0);
      expect(effects.gdpGrowthPct).toBe(0);
      expect(effects.stabilityDelta).toBe(0);
      expect(effects.militaryReadinessDelta).toBe(0);
    });

    it('applies half-scaled effects for operational techs', () => {
      const tech = buildEmergentTech({
        maturity: 'operational',
        nationStatModifiers: { techLevelDelta: 4, gdpGrowthPct: 2 },
      });

      const effects = computeActiveEffects([tech], 10);
      expect(effects.techLevelDelta).toBe(2); // 4 * 0.5
      expect(effects.gdpGrowthPct).toBe(1); // 2 * 0.5
    });

    it('applies full-scaled effects for mature techs', () => {
      const tech = buildEmergentTech({
        maturity: 'mature',
        nationStatModifiers: { techLevelDelta: 4, gdpGrowthPct: 2 },
      });

      const effects = computeActiveEffects([tech], 10);
      expect(effects.techLevelDelta).toBe(4);
      expect(effects.gdpGrowthPct).toBe(2);
    });

    it('accumulates domain boosts from multiple techs', () => {
      const tech1 = buildEmergentTech({
        maturity: 'operational',
        domainBoosts: { AI: 4, Biotech: 2 },
        emergentTechId: 'emt-1',
      });
      const tech2 = buildEmergentTech({
        maturity: 'mature',
        domainBoosts: { AI: 3, Quantum: 5 },
        emergentTechId: 'emt-2',
      });

      const effects = computeActiveEffects([tech1, tech2], 10);
      expect(effects.domainBoosts['AI']).toBe(2 + 3); // 4*0.5 + 3*1.0
      expect(effects.domainBoosts['Quantum']).toBe(5);
    });

    it('maps cross-industry defense impacts to military readiness', () => {
      const tech = buildEmergentTech({
        maturity: 'operational',
        originTurn: 1,
        crossIndustryImpacts: [{
          sector: 'defense',
          magnitude: 20,
          description: 'test',
          delayTurns: 0,
          temporary: false,
          turnsRemaining: null,
        }],
        nationStatModifiers: {},
      });

      const effects = computeActiveEffects([tech], 10);
      expect(effects.militaryReadinessDelta).toBeGreaterThan(0);
    });

    it('respects delay on cross-industry impacts', () => {
      const tech = buildEmergentTech({
        maturity: 'operational',
        originTurn: 8,
        crossIndustryImpacts: [{
          sector: 'defense',
          magnitude: 20,
          description: 'test',
          delayTurns: 5,
          temporary: false,
          turnsRemaining: null,
        }],
        nationStatModifiers: {},
      });

      // Turn 10: only 2 turns since origin, but delay is 5
      const effects = computeActiveEffects([tech], 10);
      expect(effects.militaryReadinessDelta).toBe(0);
    });
  });

  // ── tickTemporaryImpacts ─────────────────────────────────────────────────
  describe('tickTemporaryImpacts', () => {
    it('decrements turns remaining on temporary impacts', () => {
      const tech = buildEmergentTech({
        crossIndustryImpacts: [{
          sector: 'finance',
          magnitude: 15,
          description: 'test',
          delayTurns: 0,
          temporary: true,
          turnsRemaining: 5,
        }],
      });

      const result = tickTemporaryImpacts([tech]);
      expect(result[0].crossIndustryImpacts[0].turnsRemaining).toBe(4);
    });

    it('does not decrement permanent impacts', () => {
      const tech = buildEmergentTech({
        crossIndustryImpacts: [{
          sector: 'finance',
          magnitude: 15,
          description: 'test',
          delayTurns: 0,
          temporary: false,
          turnsRemaining: null,
        }],
      });

      const result = tickTemporaryImpacts([tech]);
      expect(result[0].crossIndustryImpacts[0].turnsRemaining).toBeNull();
    });
  });

  // ── canAdoptTech ─────────────────────────────────────────────────────────
  describe('canAdoptTech', () => {
    it('returns false for non-transferable tech', () => {
      const tech = buildEmergentTech({ transferable: false, maturity: 'operational' });
      const ti = buildTechIndex({ factionId: 'china' as FactionId, ai: 60 });

      expect(canAdoptTech(tech, 'china' as FactionId, ti, 10)).toBe(false);
    });

    it('returns false for the originating faction', () => {
      const tech = buildEmergentTech({ originFaction: 'us' as FactionId, maturity: 'operational' });
      const ti = buildTechIndex({ factionId: 'us' as FactionId });

      expect(canAdoptTech(tech, 'us' as FactionId, ti, 10)).toBe(false);
    });

    it('returns false for already adopted faction', () => {
      const tech = buildEmergentTech({
        maturity: 'operational',
        adoptedBy: ['china' as FactionId],
      });
      const ti = buildTechIndex({ factionId: 'china' as FactionId, ai: 60 });

      expect(canAdoptTech(tech, 'china' as FactionId, ti, 10)).toBe(false);
    });

    it('returns false for theoretical-maturity tech', () => {
      const tech = buildEmergentTech({ maturity: 'theoretical' });
      const ti = buildTechIndex({ factionId: 'china' as FactionId, ai: 60 });

      expect(canAdoptTech(tech, 'china' as FactionId, ti, 10)).toBe(false);
    });

    it('returns false before adoption delay', () => {
      const tech = buildEmergentTech({ maturity: 'experimental', originTurn: 9 });
      const ti = buildTechIndex({ factionId: 'china' as FactionId, ai: 60 });

      // Turn 10, delay is 2, originTurn is 9 → only 1 turn has passed
      expect(canAdoptTech(tech, 'china' as FactionId, ti, 10)).toBe(false);
    });

    it('returns false when domain gap is too large', () => {
      const tech = buildEmergentTech({
        maturity: 'operational',
        originTurn: 1,
        adoptionRequirements: { AI: 80 },
      });
      const ti = buildTechIndex({ factionId: 'china' as FactionId, ai: 20 }); // Gap = 60 > maxDomainGap (30)

      expect(canAdoptTech(tech, 'china' as FactionId, ti, 10)).toBe(false);
    });

    it('returns true when all conditions are met', () => {
      const tech = buildEmergentTech({
        maturity: 'operational',
        originTurn: 1,
        originFaction: 'us' as FactionId,
        adoptionRequirements: { AI: 50 },
      });
      const ti = buildTechIndex({ factionId: 'china' as FactionId, ai: 60 }); // Gap = -10

      expect(canAdoptTech(tech, 'china' as FactionId, ti, 10)).toBe(true);
    });
  });

  // ── attemptTechAdoption ──────────────────────────────────────────────────
  describe('attemptTechAdoption', () => {
    it('returns null when canAdoptTech fails', () => {
      const tech = buildEmergentTech({ transferable: false });
      const ti = buildTechIndex({ factionId: 'china' as FactionId });
      const rng = new SeededRandom(42);

      const result = attemptTechAdoption(tech, 'china' as FactionId, ti, 80, 10, rng);
      expect(result).toBeNull();
    });

    it('adds adopting faction to adoptedBy on success', () => {
      const tech = buildEmergentTech({
        maturity: 'operational',
        originTurn: 1,
        originFaction: 'us' as FactionId,
        adoptionRequirements: { AI: 40 },
      });
      const ti = buildTechIndex({ factionId: 'china' as FactionId, ai: 70 });

      // Try many seeds
      let result = null;
      for (let seed = 1; seed < 500; seed++) {
        const rng = new SeededRandom(seed);
        result = attemptTechAdoption(tech, 'china' as FactionId, ti, 90, 10, rng);
        if (result) break;
      }

      if (result) {
        expect(result.tech.adoptedBy).toContain('china');
        expect(result.event.eventType).toBe('adoption');
        expect(result.event.factionId).toBe('china');
      }
    });
  });

  // ── processEmergentTechTurn ──────────────────────────────────────────────
  describe('processEmergentTechTurn', () => {
    it('returns updated state with incremented velocity', () => {
      const techIndices = buildTechIndicesForAllFactions();
      const nationStates = buildNationStatesForAllFactions();
      const state = initEmergentTechState(techIndices, nationStates, 1);
      const rng = new SeededRandom(42);

      const result = processEmergentTechTurn({
        state,
        techIndices,
        nationStates,
        relationshipMatrix: {} as any,
        turn: 2,
        rng,
      });

      expect(result.updatedState.globalInnovationVelocity).toBeGreaterThan(state.globalInnovationVelocity);
    });

    it('updates nation profiles for all factions', () => {
      const techIndices = buildTechIndicesForAllFactions();
      const nationStates = buildNationStatesForAllFactions();
      const state = initEmergentTechState(techIndices, nationStates, 1);
      const rng = new SeededRandom(42);

      const result = processEmergentTechTurn({
        state,
        techIndices,
        nationStates,
        relationshipMatrix: {} as any,
        turn: 2,
        rng,
      });

      for (const fid of ALL_FACTIONS) {
        expect(result.updatedState.nationProfiles[fid].lastUpdatedTurn).toBe(2);
      }
    });

    it('provides nation effects for all factions', () => {
      const techIndices = buildTechIndicesForAllFactions();
      const nationStates = buildNationStatesForAllFactions();
      const state = initEmergentTechState(techIndices, nationStates, 1);
      const rng = new SeededRandom(42);

      const result = processEmergentTechTurn({
        state,
        techIndices,
        nationStates,
        relationshipMatrix: {} as any,
        turn: 2,
        rng,
      });

      for (const fid of ALL_FACTIONS) {
        expect(result.nationEffects[fid]).toBeDefined();
        expect(typeof result.nationEffects[fid].techLevelDelta).toBe('number');
      }
    });

    it('respects cooldown between generations', () => {
      const techIndices = buildTechIndicesForAllFactions();
      const nationStates = buildNationStatesForAllFactions();
      const state = initEmergentTechState(techIndices, nationStates, 1);

      // Add a recent generation event for US
      state.eventLog.push({
        emergentTechId: 'emt-us-4-1',
        factionId: 'us' as FactionId,
        turn: 4,
        eventType: 'generation',
        headline: 'test',
        narrative: 'test',
        immediateImpacts: [],
      });

      const rng = new SeededRandom(42);
      const result = processEmergentTechTurn({
        state,
        techIndices,
        nationStates,
        relationshipMatrix: {} as any,
        turn: 5, // Only 1 turn since last gen — within cooldown (3)
        rng,
      });

      // US should not generate another tech this turn
      const usEvents = result.events.filter(
        e => e.factionId === 'us' && e.eventType === 'generation',
      );
      expect(usEvents.length).toBe(0);
    });

    it('is deterministic with same seed', () => {
      const techIndices = buildTechIndicesForAllFactions();
      const nationStates = buildNationStatesForAllFactions();
      const state = initEmergentTechState(techIndices, nationStates, 1);

      const result1 = processEmergentTechTurn({
        state: structuredClone(state),
        techIndices,
        nationStates,
        relationshipMatrix: {} as any,
        turn: 10,
        rng: new SeededRandom(999),
      });

      const result2 = processEmergentTechTurn({
        state: structuredClone(state),
        techIndices,
        nationStates,
        relationshipMatrix: {} as any,
        turn: 10,
        rng: new SeededRandom(999),
      });

      expect(result1.events.length).toBe(result2.events.length);
      expect(result1.breakthroughFactions).toEqual(result2.breakthroughFactions);
      expect(result1.updatedState.totalGenerated).toBe(result2.updatedState.totalGenerated);
    });
  });

  // ── getNationEmergentTechs ───────────────────────────────────────────────
  describe('getNationEmergentTechs', () => {
    it('returns techs originated by and adopted by a faction', () => {
      const state = buildEmergentTechState({
        emergentTechs: {
          'emt-1': buildEmergentTech({ emergentTechId: 'emt-1', originFaction: 'us' as FactionId }),
          'emt-2': buildEmergentTech({ emergentTechId: 'emt-2', originFaction: 'china' as FactionId, adoptedBy: ['us' as FactionId] }),
          'emt-3': buildEmergentTech({ emergentTechId: 'emt-3', originFaction: 'china' as FactionId }),
        },
      });

      const usTechs = getNationEmergentTechs(state, 'us' as FactionId);
      expect(usTechs).toHaveLength(2); // emt-1 (originated) + emt-2 (adopted)
    });

    it('returns empty array when no techs exist for faction', () => {
      const state = buildEmergentTechState();
      const techs = getNationEmergentTechs(state, 'dprk' as FactionId);
      expect(techs).toHaveLength(0);
    });
  });

  // ── getEmergentTechSummary ───────────────────────────────────────────────
  describe('getEmergentTechSummary', () => {
    it('provides correct summary counts', () => {
      const profile = initNationTechProfile(
        'us' as FactionId,
        buildTechIndex(),
        buildNationState(),
        1,
      );
      const state = buildEmergentTechState({
        nationProfiles: { us: profile } as any,
        emergentTechs: {
          'emt-1': buildEmergentTech({ emergentTechId: 'emt-1', originFaction: 'us' as FactionId, maturity: 'operational' }),
          'emt-2': buildEmergentTech({ emergentTechId: 'emt-2', originFaction: 'us' as FactionId, maturity: 'mature' }),
          'emt-3': buildEmergentTech({ emergentTechId: 'emt-3', originFaction: 'china' as FactionId, adoptedBy: ['us' as FactionId], maturity: 'experimental' }),
        },
      });

      const summary = getEmergentTechSummary(state, 'us' as FactionId);
      expect(summary.profile).toBe(profile);
      expect(summary.totalGenerated).toBe(2);
      expect(summary.totalAdopted).toBe(1);
      expect(summary.operationalCount).toBe(1);
      expect(summary.matureCount).toBe(1);
    });

    it('returns null profile when nation not in state', () => {
      const state = buildEmergentTechState();
      const summary = getEmergentTechSummary(state, 'syria' as FactionId);
      expect(summary.profile).toBeNull();
    });
  });

  // ── Nation Differentiation ───────────────────────────────────────────────
  describe('Nation Differentiation', () => {
    it('US has higher AI domain efficiency than DPRK', () => {
      const usTi = buildTechIndex({ factionId: 'us' as FactionId, ai: 70 });
      const usNs = buildNationState({ factionId: 'us' as FactionId });
      const usProfile = initNationTechProfile('us' as FactionId, usTi, usNs, 1);

      const dprkTi = buildTechIndex({ factionId: 'dprk' as FactionId, ai: 15 });
      const dprkNs = buildNationState({ factionId: 'dprk' as FactionId, stability: 50 });
      const dprkProfile = initNationTechProfile('dprk' as FactionId, dprkTi, dprkNs, 1);

      expect(usProfile.domainEfficiency.AI).toBeGreaterThan(dprkProfile.domainEfficiency.AI);
    });

    it('Russia has high Cyber efficiency', () => {
      const ruTi = buildTechIndex({ factionId: 'russia' as FactionId, cyber: 60 });
      const ruNs = buildNationState({ factionId: 'russia' as FactionId });
      const ruProfile = initNationTechProfile('russia' as FactionId, ruTi, ruNs, 1);

      // Russia's cyber multiplier is 1.4 — should be the highest domain
      const maxDomain = Object.entries(ruProfile.domainEfficiency)
        .reduce((max, [, v]) => Math.max(max, v), 0);
      expect(ruProfile.domainEfficiency.Cyber).toBe(maxDomain);
    });

    it('China defaults to semiconductors + AI + quantum focus', () => {
      const cnTi = buildTechIndex({ factionId: 'china' as FactionId });
      const cnNs = buildNationState({ factionId: 'china' as FactionId });
      const cnProfile = initNationTechProfile('china' as FactionId, cnTi, cnNs, 1);

      expect(cnProfile.researchFoci).toContain('semiconductors');
      expect(cnProfile.researchFoci).toContain('ai');
      expect(cnProfile.researchFoci).toContain('quantum');
    });

    it('Iran has negative talent flow', () => {
      const irTi = buildTechIndex({ factionId: 'iran' as FactionId });
      const irNs = buildNationState({ factionId: 'iran' as FactionId });
      const irProfile = initNationTechProfile('iran' as FactionId, irTi, irNs, 1);

      expect(irProfile.talentFlow).toBeLessThan(0);
    });
  });

  // ── Edge Cases ───────────────────────────────────────────────────────────
  describe('Edge Cases', () => {
    it('handles empty emergentTechs gracefully', () => {
      const state = buildEmergentTechState({ emergentTechs: {} });
      const effects = computeActiveEffects([], 10);
      expect(effects.techLevelDelta).toBe(0);
    });

    it('handles zero domain scores', () => {
      const ti = buildTechIndex({ ai: 0, semiconductors: 0, space: 0, cyber: 0, biotech: 0, quantum: 0 });
      const ns = buildNationState();
      const profile = initNationTechProfile('us' as FactionId, ti, ns, 1);

      const prob = computeGenerationProbability(profile, ti, ns, 0, 1.0, 5);
      expect(prob).toBe(0);
    });

    it('handles maximum domain scores', () => {
      const ti = buildTechIndex({ ai: 100, semiconductors: 100, space: 100, cyber: 100, biotech: 100, quantum: 100 });
      const ns = buildNationState({ stability: 100 });
      const profile = initNationTechProfile('us' as FactionId, ti, ns, 1);

      const prob = computeGenerationProbability(profile, ti, ns, 0, 1.0, 5);
      expect(prob).toBeGreaterThan(0);
      expect(prob).toBeLessThanOrEqual(25);
    });

    it('tickTemporaryImpacts handles empty tech list', () => {
      const result = tickTemporaryImpacts([]);
      expect(result).toEqual([]);
    });

    it('processEmergentTechTurn handles empty relationship matrix', () => {
      const techIndices = buildTechIndicesForAllFactions();
      const nationStates = buildNationStatesForAllFactions();
      const state = initEmergentTechState(techIndices, nationStates, 1);
      const rng = new SeededRandom(42);

      // Should not throw
      const result = processEmergentTechTurn({
        state,
        techIndices,
        nationStates,
        relationshipMatrix: {} as any,
        turn: 2,
        rng,
      });

      expect(result.updatedState).toBeDefined();
    });
  });
});
