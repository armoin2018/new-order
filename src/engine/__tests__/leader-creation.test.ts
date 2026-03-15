import { describe, it, expect, beforeEach } from 'vitest';
import { LeaderCreationEngine } from '@/engine/leader-creation';
import type {
  LeaderCustomization,
} from '@/engine/leader-creation';
import { GAME_CONFIG } from '@/engine/config';
import type {
  LeaderProfile,
  LeaderPsychology,
  LeaderId,
  FactionId as FactionIdType,
} from '@/data/types';
import { FactionId, DecisionStyle, StressResponse } from '@/data/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockLeader(overrides?: Partial<LeaderProfile>): LeaderProfile {
  return {
    id: 'leader-test' as unknown as LeaderId,
    identity: {
      name: 'Test Leader',
      title: 'President',
      nation: FactionId.US as FactionIdType,
      age: 55,
      ideology: 'Centrist',
    },
    psychology: {
      decisionStyle: DecisionStyle.Analytical,
      stressResponse: StressResponse.Consolidate,
      riskTolerance: 50,
      paranoia: 50,
      narcissism: 50,
      pragmatism: 50,
      patience: 50,
      vengefulIndex: 50,
    },
    motivations: {
      primaryGoal: 'Test Goal',
      ideologicalCore: 'Test Core',
      redLines: ['Red Line 1'],
      legacyAmbition: 'Test Legacy',
    },
    powerBase: {
      military: 50,
      oligarchs: 50,
      party: 50,
      clergy: 50,
      public: 50,
      securityServices: 50,
    },
    vulnerabilities: {
      healthRisk: 10,
      successionClarity: 80,
      coupRisk: 15,
      personalScandal: 5,
    },
    historicalAnalog: 'Test Analog',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LeaderCreationEngine', () => {
  const config = GAME_CONFIG.leaderCreation;
  let engine: LeaderCreationEngine;

  beforeEach(() => {
    engine = new LeaderCreationEngine(config);
  });

  // -----------------------------------------------------------------------
  // getArchetypePresets
  // -----------------------------------------------------------------------

  describe('getArchetypePresets', () => {
    it('returns exactly 4 presets', () => {
      const presets = engine.getArchetypePresets();
      expect(presets).toHaveLength(4);
    });

    it('returns presets keyed Hawk, Dove, Populist, Technocrat', () => {
      const presets = engine.getArchetypePresets();
      const keys = presets.map((p) => p.key);
      expect(keys).toEqual(['Hawk', 'Dove', 'Populist', 'Technocrat']);
    });

    it('each preset has label, description, and psychology', () => {
      const presets = engine.getArchetypePresets();
      for (const preset of presets) {
        expect(preset.label).toEqual(expect.any(String));
        expect(preset.label.length).toBeGreaterThan(0);
        expect(preset.description).toEqual(expect.any(String));
        expect(preset.description.length).toBeGreaterThan(0);
        expect(preset.psychology).toBeDefined();
        expect(preset.psychology.riskTolerance).toEqual(expect.any(Number));
      }
    });

    it('Hawk preset has riskTolerance 80 and stressResponse Escalate', () => {
      const presets = engine.getArchetypePresets();
      const hawk = presets.find((p) => p.key === 'Hawk');
      expect(hawk).toBeDefined();
      expect(hawk!.psychology.riskTolerance).toBe(80);
      expect(hawk!.psychology.stressResponse).toBe('Escalate');
    });

    it('Dove preset has riskTolerance 25 and patience 85', () => {
      const presets = engine.getArchetypePresets();
      const dove = presets.find((p) => p.key === 'Dove');
      expect(dove).toBeDefined();
      expect(dove!.psychology.riskTolerance).toBe(25);
      expect(dove!.psychology.patience).toBe(85);
    });
  });

  // -----------------------------------------------------------------------
  // getArchetypePreset
  // -----------------------------------------------------------------------

  describe('getArchetypePreset', () => {
    it('returns correct Hawk preset', () => {
      const hawk = engine.getArchetypePreset('Hawk');
      expect(hawk.key).toBe('Hawk');
      expect(hawk.label).toBe('Hawk');
      expect(hawk.psychology.riskTolerance).toBe(80);
      expect(hawk.psychology.stressResponse).toBe('Escalate');
      expect(hawk.psychology.vengefulIndex).toBe(75);
    });

    it('returns correct Technocrat preset', () => {
      const technocrat = engine.getArchetypePreset('Technocrat');
      expect(technocrat.key).toBe('Technocrat');
      expect(technocrat.label).toBe('Technocrat');
      expect(technocrat.psychology.pragmatism).toBe(85);
      expect(technocrat.psychology.patience).toBe(80);
      expect(technocrat.psychology.decisionStyle).toBe('Analytical');
    });

    it('returns a fresh copy — mutating it does not affect config', () => {
      const first = engine.getArchetypePreset('Hawk');
      (first.psychology as { riskTolerance: number }).riskTolerance = 999;

      const second = engine.getArchetypePreset('Hawk');
      expect(second.psychology.riskTolerance).toBe(80);
    });
  });

  // -----------------------------------------------------------------------
  // applyCustomization
  // -----------------------------------------------------------------------

  describe('applyCustomization', () => {
    it('with archetype only — replaces full psychology from preset', () => {
      const leader = makeMockLeader();
      const customization: LeaderCustomization = {
        archetype: 'Hawk',
        personalVulnerability: 'HealthRisk',
      };

      const result = engine.applyCustomization(leader, customization);

      expect(result.psychology.riskTolerance).toBe(80);
      expect(result.psychology.stressResponse).toBe('Escalate');
      expect(result.psychology.paranoia).toBe(60);
      expect(result.psychology.narcissism).toBe(55);
      expect(result.psychology.pragmatism).toBe(40);
      expect(result.psychology.patience).toBe(25);
      expect(result.psychology.vengefulIndex).toBe(75);
    });

    it('with archetype + psychologyOverrides — overrides on top of archetype', () => {
      const leader = makeMockLeader();
      const customization: LeaderCustomization = {
        archetype: 'Dove',
        psychologyOverrides: { riskTolerance: 60, patience: 40 },
        personalVulnerability: 'HealthRisk',
      };

      const result = engine.applyCustomization(leader, customization);

      // Overridden values
      expect(result.psychology.riskTolerance).toBe(60);
      expect(result.psychology.patience).toBe(40);
      // Non-overridden Dove values
      expect(result.psychology.pragmatism).toBe(75);
      expect(result.psychology.paranoia).toBe(30);
    });

    it('applies identity overrides (name, title, age, ideology)', () => {
      const leader = makeMockLeader();
      const customization: LeaderCustomization = {
        name: 'Custom Name',
        title: 'Supreme Leader',
        age: 72,
        ideology: 'Nationalist',
        personalVulnerability: 'ScandalExposure',
      };

      const result = engine.applyCustomization(leader, customization);

      expect(result.identity.name).toBe('Custom Name');
      expect(result.identity.title).toBe('Supreme Leader');
      expect(result.identity.age).toBe(72);
      expect(result.identity.ideology).toBe('Nationalist');
    });

    it('applies motivation overrides (primaryGoal, redLines)', () => {
      const leader = makeMockLeader();
      const customization: LeaderCustomization = {
        primaryGoal: 'World Domination',
        redLines: ['Nuclear Use', 'Regime Change'],
        personalVulnerability: 'SuccessionGap',
      };

      const result = engine.applyCustomization(leader, customization);

      expect(result.motivations.primaryGoal).toBe('World Domination');
      expect(result.motivations.redLines).toEqual(['Nuclear Use', 'Regime Change']);
    });

    it('preserves original leader id, historicalAnalog, powerBase, vulnerabilities', () => {
      const leader = makeMockLeader();
      const customization: LeaderCustomization = {
        archetype: 'Populist',
        name: 'New Name',
        personalVulnerability: 'HealthRisk',
      };

      const result = engine.applyCustomization(leader, customization);

      expect(result.id).toBe(leader.id);
      expect(result.historicalAnalog).toBe('Test Analog');
      expect(result.powerBase.military).toBe(50);
      expect(result.powerBase.oligarchs).toBe(50);
      expect(result.vulnerabilities.healthRisk).toBe(10);
      expect(result.vulnerabilities.coupRisk).toBe(15);
    });

    it('does NOT mutate the default leader', () => {
      const leader = makeMockLeader();
      const originalPsychology = { ...leader.psychology };
      const originalName = leader.identity.name;

      const customization: LeaderCustomization = {
        archetype: 'Hawk',
        name: 'Mutated Name',
        psychologyOverrides: { riskTolerance: 99 },
        personalVulnerability: 'HealthRisk',
      };

      engine.applyCustomization(leader, customization);

      expect(leader.identity.name).toBe(originalName);
      expect(leader.psychology.riskTolerance).toBe(originalPsychology.riskTolerance);
      expect(leader.psychology.stressResponse).toBe(originalPsychology.stressResponse);
    });

    it('clamps psychology values above 100 to 100', () => {
      const leader = makeMockLeader();
      const customization: LeaderCustomization = {
        psychologyOverrides: { riskTolerance: 150, paranoia: 200 },
        personalVulnerability: 'HealthRisk',
      };

      const result = engine.applyCustomization(leader, customization);

      expect(result.psychology.riskTolerance).toBe(100);
      expect(result.psychology.paranoia).toBe(100);
    });

    it('clamps psychology values below 0 to 0', () => {
      const leader = makeMockLeader();
      const customization: LeaderCustomization = {
        psychologyOverrides: { patience: -20, vengefulIndex: -50 },
        personalVulnerability: 'HealthRisk',
      };

      const result = engine.applyCustomization(leader, customization);

      expect(result.psychology.patience).toBe(0);
      expect(result.psychology.vengefulIndex).toBe(0);
    });

    it('without archetype — keeps default psychology + applies overrides', () => {
      const leader = makeMockLeader();
      const customization: LeaderCustomization = {
        psychologyOverrides: { riskTolerance: 75, pragmatism: 90 },
        personalVulnerability: 'HealthRisk',
      };

      const result = engine.applyCustomization(leader, customization);

      // Overridden values
      expect(result.psychology.riskTolerance).toBe(75);
      expect(result.psychology.pragmatism).toBe(90);
      // Default values preserved
      expect(result.psychology.decisionStyle).toBe(DecisionStyle.Analytical);
      expect(result.psychology.stressResponse).toBe(StressResponse.Consolidate);
      expect(result.psychology.paranoia).toBe(50);
      expect(result.psychology.patience).toBe(50);
    });
  });

  // -----------------------------------------------------------------------
  // validateLeaderProfile
  // -----------------------------------------------------------------------

  describe('validateLeaderProfile', () => {
    it('valid profile returns { valid: true, errors: [] }', () => {
      const leader = makeMockLeader();
      const result = engine.validateLeaderProfile(leader);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('empty name returns error', () => {
      const leader = makeMockLeader({
        identity: {
          name: '',
          title: 'President',
          nation: FactionId.US as FactionIdType,
          age: 55,
          ideology: 'Centrist',
        },
      });

      const result = engine.validateLeaderProfile(leader);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.toLowerCase().includes('name'))).toBe(true);
    });

    it('whitespace-only name returns error', () => {
      const leader = makeMockLeader({
        identity: {
          name: '   ',
          title: 'President',
          nation: FactionId.US as FactionIdType,
          age: 55,
          ideology: 'Centrist',
        },
      });

      const result = engine.validateLeaderProfile(leader);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.toLowerCase().includes('name'))).toBe(true);
    });

    it('redLines exceeding maxCustomRedLines returns error', () => {
      const leader = makeMockLeader({
        motivations: {
          primaryGoal: 'Goal',
          ideologicalCore: 'Core',
          redLines: ['Line 1', 'Line 2', 'Line 3', 'Line 4'],
          legacyAmbition: 'Legacy',
        },
      });

      const result = engine.validateLeaderProfile(leader);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.toLowerCase().includes('red line'))).toBe(true);
    });

    it('psychology value > 100 returns error', () => {
      const leader = makeMockLeader({
        psychology: {
          decisionStyle: DecisionStyle.Analytical,
          stressResponse: StressResponse.Consolidate,
          riskTolerance: 110,
          paranoia: 50,
          narcissism: 50,
          pragmatism: 50,
          patience: 50,
          vengefulIndex: 50,
        },
      });

      const result = engine.validateLeaderProfile(leader);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('riskTolerance'))).toBe(true);
    });

    it('psychology value < 0 returns error', () => {
      const leader = makeMockLeader({
        psychology: {
          decisionStyle: DecisionStyle.Analytical,
          stressResponse: StressResponse.Consolidate,
          riskTolerance: 50,
          paranoia: -10,
          narcissism: 50,
          pragmatism: 50,
          patience: 50,
          vengefulIndex: 50,
        },
      });

      const result = engine.validateLeaderProfile(leader);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('paranoia'))).toBe(true);
    });

    it('powerBase value > 100 returns error', () => {
      const leader = makeMockLeader({
        powerBase: {
          military: 150,
          oligarchs: 50,
          party: 50,
          clergy: 50,
          public: 50,
          securityServices: 50,
        },
      });

      const result = engine.validateLeaderProfile(leader);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('military'))).toBe(true);
    });

    it('accumulates multiple errors', () => {
      const leader = makeMockLeader({
        identity: {
          name: '',
          title: 'President',
          nation: FactionId.US as FactionIdType,
          age: 55,
          ideology: 'Centrist',
        },
        psychology: {
          decisionStyle: DecisionStyle.Analytical,
          stressResponse: StressResponse.Consolidate,
          riskTolerance: 110,
          paranoia: -5,
          narcissism: 50,
          pragmatism: 50,
          patience: 50,
          vengefulIndex: 50,
        },
        motivations: {
          primaryGoal: 'Goal',
          ideologicalCore: 'Core',
          redLines: ['A', 'B', 'C', 'D'],
          legacyAmbition: 'Legacy',
        },
      });

      const result = engine.validateLeaderProfile(leader);

      expect(result.valid).toBe(false);
      // At least: riskTolerance OOB, paranoia OOB, empty name, redLines exceeded
      expect(result.errors.length).toBeGreaterThanOrEqual(4);
    });
  });

  // -----------------------------------------------------------------------
  // assessProfileConsistency
  // -----------------------------------------------------------------------

  describe('assessProfileConsistency', () => {
    it('military — aligned with high riskTolerance (>50)', () => {
      const psychology: LeaderPsychology = {
        decisionStyle: DecisionStyle.Analytical,
        stressResponse: StressResponse.Consolidate,
        riskTolerance: 70,
        paranoia: 30,
        narcissism: 30,
        pragmatism: 30,
        patience: 30,
        vengefulIndex: 30,
      };

      const result = engine.assessProfileConsistency(psychology, 'military');

      expect(result.aligned).toBe(true);
      expect(result.deviationScore).toBe(0);
      expect(result.affectedDimensions).toEqual([]);
      expect(result.popularityPenalty).toBe(0);
    });

    it('military — aligned with Escalate stressResponse even if low riskTolerance', () => {
      const psychology: LeaderPsychology = {
        decisionStyle: DecisionStyle.Analytical,
        stressResponse: StressResponse.Escalate,
        riskTolerance: 20,
        paranoia: 30,
        narcissism: 30,
        pragmatism: 30,
        patience: 30,
        vengefulIndex: 30,
      };

      const result = engine.assessProfileConsistency(psychology, 'military');

      expect(result.aligned).toBe(true);
      expect(result.popularityPenalty).toBe(0);
    });

    it('military — misaligned with low riskTolerance and non-Escalate', () => {
      const psychology: LeaderPsychology = {
        decisionStyle: DecisionStyle.Analytical,
        stressResponse: StressResponse.Consolidate,
        riskTolerance: 30,
        paranoia: 30,
        narcissism: 30,
        pragmatism: 30,
        patience: 30,
        vengefulIndex: 30,
      };

      const result = engine.assessProfileConsistency(psychology, 'military');

      expect(result.aligned).toBe(false);
      expect(result.deviationScore).toBeGreaterThan(0);
      expect(result.affectedDimensions.length).toBeGreaterThan(0);
      expect(result.popularityPenalty).toBe(config.consistency.popularityPenalty);
    });

    it('diplomatic — aligned with high pragmatism (>50)', () => {
      const psychology: LeaderPsychology = {
        decisionStyle: DecisionStyle.Analytical,
        stressResponse: StressResponse.Consolidate,
        riskTolerance: 30,
        paranoia: 30,
        narcissism: 30,
        pragmatism: 70,
        patience: 20,
        vengefulIndex: 30,
      };

      const result = engine.assessProfileConsistency(psychology, 'diplomatic');

      expect(result.aligned).toBe(true);
      expect(result.popularityPenalty).toBe(0);
    });

    it('diplomatic — aligned with high patience (>50)', () => {
      const psychology: LeaderPsychology = {
        decisionStyle: DecisionStyle.Analytical,
        stressResponse: StressResponse.Consolidate,
        riskTolerance: 30,
        paranoia: 30,
        narcissism: 30,
        pragmatism: 20,
        patience: 70,
        vengefulIndex: 30,
      };

      const result = engine.assessProfileConsistency(psychology, 'diplomatic');

      expect(result.aligned).toBe(true);
      expect(result.popularityPenalty).toBe(0);
    });

    it('diplomatic — misaligned with low pragmatism AND low patience', () => {
      const psychology: LeaderPsychology = {
        decisionStyle: DecisionStyle.Analytical,
        stressResponse: StressResponse.Consolidate,
        riskTolerance: 30,
        paranoia: 30,
        narcissism: 30,
        pragmatism: 20,
        patience: 20,
        vengefulIndex: 30,
      };

      const result = engine.assessProfileConsistency(psychology, 'diplomatic');

      expect(result.aligned).toBe(false);
      expect(result.deviationScore).toBeGreaterThan(0);
      expect(result.affectedDimensions).toContain('pragmatism');
      expect(result.affectedDimensions).toContain('patience');
      expect(result.popularityPenalty).toBe(config.consistency.popularityPenalty);
    });

    it('economic — always aligned', () => {
      const psychology: LeaderPsychology = {
        decisionStyle: DecisionStyle.Analytical,
        stressResponse: StressResponse.Consolidate,
        riskTolerance: 10,
        paranoia: 10,
        narcissism: 10,
        pragmatism: 10,
        patience: 10,
        vengefulIndex: 10,
      };

      const result = engine.assessProfileConsistency(psychology, 'economic');

      expect(result.aligned).toBe(true);
      expect(result.deviationScore).toBe(0);
      expect(result.affectedDimensions).toEqual([]);
      expect(result.popularityPenalty).toBe(0);
    });

    it('covert — aligned with high paranoia (>40)', () => {
      const psychology: LeaderPsychology = {
        decisionStyle: DecisionStyle.Analytical,
        stressResponse: StressResponse.Consolidate,
        riskTolerance: 30,
        paranoia: 60,
        narcissism: 30,
        pragmatism: 30,
        patience: 30,
        vengefulIndex: 30,
      };

      const result = engine.assessProfileConsistency(psychology, 'covert');

      expect(result.aligned).toBe(true);
      expect(result.popularityPenalty).toBe(0);
    });

    it('covert — misaligned with low paranoia AND low pragmatism', () => {
      const psychology: LeaderPsychology = {
        decisionStyle: DecisionStyle.Analytical,
        stressResponse: StressResponse.Consolidate,
        riskTolerance: 30,
        paranoia: 20,
        narcissism: 30,
        pragmatism: 30,
        patience: 30,
        vengefulIndex: 30,
      };

      const result = engine.assessProfileConsistency(psychology, 'covert');

      expect(result.aligned).toBe(false);
      expect(result.affectedDimensions).toContain('paranoia');
      expect(result.affectedDimensions).toContain('pragmatism');
      expect(result.popularityPenalty).toBe(config.consistency.popularityPenalty);
    });

    it('domestic — aligned with low narcissism (<50)', () => {
      const psychology: LeaderPsychology = {
        decisionStyle: DecisionStyle.Analytical,
        stressResponse: StressResponse.Consolidate,
        riskTolerance: 30,
        paranoia: 30,
        narcissism: 30,
        pragmatism: 30,
        patience: 30,
        vengefulIndex: 30,
      };

      const result = engine.assessProfileConsistency(psychology, 'domestic');

      expect(result.aligned).toBe(true);
      expect(result.popularityPenalty).toBe(0);
    });

    it('domestic — misaligned with high narcissism AND low pragmatism', () => {
      const psychology: LeaderPsychology = {
        decisionStyle: DecisionStyle.Analytical,
        stressResponse: StressResponse.Consolidate,
        riskTolerance: 30,
        paranoia: 30,
        narcissism: 80,
        pragmatism: 30,
        patience: 30,
        vengefulIndex: 30,
      };

      const result = engine.assessProfileConsistency(psychology, 'domestic');

      expect(result.aligned).toBe(false);
      expect(result.affectedDimensions).toContain('narcissism');
      expect(result.affectedDimensions).toContain('pragmatism');
      expect(result.popularityPenalty).toBe(config.consistency.popularityPenalty);
    });

    it('unknown category — treated as aligned', () => {
      const psychology: LeaderPsychology = {
        decisionStyle: DecisionStyle.Analytical,
        stressResponse: StressResponse.Consolidate,
        riskTolerance: 10,
        paranoia: 10,
        narcissism: 90,
        pragmatism: 10,
        patience: 10,
        vengefulIndex: 10,
      };

      const result = engine.assessProfileConsistency(psychology, 'something_unknown');

      expect(result.aligned).toBe(true);
      expect(result.deviationScore).toBe(0);
      expect(result.affectedDimensions).toEqual([]);
      expect(result.popularityPenalty).toBe(0);
    });

    it('misaligned returns non-zero deviationScore and affectedDimensions', () => {
      const psychology: LeaderPsychology = {
        decisionStyle: DecisionStyle.Analytical,
        stressResponse: StressResponse.Consolidate,
        riskTolerance: 10,
        paranoia: 30,
        narcissism: 30,
        pragmatism: 30,
        patience: 30,
        vengefulIndex: 30,
      };

      const result = engine.assessProfileConsistency(psychology, 'military');

      expect(result.aligned).toBe(false);
      expect(result.deviationScore).toBeGreaterThan(0);
      expect(result.affectedDimensions.length).toBeGreaterThan(0);
    });

    it('misaligned returns popularityPenalty equal to config.consistency.popularityPenalty', () => {
      const psychology: LeaderPsychology = {
        decisionStyle: DecisionStyle.Analytical,
        stressResponse: StressResponse.Consolidate,
        riskTolerance: 10,
        paranoia: 10,
        narcissism: 90,
        pragmatism: 10,
        patience: 10,
        vengefulIndex: 10,
      };

      const result = engine.assessProfileConsistency(psychology, 'domestic');

      expect(result.aligned).toBe(false);
      expect(result.popularityPenalty).toBe(config.consistency.popularityPenalty);
      expect(result.popularityPenalty).toBe(-5);
    });
  });

  // -----------------------------------------------------------------------
  // getVulnerabilityOptions
  // -----------------------------------------------------------------------

  describe('getVulnerabilityOptions', () => {
    it('returns 4 options', () => {
      const options = engine.getVulnerabilityOptions();
      expect(options).toHaveLength(4);
    });

    it('keys are HealthRisk, ScandalExposure, SuccessionGap, IdeologicalRigidity', () => {
      const options = engine.getVulnerabilityOptions();
      const keys = options.map((o) => o.key);
      expect(keys).toEqual([
        'HealthRisk',
        'ScandalExposure',
        'SuccessionGap',
        'IdeologicalRigidity',
      ]);
    });

    it('each option has label and description strings', () => {
      const options = engine.getVulnerabilityOptions();
      for (const option of options) {
        expect(typeof option.label).toBe('string');
        expect(option.label.length).toBeGreaterThan(0);
        expect(typeof option.description).toBe('string');
        expect(option.description.length).toBeGreaterThan(0);
      }
    });
  });
});
