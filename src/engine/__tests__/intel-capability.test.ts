import { describe, it, expect } from 'vitest';
import {
  IntelligenceCapabilityEngine,
  type IntelCapability,
  type ClarityInput,
  type IntelAssessmentInput,
} from '@/engine/intel-capability';
import { FactionId, IntelSubScore } from '@/data/types';

// ── Aliases ──────────────────────────────────────────────────────────────────
const FID = FactionId;
const ISS = IntelSubScore;

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Shorthand factory — avoids repeating `IntelligenceCapabilityEngine.createCapability`. */
function makeCap(
  factionId: FactionId,
  humint: number,
  sigint: number,
  cyber: number,
  covert: number,
): IntelCapability {
  return IntelligenceCapabilityEngine.createCapability(factionId, humint, sigint, cyber, covert);
}

// ── Engine instance ──────────────────────────────────────────────────────────
const engine = new IntelligenceCapabilityEngine();

// ═══════════════════════════════════════════════════════════════════════════════
// createCapability
// ═══════════════════════════════════════════════════════════════════════════════

describe('createCapability', () => {
  it('creates capability with correct fields', () => {
    const cap = IntelligenceCapabilityEngine.createCapability(FID.US, 70, 60, 50, 40);
    expect(cap).toEqual({
      factionId: FID.US,
      humint: 70,
      sigint: 60,
      cyber: 50,
      covert: 40,
    });
  });

  it('preserves exact field values', () => {
    const cap = IntelligenceCapabilityEngine.createCapability(FID.China, 0, 100, 33, 77);
    expect(cap.factionId).toBe(FID.China);
    expect(cap.humint).toBe(0);
    expect(cap.sigint).toBe(100);
    expect(cap.cyber).toBe(33);
    expect(cap.covert).toBe(77);
  });

  it('creates capabilities for different factions independently', () => {
    const us = makeCap(FID.US, 80, 80, 80, 80);
    const ru = makeCap(FID.Russia, 40, 40, 40, 40);
    expect(us.factionId).toBe(FID.US);
    expect(ru.factionId).toBe(FID.Russia);
    expect(us.humint).not.toBe(ru.humint);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// computeComposite
// ═══════════════════════════════════════════════════════════════════════════════

describe('computeComposite', () => {
  it('computes weighted sum for balanced scores (all 50)', () => {
    // 50×0.3 + 50×0.25 + 50×0.25 + 50×0.2 = 15 + 12.5 + 12.5 + 10 = 50
    const cap = makeCap(FID.US, 50, 50, 50, 50);
    const result = engine.computeComposite(cap);
    expect(result.composite).toBeCloseTo(50, 5);
  });

  it('computes weighted sum for skewed scores (humint=100, rest=0)', () => {
    // 100×0.3 + 0×0.25 + 0×0.25 + 0×0.2 = 30
    const cap = makeCap(FID.US, 100, 0, 0, 0);
    const result = engine.computeComposite(cap);
    expect(result.composite).toBeCloseTo(30, 5);
  });

  it('computes weighted sum for max scores (all 100)', () => {
    // 100×0.3 + 100×0.25 + 100×0.25 + 100×0.2 = 30 + 25 + 25 + 20 = 100
    const cap = makeCap(FID.US, 100, 100, 100, 100);
    const result = engine.computeComposite(cap);
    expect(result.composite).toBeCloseTo(100, 5);
  });

  it('computes weighted sum for all-zero scores', () => {
    const cap = makeCap(FID.EU, 0, 0, 0, 0);
    const result = engine.computeComposite(cap);
    expect(result.composite).toBeCloseTo(0, 5);
  });

  it('computes weighted sum for sigint-only scores', () => {
    // 0×0.3 + 100×0.25 + 0×0.25 + 0×0.2 = 25
    const cap = makeCap(FID.China, 0, 100, 0, 0);
    const result = engine.computeComposite(cap);
    expect(result.composite).toBeCloseTo(25, 5);
  });

  it('computes weighted sum for cyber-only scores', () => {
    // 0×0.3 + 0×0.25 + 100×0.25 + 0×0.2 = 25
    const cap = makeCap(FID.China, 0, 0, 100, 0);
    const result = engine.computeComposite(cap);
    expect(result.composite).toBeCloseTo(25, 5);
  });

  it('computes weighted sum for covert-only scores', () => {
    // 0×0.3 + 0×0.25 + 0×0.25 + 100×0.2 = 20
    const cap = makeCap(FID.Russia, 0, 0, 0, 100);
    const result = engine.computeComposite(cap);
    expect(result.composite).toBeCloseTo(20, 5);
  });

  it('includes per-discipline breakdown', () => {
    const cap = makeCap(FID.US, 80, 60, 40, 20);
    const result = engine.computeComposite(cap);
    // 80×0.3=24, 60×0.25=15, 40×0.25=10, 20×0.2=4
    expect(result.breakdown.humintWeighted).toBeCloseTo(24, 5);
    expect(result.breakdown.sigintWeighted).toBeCloseTo(15, 5);
    expect(result.breakdown.cyberWeighted).toBeCloseTo(10, 5);
    expect(result.breakdown.covertWeighted).toBeCloseTo(4, 5);
    expect(result.composite).toBeCloseTo(24 + 15 + 10 + 4, 5);
  });

  it('returns correct factionId', () => {
    const cap = makeCap(FID.Russia, 50, 50, 50, 50);
    const result = engine.computeComposite(cap);
    expect(result.factionId).toBe(FID.Russia);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// getSubScoreValue
// ═══════════════════════════════════════════════════════════════════════════════

describe('getSubScoreValue', () => {
  const cap = makeCap(FID.US, 70, 60, 50, 40);

  it('returns humint for HUMINT', () => {
    expect(engine.getSubScoreValue(cap, ISS.HUMINT)).toBe(70);
  });

  it('returns sigint for SIGINT', () => {
    expect(engine.getSubScoreValue(cap, ISS.SIGINT)).toBe(60);
  });

  it('returns cyber for CYBER', () => {
    expect(engine.getSubScoreValue(cap, ISS.CYBER)).toBe(50);
  });

  it('returns covert for COVERT', () => {
    expect(engine.getSubScoreValue(cap, ISS.COVERT)).toBe(40);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// findLowestSubScore
// ═══════════════════════════════════════════════════════════════════════════════

describe('findLowestSubScore', () => {
  it('finds the lowest sub-score', () => {
    const cap = makeCap(FID.US, 70, 60, 50, 40);
    const result = engine.findLowestSubScore(cap);
    expect(result.subScore).toBe(ISS.COVERT);
    expect(result.value).toBe(40);
  });

  it('tie-breaks to HUMINT (first in enum order) when all equal', () => {
    const cap = makeCap(FID.China, 50, 50, 50, 50);
    const result = engine.findLowestSubScore(cap);
    expect(result.subScore).toBe(ISS.HUMINT);
    expect(result.value).toBe(50);
  });

  it('identifies unique minimum', () => {
    const cap = makeCap(FID.Russia, 80, 90, 10, 70);
    const result = engine.findLowestSubScore(cap);
    expect(result.subScore).toBe(ISS.CYBER);
    expect(result.value).toBe(10);
  });

  it('tie-breaks correctly when two sub-scores share the minimum', () => {
    // HUMINT and SIGINT are both 20, so HUMINT wins (first in order)
    const cap = makeCap(FID.EU, 20, 20, 50, 60);
    const result = engine.findLowestSubScore(cap);
    expect(result.subScore).toBe(ISS.HUMINT);
    expect(result.value).toBe(20);
  });

  it('tie-breaks to SIGINT when HUMINT is higher but SIGINT/CYBER tie', () => {
    const cap = makeCap(FID.Japan, 50, 10, 10, 30);
    const result = engine.findLowestSubScore(cap);
    expect(result.subScore).toBe(ISS.SIGINT);
    expect(result.value).toBe(10);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// findHighestSubScore
// ═══════════════════════════════════════════════════════════════════════════════

describe('findHighestSubScore', () => {
  it('finds the highest sub-score', () => {
    const cap = makeCap(FID.US, 70, 60, 90, 40);
    const result = engine.findHighestSubScore(cap);
    expect(result.subScore).toBe(ISS.CYBER);
    expect(result.value).toBe(90);
  });

  it('tie-breaks to HUMINT when all equal', () => {
    const cap = makeCap(FID.China, 50, 50, 50, 50);
    const result = engine.findHighestSubScore(cap);
    expect(result.subScore).toBe(ISS.HUMINT);
    expect(result.value).toBe(50);
  });

  it('identifies unique maximum', () => {
    const cap = makeCap(FID.Russia, 30, 40, 50, 100);
    const result = engine.findHighestSubScore(cap);
    expect(result.subScore).toBe(ISS.COVERT);
    expect(result.value).toBe(100);
  });

  it('tie-breaks correctly when two sub-scores share the maximum', () => {
    // SIGINT and CYBER are both 90, so SIGINT wins (earlier in order)
    const cap = makeCap(FID.EU, 50, 90, 90, 60);
    const result = engine.findHighestSubScore(cap);
    expect(result.subScore).toBe(ISS.SIGINT);
    expect(result.value).toBe(90);
  });

  it('tie-breaks to HUMINT when HUMINT is the maximum', () => {
    const cap = makeCap(FID.Iran, 100, 100, 80, 70);
    const result = engine.findHighestSubScore(cap);
    expect(result.subScore).toBe(ISS.HUMINT);
    expect(result.value).toBe(100);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// computeClarity
// ═══════════════════════════════════════════════════════════════════════════════

describe('computeClarity', () => {
  /**
   * Helper: build an observer IntelCapability whose composite equals a known value.
   * Since composite = h×0.3 + s×0.25 + c×0.25 + v×0.2 and all equal ⇒ composite = x,
   * we can set all sub-scores equal to `x` so the composite equals `x`.
   */
  function makeUniformCap(factionId: FactionId, score: number): IntelCapability {
    return makeCap(factionId, score, score, score, score);
  }

  it('high clarity scenario: composite=60, ally=10, targetCovert=20 → clarity=50', () => {
    const observer = makeUniformCap(FID.US, 60);
    const target = makeCap(FID.China, 50, 50, 50, 20);
    const input: ClarityInput = { observer, target, allyIntelBonus: 10 };
    const result = engine.computeClarity(input);

    // clarity = 0 + 60 + 10 - 20 = 50
    expect(result.clarity).toBeCloseTo(50, 5);
    expect(result.ghostUnitRisk).toBe(false);
    expect(result.headlineReliable).toBe(true);
    expect(result.headlineReliabilityFactor).toBeCloseTo(1.0, 5);
    expect(result.ghostUnitProbability).toBeCloseTo(0, 5);
  });

  it('low clarity scenario: composite=10, ally=0, targetCovert=50 → clamped to 0', () => {
    const observer = makeUniformCap(FID.EU, 10);
    const target = makeCap(FID.Russia, 50, 50, 50, 50);
    const input: ClarityInput = { observer, target, allyIntelBonus: 0 };
    const result = engine.computeClarity(input);

    // rawClarity = 0 + 10 + 0 - 50 = -40 → clamped to 0
    expect(result.clarity).toBeCloseTo(0, 5);
    expect(result.ghostUnitRisk).toBe(true);
    expect(result.headlineReliable).toBe(false);
  });

  it('ghost unit threshold boundary: clarity=29 → risk', () => {
    // Need observer composite + ally - target.covert = 29
    // composite of uniform 29 = 29, ally = 0, target.covert = 0 → clarity = 29
    const observer = makeUniformCap(FID.US, 29);
    const target = makeCap(FID.China, 0, 0, 0, 0);
    const input: ClarityInput = { observer, target, allyIntelBonus: 0 };
    const result = engine.computeClarity(input);

    expect(result.clarity).toBeCloseTo(29, 5);
    expect(result.ghostUnitRisk).toBe(true);
  });

  it('ghost unit threshold boundary: clarity=30 → no risk', () => {
    const observer = makeUniformCap(FID.US, 30);
    const target = makeCap(FID.China, 0, 0, 0, 0);
    const input: ClarityInput = { observer, target, allyIntelBonus: 0 };
    const result = engine.computeClarity(input);

    expect(result.clarity).toBeCloseTo(30, 5);
    expect(result.ghostUnitRisk).toBe(false);
  });

  it('headline threshold boundary: clarity=39 → unreliable', () => {
    const observer = makeUniformCap(FID.US, 39);
    const target = makeCap(FID.China, 0, 0, 0, 0);
    const input: ClarityInput = { observer, target, allyIntelBonus: 0 };
    const result = engine.computeClarity(input);

    expect(result.clarity).toBeCloseTo(39, 5);
    expect(result.headlineReliable).toBe(false);
  });

  it('headline threshold boundary: clarity=40 → reliable', () => {
    const observer = makeUniformCap(FID.US, 40);
    const target = makeCap(FID.China, 0, 0, 0, 0);
    const input: ClarityInput = { observer, target, allyIntelBonus: 0 };
    const result = engine.computeClarity(input);

    expect(result.clarity).toBeCloseTo(40, 5);
    expect(result.headlineReliable).toBe(true);
    expect(result.headlineReliabilityFactor).toBeCloseTo(1.0, 5);
  });

  it('ghost unit probability formula: clarity=15, probability = 0.3 × (1 - 15/30) = 0.15', () => {
    const observer = makeUniformCap(FID.US, 15);
    const target = makeCap(FID.China, 0, 0, 0, 0);
    const input: ClarityInput = { observer, target, allyIntelBonus: 0 };
    const result = engine.computeClarity(input);

    expect(result.clarity).toBeCloseTo(15, 5);
    expect(result.ghostUnitRisk).toBe(true);
    expect(result.ghostUnitProbability).toBeCloseTo(0.15, 5);
  });

  it('headline reliability factor for unreliable: clarity=20, factor = 0.875', () => {
    // factor = 1.0 - 0.25 × (1 - 20/40) = 1.0 - 0.25 × 0.5 = 1.0 - 0.125 = 0.875
    const observer = makeUniformCap(FID.US, 20);
    const target = makeCap(FID.China, 0, 0, 0, 0);
    const input: ClarityInput = { observer, target, allyIntelBonus: 0 };
    const result = engine.computeClarity(input);

    expect(result.clarity).toBeCloseTo(20, 5);
    expect(result.headlineReliable).toBe(false);
    expect(result.headlineReliabilityFactor).toBeCloseTo(0.875, 5);
  });

  it('clarity clamped to max 100', () => {
    // observer composite = 100, ally = 50, target.covert = 0 → raw 150 → clamped 100
    const observer = makeUniformCap(FID.US, 100);
    const target = makeCap(FID.China, 0, 0, 0, 0);
    const input: ClarityInput = { observer, target, allyIntelBonus: 50 };
    const result = engine.computeClarity(input);

    expect(result.clarity).toBeCloseTo(100, 5);
  });

  it('clarity clamped to min 0', () => {
    // observer composite = 0, ally = 0, target.covert = 100 → raw -100 → clamped 0
    const observer = makeUniformCap(FID.EU, 0);
    const target = makeCap(FID.Russia, 0, 0, 0, 100);
    const input: ClarityInput = { observer, target, allyIntelBonus: 0 };
    const result = engine.computeClarity(input);

    expect(result.clarity).toBeCloseTo(0, 5);
  });

  it('returns correct observerFaction and targetFaction', () => {
    const observer = makeUniformCap(FID.US, 50);
    const target = makeCap(FID.Russia, 50, 50, 50, 50);
    const input: ClarityInput = { observer, target, allyIntelBonus: 0 };
    const result = engine.computeClarity(input);

    expect(result.observerFaction).toBe(FID.US);
    expect(result.targetFaction).toBe(FID.Russia);
  });

  it('includes ownIntelCapability, allyIntelSharing, and targetCounterIntel in result', () => {
    const observer = makeUniformCap(FID.US, 60);
    const target = makeCap(FID.China, 30, 30, 30, 25);
    const input: ClarityInput = { observer, target, allyIntelBonus: 5 };
    const result = engine.computeClarity(input);

    expect(result.ownIntelCapability).toBeCloseTo(60, 5);
    expect(result.allyIntelSharing).toBe(5);
    expect(result.targetCounterIntel).toBe(25);
  });

  it('ghost unit probability is 0 when no risk', () => {
    const observer = makeUniformCap(FID.US, 50);
    const target = makeCap(FID.China, 0, 0, 0, 0);
    const input: ClarityInput = { observer, target, allyIntelBonus: 0 };
    const result = engine.computeClarity(input);

    expect(result.ghostUnitRisk).toBe(false);
    expect(result.ghostUnitProbability).toBeCloseTo(0, 5);
  });

  it('ghost unit probability at clarity=0 equals ghostUnitProbabilityBase (0.3)', () => {
    const observer = makeUniformCap(FID.EU, 0);
    const target = makeCap(FID.Russia, 0, 0, 0, 50);
    const input: ClarityInput = { observer, target, allyIntelBonus: 0 };
    const result = engine.computeClarity(input);

    expect(result.clarity).toBeCloseTo(0, 5);
    expect(result.ghostUnitProbability).toBeCloseTo(0.3, 5);
  });

  it('ally bonus increases clarity', () => {
    const observer = makeUniformCap(FID.US, 20);
    const target = makeCap(FID.China, 0, 0, 0, 0);

    const withoutAlly = engine.computeClarity({ observer, target, allyIntelBonus: 0 });
    const withAlly = engine.computeClarity({ observer, target, allyIntelBonus: 15 });

    expect(withAlly.clarity).toBeGreaterThan(withoutAlly.clarity);
    expect(withAlly.clarity).toBeCloseTo(35, 5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// assessFaction
// ═══════════════════════════════════════════════════════════════════════════════

describe('assessFaction', () => {
  it('returns composite score and clarity for each rival', () => {
    const faction = makeCap(FID.US, 70, 60, 50, 40);
    const rivalChina = makeCap(FID.China, 50, 50, 50, 30);
    const rivalRussia = makeCap(FID.Russia, 40, 40, 40, 60);
    const allyBonusByRival = new Map<FactionId, number>([
      [FID.China, 5],
      [FID.Russia, 10],
    ]);

    const input: IntelAssessmentInput = {
      faction,
      rivals: [rivalChina, rivalRussia],
      allyBonusByRival,
    };

    const result = engine.assessFaction(input);

    expect(result.factionId).toBe(FID.US);
    expect(result.compositeScore.factionId).toBe(FID.US);
    // composite = 70×0.3 + 60×0.25 + 50×0.25 + 40×0.2 = 21+15+12.5+8 = 56.5
    expect(result.compositeScore.composite).toBeCloseTo(56.5, 5);

    expect(result.clarityByRival).toHaveLength(2);

    // clarity vs China: 56.5 + 5 - 30 = 31.5
    const vsChina = result.clarityByRival[0]!;
    expect(vsChina.observerFaction).toBe(FID.US);
    expect(vsChina.targetFaction).toBe(FID.China);
    expect(vsChina.clarity).toBeCloseTo(31.5, 5);

    // clarity vs Russia: 56.5 + 10 - 60 = 6.5
    const vsRussia = result.clarityByRival[1]!;
    expect(vsRussia.observerFaction).toBe(FID.US);
    expect(vsRussia.targetFaction).toBe(FID.Russia);
    expect(vsRussia.clarity).toBeCloseTo(6.5, 5);
  });

  it('uses ally bonus map correctly (0 for missing entries)', () => {
    const faction = makeCap(FID.EU, 50, 50, 50, 50);
    const rival = makeCap(FID.Iran, 30, 30, 30, 20);
    const allyBonusByRival = new Map<FactionId, number>();
    // No entry for Iran — should default to 0

    const input: IntelAssessmentInput = {
      faction,
      rivals: [rival],
      allyBonusByRival,
    };

    const result = engine.assessFaction(input);

    // composite = 50, ally bonus = 0, target covert = 20 → clarity = 30
    const vsIran = result.clarityByRival[0]!;
    expect(vsIran.allyIntelSharing).toBe(0);
    expect(vsIran.clarity).toBeCloseTo(30, 5);
  });

  it('handles empty rivals list', () => {
    const faction = makeCap(FID.US, 60, 60, 60, 60);
    const allyBonusByRival = new Map<FactionId, number>();

    const input: IntelAssessmentInput = {
      faction,
      rivals: [],
      allyBonusByRival,
    };

    const result = engine.assessFaction(input);

    expect(result.factionId).toBe(FID.US);
    expect(result.compositeScore.composite).toBeCloseTo(60, 5);
    expect(result.clarityByRival).toHaveLength(0);
  });

  it('includes composite breakdown in assessment', () => {
    const faction = makeCap(FID.China, 80, 60, 70, 50);
    const input: IntelAssessmentInput = {
      faction,
      rivals: [],
      allyBonusByRival: new Map(),
    };

    const result = engine.assessFaction(input);

    // 80×0.3=24, 60×0.25=15, 70×0.25=17.5, 50×0.2=10
    expect(result.compositeScore.breakdown.humintWeighted).toBeCloseTo(24, 5);
    expect(result.compositeScore.breakdown.sigintWeighted).toBeCloseTo(15, 5);
    expect(result.compositeScore.breakdown.cyberWeighted).toBeCloseTo(17.5, 5);
    expect(result.compositeScore.breakdown.covertWeighted).toBeCloseTo(10, 5);
    expect(result.compositeScore.composite).toBeCloseTo(66.5, 5);
  });

  it('evaluates clarity against multiple rivals with different ally bonuses', () => {
    const faction = makeCap(FID.US, 60, 60, 60, 60);
    const rivalChina = makeCap(FID.China, 40, 40, 40, 80);
    const rivalRussia = makeCap(FID.Russia, 30, 30, 30, 90);
    const rivalEU = makeCap(FID.EU, 50, 50, 50, 10);

    const allyBonusByRival = new Map<FactionId, number>([
      [FID.China, 10],
      [FID.Russia, 0],
      [FID.EU, 20],
    ]);

    const input: IntelAssessmentInput = {
      faction,
      rivals: [rivalChina, rivalRussia, rivalEU],
      allyBonusByRival,
    };

    const result = engine.assessFaction(input);

    expect(result.clarityByRival).toHaveLength(3);

    // composite = 60
    // vs China: 60 + 10 - 80 = -10 → clamped 0
    expect(result.clarityByRival[0]!.clarity).toBeCloseTo(0, 5);
    // vs Russia: 60 + 0 - 90 = -30 → clamped 0
    expect(result.clarityByRival[1]!.clarity).toBeCloseTo(0, 5);
    // vs EU: 60 + 20 - 10 = 70
    expect(result.clarityByRival[2]!.clarity).toBeCloseTo(70, 5);
  });
});
