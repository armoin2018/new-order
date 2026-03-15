import { describe, it, expect } from 'vitest';
import {
  IntelligenceOpsEngine,
  type IntelOperationInput,
  type ActiveAsset,
} from '@/engine/intel-operations';
import { IntelligenceCapabilityEngine } from '@/engine/intel-capability';
import type { IntelCapability } from '@/engine/intel-capability';
import { FactionId, IntelOperationType } from '@/data/types';
import type { TurnNumber } from '@/data/types';
import { SeededRandom } from '@/engine/rng';

// ── Aliases ──────────────────────────────────────────────────────────────────
const FID = FactionId;
const IOT = IntelOperationType;

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Shorthand factory for IntelCapability. */
function makeCap(
  factionId: FactionId,
  humint: number,
  sigint: number,
  cyber: number,
  covert: number,
): IntelCapability {
  return IntelligenceCapabilityEngine.createCapability(factionId, humint, sigint, cyber, covert);
}

/** Shorthand factory for IntelOperationInput with sensible defaults. */
function makeInput(overrides: Partial<IntelOperationInput> = {}): IntelOperationInput {
  return {
    operationType: IOT.Gather,
    executingFaction: FID.US,
    targetFaction: FID.Russia,
    executorCapability: makeCap(FID.US, 50, 50, 50, 50),
    targetCapability: makeCap(FID.Russia, 50, 50, 50, 50),
    currentTurn: 1 as TurnNumber,
    diplomaticInfluence: 20,
    ...overrides,
  };
}

// ── Engine instance ──────────────────────────────────────────────────────────
const engine = new IntelligenceOpsEngine();

// ═══════════════════════════════════════════════════════════════════════════════
// getOperationConfig
// ═══════════════════════════════════════════════════════════════════════════════

describe('getOperationConfig', () => {
  it('returns correct config for Gather', () => {
    const cfg = engine.getOperationConfig(IOT.Gather);
    expect(cfg.primarySubScore).toBe('sigint');
    expect(cfg.baseSuccessProbability).toBeCloseTo(0.5, 5);
    expect(cfg.diCost).toBe(3);
    expect(cfg.difficultyModifier).toBeCloseTo(0.5, 5);
  });

  it('returns correct config for Counterintel', () => {
    const cfg = engine.getOperationConfig(IOT.Counterintel);
    expect(cfg.primarySubScore).toBe('covert');
    expect(cfg.baseSuccessProbability).toBeCloseTo(0.6, 5);
    expect(cfg.diCost).toBe(4);
    expect(cfg.difficultyModifier).toBeCloseTo(0.3, 5);
  });

  it('returns correct config for RecruitAsset', () => {
    const cfg = engine.getOperationConfig(IOT.RecruitAsset);
    expect(cfg.primarySubScore).toBe('humint');
    expect(cfg.baseSuccessProbability).toBeCloseTo(0.35, 5);
    expect(cfg.diCost).toBe(8);
    expect(cfg.difficultyModifier).toBeCloseTo(0.8, 5);
  });

  it('returns correct config for Sabotage', () => {
    const cfg = engine.getOperationConfig(IOT.Sabotage);
    expect(cfg.primarySubScore).toBe('cyber');
    expect(cfg.baseSuccessProbability).toBeCloseTo(0.4, 5);
    expect(cfg.diCost).toBe(6);
    expect(cfg.difficultyModifier).toBeCloseTo(1.0, 5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// validateOperation
// ═══════════════════════════════════════════════════════════════════════════════

describe('validateOperation', () => {
  it('fails when executing faction targets itself', () => {
    const input = makeInput({ executingFaction: FID.US, targetFaction: FID.US });
    const result = engine.validateOperation(input);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/own faction/i);
  });

  it('fails with insufficient DI for Gather (need 3)', () => {
    const input = makeInput({
      operationType: IOT.Gather,
      diplomaticInfluence: 2,
    });
    const result = engine.validateOperation(input);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/insufficient/i);
  });

  it('fails with insufficient DI for RecruitAsset (need 8)', () => {
    const input = makeInput({
      operationType: IOT.RecruitAsset,
      diplomaticInfluence: 7,
    });
    const result = engine.validateOperation(input);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/insufficient/i);
  });

  it('fails when Sabotage has no sabotageTarget', () => {
    const input = makeInput({
      operationType: IOT.Sabotage,
      sabotageTarget: undefined,
    });
    const result = engine.validateOperation(input);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/sabotageTarget/i);
  });

  it('fails when Sabotage has an invalid sabotageTarget', () => {
    const input = makeInput({
      operationType: IOT.Sabotage,
      sabotageTarget: 'popularity' as 'stability',
    });
    const result = engine.validateOperation(input);
    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/invalid sabotageTarget/i);
  });

  it('passes for a valid Gather with enough DI', () => {
    const input = makeInput({
      operationType: IOT.Gather,
      diplomaticInfluence: 3,
    });
    const result = engine.validateOperation(input);
    expect(result.valid).toBe(true);
  });

  it('passes for a valid Sabotage with stability target', () => {
    const input = makeInput({
      operationType: IOT.Sabotage,
      sabotageTarget: 'stability',
      diplomaticInfluence: 10,
    });
    const result = engine.validateOperation(input);
    expect(result.valid).toBe(true);
  });

  it('passes for a valid Sabotage with militaryReadiness target', () => {
    const input = makeInput({
      operationType: IOT.Sabotage,
      sabotageTarget: 'militaryReadiness',
      diplomaticInfluence: 10,
    });
    const result = engine.validateOperation(input);
    expect(result.valid).toBe(true);
  });

  it('passes for a valid Sabotage with treasury target', () => {
    const input = makeInput({
      operationType: IOT.Sabotage,
      sabotageTarget: 'treasury',
      diplomaticInfluence: 10,
    });
    const result = engine.validateOperation(input);
    expect(result.valid).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// calculateSuccessProbability
// ═══════════════════════════════════════════════════════════════════════════════

describe('calculateSuccessProbability', () => {
  it('Gather with sigint=80 → 0.9', () => {
    // 0.5 + (80/100)*0.5 = 0.5 + 0.4 = 0.9
    const input = makeInput({
      operationType: IOT.Gather,
      executorCapability: makeCap(FID.US, 50, 80, 50, 50),
    });
    expect(engine.calculateSuccessProbability(input)).toBeCloseTo(0.9, 5);
  });

  it('RecruitAsset with humint=0 → 0.35', () => {
    // 0.35 + (0/100)*0.5 = 0.35
    const input = makeInput({
      operationType: IOT.RecruitAsset,
      executorCapability: makeCap(FID.US, 0, 50, 50, 50),
    });
    expect(engine.calculateSuccessProbability(input)).toBeCloseTo(0.35, 5);
  });

  it('RecruitAsset with humint=100 → 0.85', () => {
    // 0.35 + (100/100)*0.5 = 0.85
    const input = makeInput({
      operationType: IOT.RecruitAsset,
      executorCapability: makeCap(FID.US, 100, 50, 50, 50),
    });
    expect(engine.calculateSuccessProbability(input)).toBeCloseTo(0.85, 5);
  });

  it('Counterintel with covert=100 → clamped to 0.95', () => {
    // 0.6 + (100/100)*0.5 = 1.1 → clamped to 0.95
    const input = makeInput({
      operationType: IOT.Counterintel,
      executorCapability: makeCap(FID.US, 50, 50, 50, 100),
    });
    expect(engine.calculateSuccessProbability(input)).toBeCloseTo(0.95, 5);
  });

  it('Sabotage with cyber=60 → 0.7', () => {
    // 0.4 + (60/100)*0.5 = 0.4 + 0.3 = 0.7
    const input = makeInput({
      operationType: IOT.Sabotage,
      executorCapability: makeCap(FID.US, 50, 50, 60, 50),
      sabotageTarget: 'stability',
    });
    expect(engine.calculateSuccessProbability(input)).toBeCloseTo(0.7, 5);
  });

  it('minimum clamp at 0.05 for very low sub-scores and low base', () => {
    // RecruitAsset: 0.35 + (0/100)*0.5 = 0.35 — not low enough for min clamp
    // Construct an edge case: Gather with sigint=0 → 0.5 + 0 = 0.5 (still above clamp)
    // To truly hit the min clamp the raw value must be below 0.05 — not possible
    // with the game's base probabilities (≥ 0.35), so test that the function
    // never returns below 0.05 even with all-zero sub-scores.
    const input = makeInput({
      operationType: IOT.RecruitAsset,
      executorCapability: makeCap(FID.US, 0, 0, 0, 0),
    });
    const prob = engine.calculateSuccessProbability(input);
    expect(prob).toBeGreaterThanOrEqual(0.05);
    expect(prob).toBeLessThanOrEqual(0.95);
  });

  it('Gather uses sigint, not other sub-scores', () => {
    const highSigint = makeInput({
      operationType: IOT.Gather,
      executorCapability: makeCap(FID.US, 0, 90, 0, 0),
    });
    const highHumint = makeInput({
      operationType: IOT.Gather,
      executorCapability: makeCap(FID.US, 90, 0, 0, 0),
    });
    // sigint=90: 0.5 + 0.45 = 0.95 (clamped)
    // sigint=0:  0.5 + 0    = 0.5
    expect(engine.calculateSuccessProbability(highSigint)).toBeCloseTo(0.95, 5);
    expect(engine.calculateSuccessProbability(highHumint)).toBeCloseTo(0.5, 5);
  });

  it('Counterintel uses covert sub-score', () => {
    const input = makeInput({
      operationType: IOT.Counterintel,
      executorCapability: makeCap(FID.US, 0, 0, 0, 60),
    });
    // 0.6 + (60/100)*0.5 = 0.6 + 0.3 = 0.9
    expect(engine.calculateSuccessProbability(input)).toBeCloseTo(0.9, 5);
  });

  it('Sabotage uses cyber sub-score', () => {
    const input = makeInput({
      operationType: IOT.Sabotage,
      executorCapability: makeCap(FID.US, 100, 100, 0, 100),
      sabotageTarget: 'stability',
    });
    // cyber=0: 0.4 + 0 = 0.4
    expect(engine.calculateSuccessProbability(input)).toBeCloseTo(0.4, 5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// calculateBlowbackChance
// ═══════════════════════════════════════════════════════════════════════════════

describe('calculateBlowbackChance', () => {
  it('covert=30, Gather (dm=0.5) → 0.35', () => {
    // ((100-30)/100)*0.5 = 0.7*0.5 = 0.35
    const input = makeInput({
      operationType: IOT.Gather,
      executorCapability: makeCap(FID.US, 50, 50, 50, 30),
    });
    expect(engine.calculateBlowbackChance(input)).toBeCloseTo(0.35, 5);
  });

  it('covert=0, Sabotage (dm=1.0) → 1.0', () => {
    // ((100-0)/100)*1.0 = 1.0
    const input = makeInput({
      operationType: IOT.Sabotage,
      executorCapability: makeCap(FID.US, 50, 50, 50, 0),
      sabotageTarget: 'stability',
    });
    expect(engine.calculateBlowbackChance(input)).toBeCloseTo(1.0, 5);
  });

  it('covert=100, any operation → 0.0', () => {
    // ((100-100)/100)*dm = 0
    const input = makeInput({
      operationType: IOT.Gather,
      executorCapability: makeCap(FID.US, 50, 50, 50, 100),
    });
    expect(engine.calculateBlowbackChance(input)).toBeCloseTo(0.0, 5);
  });

  it('covert=50, Counterintel (dm=0.3) → 0.15', () => {
    // ((100-50)/100)*0.3 = 0.5*0.3 = 0.15
    const input = makeInput({
      operationType: IOT.Counterintel,
      executorCapability: makeCap(FID.US, 50, 50, 50, 50),
    });
    expect(engine.calculateBlowbackChance(input)).toBeCloseTo(0.15, 5);
  });

  it('covert=50, RecruitAsset (dm=0.8) → 0.4', () => {
    // ((100-50)/100)*0.8 = 0.5*0.8 = 0.4
    const input = makeInput({
      operationType: IOT.RecruitAsset,
      executorCapability: makeCap(FID.US, 50, 50, 50, 50),
    });
    expect(engine.calculateBlowbackChance(input)).toBeCloseTo(0.4, 5);
  });

  it('result is clamped to [0, 1]', () => {
    // With covert=100, result should be exactly 0 and never negative
    const inputZero = makeInput({
      operationType: IOT.Sabotage,
      executorCapability: makeCap(FID.US, 50, 50, 50, 100),
      sabotageTarget: 'stability',
    });
    const chance = engine.calculateBlowbackChance(inputZero);
    expect(chance).toBeGreaterThanOrEqual(0);
    expect(chance).toBeLessThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// executeOperation
// ═══════════════════════════════════════════════════════════════════════════════

describe('executeOperation', () => {
  it('returns failed result with diCost=0 for invalid operation', () => {
    const input = makeInput({ executingFaction: FID.US, targetFaction: FID.US });
    const rng = new SeededRandom(42);
    const result = engine.executeOperation(input, rng);
    expect(result.success).toBe(false);
    expect(result.successRoll).toBe(-1);
    expect(result.diCost).toBe(0);
    expect(result.blowback.occurred).toBe(false);
  });

  it('returns failed result with diCost=0 for insufficient DI', () => {
    const input = makeInput({
      operationType: IOT.RecruitAsset,
      diplomaticInfluence: 1,
    });
    const rng = new SeededRandom(99);
    const result = engine.executeOperation(input, rng);
    expect(result.success).toBe(false);
    expect(result.successRoll).toBe(-1);
    expect(result.diCost).toBe(0);
  });

  it('diCost matches the operation config for valid operations', () => {
    const input = makeInput({
      operationType: IOT.Gather,
      executorCapability: makeCap(FID.US, 50, 50, 50, 50),
      diplomaticInfluence: 20,
    });
    const rng = new SeededRandom(42);
    const result = engine.executeOperation(input, rng);
    expect(result.diCost).toBe(3); // Gather diCost
  });

  it('returns success and correct effect values based on the actual roll', () => {
    // Use high sigint to maximize success probability for Gather (≈0.95)
    const input = makeInput({
      operationType: IOT.Gather,
      executorCapability: makeCap(FID.US, 50, 100, 50, 100), // covert=100 prevents blowback
      diplomaticInfluence: 20,
    });
    const rng = new SeededRandom(42);
    const result = engine.executeOperation(input, rng);

    // Verify the result is self-consistent
    expect(result.operationType).toBe(IOT.Gather);
    expect(result.executingFaction).toBe(FID.US);
    expect(result.targetFaction).toBe(FID.Russia);
    expect(result.successRoll).toBeGreaterThanOrEqual(0);
    expect(result.successRoll).toBeLessThan(1);
    expect(result.successThreshold).toBeCloseTo(0.95, 5); // sigint=100: 0.5+0.5=1.0 → clamped 0.95

    if (result.success) {
      expect(result.effect.clarityChange).toBe(10);
      expect(result.effect.humintBonus).toBe(0);
      expect(result.effect.targetStatChange).toBe(0);
    } else {
      expect(result.effect.clarityChange).toBe(0);
      expect(result.effect.humintBonus).toBe(0);
      expect(result.effect.targetStatChange).toBe(0);
    }
  });

  it('produces correct Gather effect on success', () => {
    // Force success: very high probability, try multiple seeds until we get one that succeeds
    const input = makeInput({
      operationType: IOT.Gather,
      executorCapability: makeCap(FID.US, 50, 100, 50, 100), // high sigint + high covert
      diplomaticInfluence: 20,
    });
    // Try seeds to find a success
    let result;
    for (let seed = 0; seed < 100; seed++) {
      const rng = new SeededRandom(seed);
      result = engine.executeOperation(input, rng);
      if (result.success) break;
    }
    expect(result!.success).toBe(true);
    expect(result!.effect.clarityChange).toBe(10);
    expect(result!.effect.humintBonus).toBe(0);
    expect(result!.effect.targetStatChange).toBe(0);
    expect(result!.effect.targetStat).toBeNull();
  });

  it('produces correct Counterintel effect on success', () => {
    const input = makeInput({
      operationType: IOT.Counterintel,
      executorCapability: makeCap(FID.US, 50, 50, 50, 100), // covert=100 for high success + no blowback
      diplomaticInfluence: 20,
    });
    let result;
    for (let seed = 0; seed < 100; seed++) {
      const rng = new SeededRandom(seed);
      result = engine.executeOperation(input, rng);
      if (result.success) break;
    }
    expect(result!.success).toBe(true);
    expect(result!.effect.clarityChange).toBe(-10);
    expect(result!.effect.humintBonus).toBe(0);
    expect(result!.effect.targetStatChange).toBe(0);
    expect(result!.effect.targetStat).toBeNull();
  });

  it('produces correct RecruitAsset effect on success', () => {
    const input = makeInput({
      operationType: IOT.RecruitAsset,
      executorCapability: makeCap(FID.US, 100, 50, 50, 100), // humint=100 for high success
      diplomaticInfluence: 20,
    });
    let result;
    for (let seed = 0; seed < 100; seed++) {
      const rng = new SeededRandom(seed);
      result = engine.executeOperation(input, rng);
      if (result.success) break;
    }
    expect(result!.success).toBe(true);
    expect(result!.effect.clarityChange).toBe(0);
    expect(result!.effect.humintBonus).toBe(5);
    expect(result!.effect.targetStatChange).toBe(0);
    expect(result!.effect.targetStat).toBeNull();
  });

  it('produces correct Sabotage effect on success', () => {
    const input = makeInput({
      operationType: IOT.Sabotage,
      executorCapability: makeCap(FID.US, 50, 50, 100, 100), // cyber=100 for high success
      diplomaticInfluence: 20,
      sabotageTarget: 'stability',
    });
    let result;
    for (let seed = 0; seed < 100; seed++) {
      const rng = new SeededRandom(seed);
      result = engine.executeOperation(input, rng);
      if (result.success) break;
    }
    expect(result!.success).toBe(true);
    expect(result!.effect.clarityChange).toBe(0);
    expect(result!.effect.humintBonus).toBe(0);
    expect(result!.effect.targetStatChange).toBe(-10);
    expect(result!.effect.targetStat).toBe('stability');
  });

  it('produces zero effect on failure', () => {
    // Use very low sub-scores to make failure likely
    const input = makeInput({
      operationType: IOT.RecruitAsset,
      executorCapability: makeCap(FID.US, 0, 0, 0, 100), // humint=0, covert=100 for no blowback
      diplomaticInfluence: 20,
    });
    let result;
    for (let seed = 0; seed < 200; seed++) {
      const rng = new SeededRandom(seed);
      result = engine.executeOperation(input, rng);
      if (!result.success) break;
    }
    expect(result!.success).toBe(false);
    expect(result!.effect.clarityChange).toBe(0);
    expect(result!.effect.humintBonus).toBe(0);
    expect(result!.effect.targetStatChange).toBe(0);
    expect(result!.effect.targetStat).toBeNull();
  });

  it('blowback consequences are applied when blowback occurs', () => {
    // Use covert=0, Sabotage (dm=1.0) for guaranteed blowback chance=1.0
    const input = makeInput({
      operationType: IOT.Sabotage,
      executorCapability: makeCap(FID.US, 50, 50, 100, 0), // covert=0 → blowback chance 1.0
      diplomaticInfluence: 20,
      sabotageTarget: 'stability',
    });
    const rng = new SeededRandom(42);
    const result = engine.executeOperation(input, rng);

    // With blowback chance = 1.0, blowback is guaranteed regardless of roll
    expect(result.blowback.occurred).toBe(true);
    expect(result.blowback.tensionSpike).toBe(15);
    expect(result.blowback.legitimacyPenalty).toBe(-10);
    expect(result.blowback.diPenalty).toBe(-5);
  });

  it('no blowback consequences when blowback does not occur', () => {
    // Use covert=100 → blowback chance = 0
    const input = makeInput({
      operationType: IOT.Gather,
      executorCapability: makeCap(FID.US, 50, 80, 50, 100),
      diplomaticInfluence: 20,
    });
    const rng = new SeededRandom(42);
    const result = engine.executeOperation(input, rng);

    expect(result.blowback.occurred).toBe(false);
    expect(result.blowback.tensionSpike).toBe(0);
    expect(result.blowback.legitimacyPenalty).toBe(0);
    expect(result.blowback.diPenalty).toBe(0);
  });

  it('success and blowback are resolved independently', () => {
    // covert=0, Sabotage → blowback is guaranteed (chance=1.0)
    // But success depends on the first roll, blowback on the second
    const input = makeInput({
      operationType: IOT.Sabotage,
      executorCapability: makeCap(FID.US, 50, 50, 50, 0), // cyber=50, covert=0
      diplomaticInfluence: 20,
      sabotageTarget: 'stability',
    });
    const rng = new SeededRandom(42);
    const result = engine.executeOperation(input, rng);

    // Blowback is always triggered with covert=0 and dm=1.0
    expect(result.blowback.occurred).toBe(true);
    // Success is independent — could be true or false
    expect(typeof result.success).toBe('boolean');
    expect(result.successRoll).toBeGreaterThanOrEqual(0);
    expect(result.successRoll).toBeLessThan(1);
  });

  it('successThreshold matches calculateSuccessProbability', () => {
    const input = makeInput({
      operationType: IOT.Counterintel,
      executorCapability: makeCap(FID.US, 50, 50, 50, 70),
      diplomaticInfluence: 20,
    });
    const expectedProb = engine.calculateSuccessProbability(input);
    const rng = new SeededRandom(42);
    const result = engine.executeOperation(input, rng);
    expect(result.successThreshold).toBeCloseTo(expectedProb, 5);
  });

  it('blowbackChance in result matches calculateBlowbackChance', () => {
    const input = makeInput({
      operationType: IOT.Gather,
      executorCapability: makeCap(FID.US, 50, 50, 50, 30),
      diplomaticInfluence: 20,
    });
    const expectedBlowback = engine.calculateBlowbackChance(input);
    const rng = new SeededRandom(42);
    const result = engine.executeOperation(input, rng);
    expect(result.blowback.blowbackChance).toBeCloseTo(expectedBlowback, 5);
  });

  it('diCost for Sabotage is 6', () => {
    const input = makeInput({
      operationType: IOT.Sabotage,
      executorCapability: makeCap(FID.US, 50, 50, 50, 50),
      diplomaticInfluence: 20,
      sabotageTarget: 'stability',
    });
    const rng = new SeededRandom(42);
    const result = engine.executeOperation(input, rng);
    expect(result.diCost).toBe(6);
  });

  it('diCost for Counterintel is 4', () => {
    const input = makeInput({
      operationType: IOT.Counterintel,
      executorCapability: makeCap(FID.US, 50, 50, 50, 50),
      diplomaticInfluence: 20,
    });
    const rng = new SeededRandom(42);
    const result = engine.executeOperation(input, rng);
    expect(result.diCost).toBe(4);
  });

  it('diCost for RecruitAsset is 8', () => {
    const input = makeInput({
      operationType: IOT.RecruitAsset,
      executorCapability: makeCap(FID.US, 50, 50, 50, 50),
      diplomaticInfluence: 20,
    });
    const rng = new SeededRandom(42);
    const result = engine.executeOperation(input, rng);
    expect(result.diCost).toBe(8);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// createAsset
// ═══════════════════════════════════════════════════════════════════════════════

describe('createAsset', () => {
  const baseInput = makeInput({
    operationType: IOT.RecruitAsset,
    executingFaction: FID.US,
    targetFaction: FID.China,
  });

  it('generates correct ID format: asset-{exec}-{target}-T{turn}', () => {
    const asset = IntelligenceOpsEngine.createAsset(baseInput, 5 as TurnNumber);
    expect(asset.id).toBe('asset-us-china-T5');
  });

  it('has correct humintBonusPerTurn and lifespan', () => {
    const asset = IntelligenceOpsEngine.createAsset(baseInput, 1 as TurnNumber);
    expect(asset.humintBonusPerTurn).toBe(5);
    expect(asset.lifespan).toBe(0); // indefinite
  });

  it('is created with active = true', () => {
    const asset = IntelligenceOpsEngine.createAsset(baseInput, 1 as TurnNumber);
    expect(asset.active).toBe(true);
  });

  it('stores executingFaction, targetFaction, and recruitedTurn correctly', () => {
    const asset = IntelligenceOpsEngine.createAsset(baseInput, 3 as TurnNumber);
    expect(asset.executingFaction).toBe(FID.US);
    expect(asset.targetFaction).toBe(FID.China);
    expect(asset.recruitedTurn).toBe(3);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// isAssetExpired
// ═══════════════════════════════════════════════════════════════════════════════

describe('isAssetExpired', () => {
  const baseAsset: ActiveAsset = {
    id: 'asset-us-russia-T1',
    executingFaction: FID.US,
    targetFaction: FID.Russia,
    recruitedTurn: 1 as TurnNumber,
    humintBonusPerTurn: 5,
    lifespan: 0,
    active: true,
  };

  it('lifespan=0 → never expires', () => {
    expect(IntelligenceOpsEngine.isAssetExpired(baseAsset, 1 as TurnNumber)).toBe(false);
    expect(IntelligenceOpsEngine.isAssetExpired(baseAsset, 50 as TurnNumber)).toBe(false);
    expect(IntelligenceOpsEngine.isAssetExpired(baseAsset, 999 as TurnNumber)).toBe(false);
  });

  it('before expiry returns false', () => {
    const asset: ActiveAsset = { ...baseAsset, lifespan: 5, recruitedTurn: 3 as TurnNumber };
    // expires at turn 3+5=8, so turn 7 is before expiry
    expect(IntelligenceOpsEngine.isAssetExpired(asset, 7 as TurnNumber)).toBe(false);
  });

  it('at expiry returns true', () => {
    const asset: ActiveAsset = { ...baseAsset, lifespan: 5, recruitedTurn: 3 as TurnNumber };
    // expires at turn 3+5=8
    expect(IntelligenceOpsEngine.isAssetExpired(asset, 8 as TurnNumber)).toBe(true);
  });

  it('after expiry returns true', () => {
    const asset: ActiveAsset = { ...baseAsset, lifespan: 5, recruitedTurn: 3 as TurnNumber };
    // expires at turn 3+5=8, turn 10 is after
    expect(IntelligenceOpsEngine.isAssetExpired(asset, 10 as TurnNumber)).toBe(true);
  });

  it('lifespan=1 expires immediately on next turn', () => {
    const asset: ActiveAsset = { ...baseAsset, lifespan: 1, recruitedTurn: 1 as TurnNumber };
    // expires at turn 1+1=2
    expect(IntelligenceOpsEngine.isAssetExpired(asset, 1 as TurnNumber)).toBe(false);
    expect(IntelligenceOpsEngine.isAssetExpired(asset, 2 as TurnNumber)).toBe(true);
  });
});
