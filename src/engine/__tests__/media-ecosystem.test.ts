import { describe, it, expect, beforeEach } from 'vitest';
import {
  MediaEcosystemEngine,
} from '@/engine/media-ecosystem';
import type {
  PropagandaResult,
  ViralityEventInput,
  EcosystemVulnerability,
} from '@/engine/media-ecosystem';
import type {
  FactionId,
  MediaEcosystemConfig,
  ViralityEvent,
} from '@/data/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFactionId(id: string): FactionId {
  return id as FactionId;
}

function makeEcosystem(
  overrides: Partial<MediaEcosystemConfig> = {},
): MediaEcosystemConfig {
  return {
    factionId: makeFactionId('us'),
    type: 'FreePress',
    viralityMultiplier: 1.5,
    censorshipEffectiveness: 5,
    propagandaResistance: 70,
    narrativeControlScore: 20,
    ...overrides,
  };
}

function makeViralityEvent(
  overrides: Partial<ViralityEvent> = {},
): ViralityEvent {
  return {
    source: makeFactionId('us'),
    content: 'Test event',
    virality: 60,
    spreadMap: {},
    counterNarrativeActive: false,
    turnsToDecay: 3,
    ...overrides,
  };
}

function makeViralityInput(
  overrides: Partial<ViralityEventInput> = {},
): ViralityEventInput {
  return {
    baseVirality: 40,
    hasViolence: false,
    hasScandal: false,
    hasTriumph: false,
    platformPenetration: 80,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MediaEcosystemEngine', () => {
  let engine: MediaEcosystemEngine;

  beforeEach(() => {
    engine = new MediaEcosystemEngine();
  });

  // -----------------------------------------------------------------------
  // getDefaultConfig
  // -----------------------------------------------------------------------
  describe('getDefaultConfig', () => {
    it('returns FreePress config with viralityMultiplier ~1.5', () => {
      const cfg = engine.getDefaultConfig(makeFactionId('us'), 'FreePress');
      expect(cfg.viralityMultiplier).toBe(1.5);
    });

    it('returns StateMedia config with viralityMultiplier ~0.6', () => {
      const cfg = engine.getDefaultConfig(makeFactionId('russia'), 'StateMedia');
      expect(cfg.viralityMultiplier).toBe(0.6);
    });

    it('returns ClosedSystem config with viralityMultiplier ~0.2', () => {
      const cfg = engine.getDefaultConfig(makeFactionId('dprk'), 'ClosedSystem');
      expect(cfg.viralityMultiplier).toBe(0.2);
    });

    it('returns Fragmented config with viralityMultiplier ~1.2', () => {
      const cfg = engine.getDefaultConfig(makeFactionId('iran'), 'Fragmented');
      expect(cfg.viralityMultiplier).toBe(1.2);
    });

    it('sets the correct factionId on the returned config', () => {
      const cfg = engine.getDefaultConfig(makeFactionId('japan'), 'FreePress');
      expect(cfg.factionId).toBe('japan');
    });

    it('sets the correct type on the returned config', () => {
      const cfg = engine.getDefaultConfig(makeFactionId('us'), 'FreePress');
      expect(cfg.type).toBe('FreePress');
    });

    it('FreePress has low censorshipEffectiveness (5)', () => {
      const cfg = engine.getDefaultConfig(makeFactionId('us'), 'FreePress');
      expect(cfg.censorshipEffectiveness).toBe(5);
    });

    it('StateMedia has high censorshipEffectiveness (70)', () => {
      const cfg = engine.getDefaultConfig(makeFactionId('russia'), 'StateMedia');
      expect(cfg.censorshipEffectiveness).toBe(70);
    });

    it('ClosedSystem has very high censorshipEffectiveness (95)', () => {
      const cfg = engine.getDefaultConfig(makeFactionId('dprk'), 'ClosedSystem');
      expect(cfg.censorshipEffectiveness).toBe(95);
    });
  });

  // -----------------------------------------------------------------------
  // computeEffectiveVirality
  // -----------------------------------------------------------------------
  describe('computeEffectiveVirality', () => {
    it('FreePress amplifies virality (multiplier 1.5)', () => {
      const eco = makeEcosystem({ viralityMultiplier: 1.5 });
      const result = engine.computeEffectiveVirality(60, eco);
      expect(result).toBe(90); // 60 * 1.5
    });

    it('ClosedSystem reduces virality heavily (multiplier 0.2)', () => {
      const eco = makeEcosystem({ viralityMultiplier: 0.2 });
      const result = engine.computeEffectiveVirality(60, eco);
      expect(result).toBeCloseTo(12); // 60 * 0.2
    });

    it('StateMedia moderately reduces virality (multiplier 0.6)', () => {
      const eco = makeEcosystem({ viralityMultiplier: 0.6 });
      const result = engine.computeEffectiveVirality(60, eco);
      expect(result).toBeCloseTo(36); // 60 * 0.6
    });

    it('clamps result to maximum 100', () => {
      const eco = makeEcosystem({ viralityMultiplier: 1.5 });
      const result = engine.computeEffectiveVirality(80, eco);
      expect(result).toBe(100); // 80 * 1.5 = 120 → clamped to 100
    });

    it('clamps result to minimum 0', () => {
      const eco = makeEcosystem({ viralityMultiplier: 1.5 });
      const result = engine.computeEffectiveVirality(-10, eco);
      expect(result).toBe(0);
    });

    it('handles zero base virality', () => {
      const eco = makeEcosystem({ viralityMultiplier: 1.5 });
      const result = engine.computeEffectiveVirality(0, eco);
      expect(result).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // applyCensorship
  // -----------------------------------------------------------------------
  describe('applyCensorship', () => {
    it('FreePress barely censors (5%)', () => {
      const eco = makeEcosystem({ censorshipEffectiveness: 5 });
      const result = engine.applyCensorship(80, eco);
      expect(result).toBeCloseTo(76); // 80 * 0.95
    });

    it('StateMedia censors significantly (70%)', () => {
      const eco = makeEcosystem({ censorshipEffectiveness: 70 });
      const result = engine.applyCensorship(80, eco);
      expect(result).toBeCloseTo(24); // 80 * 0.30
    });

    it('ClosedSystem censors almost all (95%)', () => {
      const eco = makeEcosystem({ censorshipEffectiveness: 95 });
      const result = engine.applyCensorship(80, eco);
      expect(result).toBeCloseTo(4); // 80 * 0.05
    });

    it('Fragmented censors moderately (30%)', () => {
      const eco = makeEcosystem({ censorshipEffectiveness: 30 });
      const result = engine.applyCensorship(80, eco);
      expect(result).toBeCloseTo(56); // 80 * 0.70
    });

    it('result is clamped to 0-100', () => {
      const eco = makeEcosystem({ censorshipEffectiveness: 5 });
      const result = engine.applyCensorship(100, eco);
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
    });

    it('handles zero virality', () => {
      const eco = makeEcosystem({ censorshipEffectiveness: 70 });
      const result = engine.applyCensorship(0, eco);
      expect(result).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // computePropagandaEffectiveness
  // -----------------------------------------------------------------------
  describe('computePropagandaEffectiveness', () => {
    it('FreePress: low domestic effectiveness, high international credibility', () => {
      const eco = makeEcosystem({
        type: 'FreePress',
        propagandaResistance: 70,
      });
      const result = engine.computePropagandaEffectiveness(70, eco);
      // domestic = 70 * (1 - 0.70) = 21
      expect(result.domesticEffectiveness).toBeCloseTo(21);
      // international = 21 * 1.2 = 25.2
      expect(result.internationalCredibility).toBeCloseTo(25.2);
    });

    it('StateMedia: high domestic effectiveness, low international credibility', () => {
      const eco = makeEcosystem({
        type: 'StateMedia',
        propagandaResistance: 30,
      });
      const result = engine.computePropagandaEffectiveness(70, eco);
      // domestic = 70 * (1 - 0.30) = 49
      expect(result.domesticEffectiveness).toBeCloseTo(49);
      // international = 49 * 0.3 = 14.7
      expect(result.internationalCredibility).toBeCloseTo(14.7);
    });

    it('returns netEffect as weighted average (0.6 domestic + 0.4 international)', () => {
      const eco = makeEcosystem({
        type: 'StateMedia',
        propagandaResistance: 30,
      });
      const result = engine.computePropagandaEffectiveness(70, eco);
      const expectedNet = 0.6 * result.domesticEffectiveness + 0.4 * result.internationalCredibility;
      expect(result.netEffect).toBeCloseTo(expectedNet);
    });

    it('handles zero base propaganda', () => {
      const eco = makeEcosystem({ propagandaResistance: 70 });
      const result = engine.computePropagandaEffectiveness(0, eco);
      expect(result.domesticEffectiveness).toBe(0);
      expect(result.internationalCredibility).toBe(0);
      expect(result.netEffect).toBe(0);
    });

    it('ClosedSystem: nearly invisible externally (0.15 multiplier)', () => {
      const eco = makeEcosystem({
        type: 'ClosedSystem',
        propagandaResistance: 15,
      });
      const result = engine.computePropagandaEffectiveness(80, eco);
      // domestic = 80 * 0.85 = 68
      expect(result.domesticEffectiveness).toBeCloseTo(68);
      // international = 68 * 0.15 = 10.2
      expect(result.internationalCredibility).toBeCloseTo(10.2);
    });

    it('all fields are in 0-100 range', () => {
      const eco = makeEcosystem({ type: 'FreePress', propagandaResistance: 10 });
      const result: PropagandaResult = engine.computePropagandaEffectiveness(95, eco);
      expect(result.domesticEffectiveness).toBeGreaterThanOrEqual(0);
      expect(result.domesticEffectiveness).toBeLessThanOrEqual(100);
      expect(result.internationalCredibility).toBeGreaterThanOrEqual(0);
      expect(result.internationalCredibility).toBeLessThanOrEqual(100);
      expect(result.netEffect).toBeGreaterThanOrEqual(0);
      expect(result.netEffect).toBeLessThanOrEqual(100);
    });
  });

  // -----------------------------------------------------------------------
  // computeViralityScore
  // -----------------------------------------------------------------------
  describe('computeViralityScore', () => {
    it('adds violence bonus (+20)', () => {
      const withViolence = engine.computeViralityScore(
        makeViralityInput({ baseVirality: 40, hasViolence: true, platformPenetration: 100 }),
      );
      const without = engine.computeViralityScore(
        makeViralityInput({ baseVirality: 40, hasViolence: false, platformPenetration: 100 }),
      );
      expect(withViolence - without).toBeCloseTo(20);
    });

    it('adds scandal bonus (+15)', () => {
      const withScandal = engine.computeViralityScore(
        makeViralityInput({ baseVirality: 40, hasScandal: true, platformPenetration: 100 }),
      );
      const without = engine.computeViralityScore(
        makeViralityInput({ baseVirality: 40, hasScandal: false, platformPenetration: 100 }),
      );
      expect(withScandal - without).toBeCloseTo(15);
    });

    it('adds triumph bonus (+10)', () => {
      const withTriumph = engine.computeViralityScore(
        makeViralityInput({ baseVirality: 40, hasTriumph: true, platformPenetration: 100 }),
      );
      const without = engine.computeViralityScore(
        makeViralityInput({ baseVirality: 40, hasTriumph: false, platformPenetration: 100 }),
      );
      expect(withTriumph - without).toBeCloseTo(10);
    });

    it('combines multiple bonuses', () => {
      const result = engine.computeViralityScore(
        makeViralityInput({
          baseVirality: 20,
          hasViolence: true,
          hasScandal: true,
          hasTriumph: true,
          platformPenetration: 100,
        }),
      );
      // 20 + 20 + 15 + 10 = 65 at 100% penetration
      expect(result).toBeCloseTo(65);
    });

    it('scales by platform penetration', () => {
      const full = engine.computeViralityScore(
        makeViralityInput({ baseVirality: 50, platformPenetration: 100 }),
      );
      const half = engine.computeViralityScore(
        makeViralityInput({ baseVirality: 50, platformPenetration: 50 }),
      );
      expect(half).toBeCloseTo(full / 2);
    });

    it('clamps to 0-100', () => {
      const result = engine.computeViralityScore(
        makeViralityInput({
          baseVirality: 80,
          hasViolence: true,
          hasScandal: true,
          hasTriumph: true,
          platformPenetration: 100,
        }),
      );
      // 80 + 20 + 15 + 10 = 125 → clamped to 100
      expect(result).toBe(100);
    });

    it('handles no bonuses', () => {
      const result = engine.computeViralityScore(
        makeViralityInput({ baseVirality: 50, platformPenetration: 100 }),
      );
      expect(result).toBe(50);
    });

    it('returns 0 when platform penetration is 0', () => {
      const result = engine.computeViralityScore(
        makeViralityInput({
          baseVirality: 80,
          hasViolence: true,
          platformPenetration: 0,
        }),
      );
      expect(result).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // applyCounterNarrative
  // -----------------------------------------------------------------------
  describe('applyCounterNarrative', () => {
    it('halves virality when counter-narrative is active', () => {
      const event = makeViralityEvent({
        virality: 80,
        counterNarrativeActive: true,
      });
      const result = engine.applyCounterNarrative(event);
      expect(result.virality).toBe(40);
    });

    it('leaves virality unchanged when counter-narrative is not active', () => {
      const event = makeViralityEvent({
        virality: 80,
        counterNarrativeActive: false,
      });
      const result = engine.applyCounterNarrative(event);
      expect(result.virality).toBe(80);
    });

    it('returns the same reference when no counter-narrative is active', () => {
      const event = makeViralityEvent({ counterNarrativeActive: false });
      const result = engine.applyCounterNarrative(event);
      expect(result).toBe(event);
    });

    it('returns a new object when counter-narrative is active', () => {
      const event = makeViralityEvent({ counterNarrativeActive: true });
      const result = engine.applyCounterNarrative(event);
      expect(result).not.toBe(event);
    });

    it('clamps halved virality to 0', () => {
      const event = makeViralityEvent({
        virality: 0,
        counterNarrativeActive: true,
      });
      const result = engine.applyCounterNarrative(event);
      expect(result.virality).toBe(0);
    });
  });

  // -----------------------------------------------------------------------
  // propagateEvent
  // -----------------------------------------------------------------------
  describe('propagateEvent', () => {
    it('spreads to FreePress nations with high penetration', () => {
      const eco = makeEcosystem({
        factionId: makeFactionId('us'),
        type: 'FreePress',
        viralityMultiplier: 1.5,
        censorshipEffectiveness: 5,
      });
      const ecosystems = new Map<FactionId, MediaEcosystemConfig>([
        [makeFactionId('us'), eco],
      ]);
      const event = makeViralityEvent({ virality: 60 });
      const result = engine.propagateEvent(event, ecosystems);
      // 60 * 1.5 * 0.95 = 85.5
      expect(result.spreadMap['us' as FactionId]).toBeCloseTo(85.5);
    });

    it('barely penetrates ClosedSystem nations', () => {
      const eco = makeEcosystem({
        factionId: makeFactionId('dprk'),
        type: 'ClosedSystem',
        viralityMultiplier: 0.2,
        censorshipEffectiveness: 95,
      });
      const ecosystems = new Map<FactionId, MediaEcosystemConfig>([
        [makeFactionId('dprk'), eco],
      ]);
      const event = makeViralityEvent({ virality: 60 });
      const result = engine.propagateEvent(event, ecosystems);
      // 60 * 0.2 * 0.05 = 0.6
      expect(result.spreadMap['dprk' as FactionId]).toBeCloseTo(0.6);
    });

    it('updates spreadMap for all provided ecosystems', () => {
      const freePress = makeEcosystem({
        factionId: makeFactionId('us'),
        type: 'FreePress',
        viralityMultiplier: 1.5,
        censorshipEffectiveness: 5,
      });
      const closedSystem = makeEcosystem({
        factionId: makeFactionId('dprk'),
        type: 'ClosedSystem',
        viralityMultiplier: 0.2,
        censorshipEffectiveness: 95,
      });
      const ecosystems = new Map<FactionId, MediaEcosystemConfig>([
        [makeFactionId('us'), freePress],
        [makeFactionId('dprk'), closedSystem],
      ]);
      const event = makeViralityEvent({ virality: 60 });
      const result = engine.propagateEvent(event, ecosystems);
      expect(result.spreadMap['us' as FactionId]).toBeDefined();
      expect(result.spreadMap['dprk' as FactionId]).toBeDefined();
    });

    it('all spreadMap values are clamped to 0-100', () => {
      const eco = makeEcosystem({
        factionId: makeFactionId('us'),
        viralityMultiplier: 1.5,
        censorshipEffectiveness: 5,
      });
      const ecosystems = new Map<FactionId, MediaEcosystemConfig>([
        [makeFactionId('us'), eco],
      ]);
      const event = makeViralityEvent({ virality: 100 });
      const result = engine.propagateEvent(event, ecosystems);
      const usSpread = result.spreadMap['us' as FactionId];
      expect(usSpread).toBeDefined();
      expect(usSpread).toBeGreaterThanOrEqual(0);
      expect(usSpread).toBeLessThanOrEqual(100);
    });

    it('returns a new event object', () => {
      const eco = makeEcosystem({ factionId: makeFactionId('us') });
      const ecosystems = new Map<FactionId, MediaEcosystemConfig>([
        [makeFactionId('us'), eco],
      ]);
      const event = makeViralityEvent();
      const result = engine.propagateEvent(event, ecosystems);
      expect(result).not.toBe(event);
    });
  });

  // -----------------------------------------------------------------------
  // decayEvent
  // -----------------------------------------------------------------------
  describe('decayEvent', () => {
    it('reduces virality by 20% per turn', () => {
      const event = makeViralityEvent({ virality: 80, turnsToDecay: 3 });
      const result = engine.decayEvent(event);
      expect(result).not.toBeNull();
      expect(result!.virality).toBeCloseTo(64); // 80 * 0.8
    });

    it('decrements turnsToDecay by 1', () => {
      const event = makeViralityEvent({ virality: 80, turnsToDecay: 3 });
      const result = engine.decayEvent(event);
      expect(result).not.toBeNull();
      expect(result!.turnsToDecay).toBe(2);
    });

    it('returns null when expired (turnsToDecay reaches 0)', () => {
      const event = makeViralityEvent({ virality: 50, turnsToDecay: 1 });
      const result = engine.decayEvent(event);
      expect(result).toBeNull();
    });

    it('returns null when turnsToDecay is already 0', () => {
      const event = makeViralityEvent({ virality: 50, turnsToDecay: 0 });
      const result = engine.decayEvent(event);
      expect(result).toBeNull();
    });

    it('returns a new event object when not expired', () => {
      const event = makeViralityEvent({ virality: 80, turnsToDecay: 3 });
      const result = engine.decayEvent(event);
      expect(result).not.toBe(event);
    });

    it('chains correctly over multiple decays', () => {
      let event: ViralityEvent | null = makeViralityEvent({
        virality: 100,
        turnsToDecay: 3,
      });
      event = engine.decayEvent(event);
      expect(event).not.toBeNull();
      expect(event!.virality).toBeCloseTo(80); // 100 * 0.8

      event = engine.decayEvent(event!);
      expect(event).not.toBeNull();
      expect(event!.virality).toBeCloseTo(64); // 80 * 0.8

      event = engine.decayEvent(event!);
      expect(event).toBeNull(); // turnsToDecay was 1 → expired
    });
  });

  // -----------------------------------------------------------------------
  // assessEcosystemVulnerability
  // -----------------------------------------------------------------------
  describe('assessEcosystemVulnerability', () => {
    it('FreePress has high external attack vulnerability', () => {
      const eco = makeEcosystem({
        type: 'FreePress',
        viralityMultiplier: 1.5,
        censorshipEffectiveness: 5,
      });
      const result: EcosystemVulnerability = engine.assessEcosystemVulnerability(eco);
      // (100 - 5) * 1.5 = 142.5 → clamped to 100
      expect(result.externalAttackVulnerability).toBe(100);
    });

    it('ClosedSystem has low external attack vulnerability', () => {
      const eco = makeEcosystem({
        type: 'ClosedSystem',
        viralityMultiplier: 0.2,
        censorshipEffectiveness: 95,
      });
      const result = engine.assessEcosystemVulnerability(eco);
      // (100 - 95) * 0.2 = 1
      expect(result.externalAttackVulnerability).toBe(1);
    });

    it('ClosedSystem has low internal stability risk when narrative control is high', () => {
      const eco = makeEcosystem({
        type: 'ClosedSystem',
        narrativeControlScore: 95,
        propagandaResistance: 15,
      });
      const result = engine.assessEcosystemVulnerability(eco);
      // controlGap = 5, resistanceGap = 85, risk = 5 + 85*0.3 = 30.5
      expect(result.internalStabilityRisk).toBeCloseTo(30.5);
    });

    it('FreePress has high internal stability risk', () => {
      const eco = makeEcosystem({
        type: 'FreePress',
        narrativeControlScore: 20,
        propagandaResistance: 70,
      });
      const result = engine.assessEcosystemVulnerability(eco);
      // controlGap = 80, resistanceGap = 30, risk = 80 + 30*0.3 = 89
      expect(result.internalStabilityRisk).toBeCloseTo(89);
    });

    it('returns narrativeControlStrength equal to narrativeControlScore', () => {
      const eco = makeEcosystem({ narrativeControlScore: 45 });
      const result = engine.assessEcosystemVulnerability(eco);
      expect(result.narrativeControlStrength).toBe(45);
    });

    it('returns overallRisk "high" for FreePress default config', () => {
      const eco = engine.getDefaultConfig(makeFactionId('us'), 'FreePress');
      const result = engine.assessEcosystemVulnerability(eco);
      // avg = (100 + 89) / 2 = 94.5 → critical
      expect(result.overallRisk).toBe('critical');
    });

    it('returns overallRisk "low" for ClosedSystem default config', () => {
      const eco = engine.getDefaultConfig(makeFactionId('dprk'), 'ClosedSystem');
      const result = engine.assessEcosystemVulnerability(eco);
      // external = 1, internal = 5 + 85*0.3 = 30.5
      // avg = (1 + 30.5) / 2 = 15.75 → low
      expect(result.overallRisk).toBe('low');
    });

    it('returns overallRisk "medium" for appropriate risk levels', () => {
      const eco = makeEcosystem({
        viralityMultiplier: 0.6,
        censorshipEffectiveness: 50,
        narrativeControlScore: 60,
        propagandaResistance: 50,
      });
      const result = engine.assessEcosystemVulnerability(eco);
      // external = 50 * 0.6 = 30
      // internal = 40 + 50 * 0.3 = 55
      // avg = (30 + 55) / 2 = 42.5 → medium
      expect(result.overallRisk).toBe('medium');
    });

    it('all vulnerability scores are in 0-100 range', () => {
      const eco = makeEcosystem();
      const result = engine.assessEcosystemVulnerability(eco);
      expect(result.externalAttackVulnerability).toBeGreaterThanOrEqual(0);
      expect(result.externalAttackVulnerability).toBeLessThanOrEqual(100);
      expect(result.internalStabilityRisk).toBeGreaterThanOrEqual(0);
      expect(result.internalStabilityRisk).toBeLessThanOrEqual(100);
      expect(result.narrativeControlStrength).toBeGreaterThanOrEqual(0);
      expect(result.narrativeControlStrength).toBeLessThanOrEqual(100);
    });
  });
});
