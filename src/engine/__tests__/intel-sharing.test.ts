import { describe, it, expect } from 'vitest';
import {
  IntelSharingEngine,
  type IntelSharingPact,
  type SharingBonus,
  type SharingInput,
} from '@/engine/intel-sharing';
import { IntelligenceCapabilityEngine } from '@/engine/intel-capability';
import type { IntelCapability } from '@/engine/intel-capability';
import { FactionId, IntelSubScore } from '@/data/types';

// ── Aliases ──────────────────────────────────────────────────────────────────
const FID = FactionId;
const ISS = IntelSubScore;

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

/** Shorthand factory for IntelSharingPact. */
function makePact(
  factionA: FactionId,
  factionB: FactionId,
  active: boolean,
): IntelSharingPact {
  return { factionA, factionB, active };
}

// ── Engine instance ──────────────────────────────────────────────────────────
const engine = new IntelSharingEngine();

// ═══════════════════════════════════════════════════════════════════════════════
// identifyWeakerPartner
// ═══════════════════════════════════════════════════════════════════════════════

describe('identifyWeakerPartner', () => {
  it('returns A when A has a clearly lower composite sum', () => {
    const capA = makeCap(FID.US, 10, 10, 10, 10); // composite = 40
    const capB = makeCap(FID.China, 50, 50, 50, 50); // composite = 200
    expect(engine.identifyWeakerPartner(capA, capB)).toBe(FID.US);
  });

  it('returns B when B has a clearly lower composite sum', () => {
    const capA = makeCap(FID.US, 80, 80, 80, 80); // composite = 320
    const capB = makeCap(FID.China, 20, 20, 20, 20); // composite = 80
    expect(engine.identifyWeakerPartner(capA, capB)).toBe(FID.China);
  });

  it('returns A (tie-break) when composites are equal', () => {
    const capA = makeCap(FID.US, 50, 50, 50, 50); // composite = 200
    const capB = makeCap(FID.China, 50, 50, 50, 50); // composite = 200
    expect(engine.identifyWeakerPartner(capA, capB)).toBe(FID.US);
  });

  it('returns A (tie-break) when both are at zero', () => {
    const capA = makeCap(FID.Russia, 0, 0, 0, 0); // composite = 0
    const capB = makeCap(FID.EU, 0, 0, 0, 0); // composite = 0
    expect(engine.identifyWeakerPartner(capA, capB)).toBe(FID.Russia);
  });

  it('returns A (tie-break) when both are at max (all 100s)', () => {
    const capA = makeCap(FID.US, 100, 100, 100, 100); // composite = 400
    const capB = makeCap(FID.China, 100, 100, 100, 100); // composite = 400
    expect(engine.identifyWeakerPartner(capA, capB)).toBe(FID.US);
  });

  it('computes composite as simple sum, not weighted', () => {
    // Different sub-score distributions, same sum
    const capA = makeCap(FID.US, 100, 0, 0, 0); // composite = 100
    const capB = makeCap(FID.China, 25, 25, 25, 25); // composite = 100
    // Equal → A is weaker (tie-break)
    expect(engine.identifyWeakerPartner(capA, capB)).toBe(FID.US);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// findLowestSubScore
// ═══════════════════════════════════════════════════════════════════════════════

describe('findLowestSubScore', () => {
  it('returns HUMINT when it is the single lowest', () => {
    const cap = makeCap(FID.US, 10, 50, 50, 50);
    const result = engine.findLowestSubScore(cap);
    expect(result.subScore).toBe(ISS.HUMINT);
    expect(result.value).toBe(10);
  });

  it('returns SIGINT when it is the single lowest', () => {
    const cap = makeCap(FID.US, 50, 5, 50, 50);
    const result = engine.findLowestSubScore(cap);
    expect(result.subScore).toBe(ISS.SIGINT);
    expect(result.value).toBe(5);
  });

  it('returns CYBER when it is the single lowest', () => {
    const cap = makeCap(FID.US, 50, 50, 3, 50);
    const result = engine.findLowestSubScore(cap);
    expect(result.subScore).toBe(ISS.CYBER);
    expect(result.value).toBe(3);
  });

  it('returns COVERT when it is uniquely the lowest', () => {
    const cap = makeCap(FID.US, 50, 50, 50, 2);
    const result = engine.findLowestSubScore(cap);
    expect(result.subScore).toBe(ISS.COVERT);
    expect(result.value).toBe(2);
  });

  it('returns HUMINT on tie between HUMINT and SIGINT (iteration order)', () => {
    const cap = makeCap(FID.US, 10, 10, 50, 50);
    const result = engine.findLowestSubScore(cap);
    expect(result.subScore).toBe(ISS.HUMINT);
    expect(result.value).toBe(10);
  });

  it('returns HUMINT when all sub-scores are equal', () => {
    const cap = makeCap(FID.US, 40, 40, 40, 40);
    const result = engine.findLowestSubScore(cap);
    expect(result.subScore).toBe(ISS.HUMINT);
    expect(result.value).toBe(40);
  });

  it('returns HUMINT when all sub-scores are zero', () => {
    const cap = makeCap(FID.US, 0, 0, 0, 0);
    const result = engine.findLowestSubScore(cap);
    expect(result.subScore).toBe(ISS.HUMINT);
    expect(result.value).toBe(0);
  });

  it('returns SIGINT on tie between SIGINT and COVERT', () => {
    const cap = makeCap(FID.US, 50, 10, 50, 10);
    const result = engine.findLowestSubScore(cap);
    expect(result.subScore).toBe(ISS.SIGINT);
    expect(result.value).toBe(10);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// calculateBonusAmount
// ═══════════════════════════════════════════════════════════════════════════════

describe('calculateBonusAmount', () => {
  it('returns bonusMin (10) when composites are equal (diff=0)', () => {
    const capA = makeCap(FID.US, 50, 50, 50, 50); // composite = 200
    const capB = makeCap(FID.China, 50, 50, 50, 50); // composite = 200
    expect(engine.calculateBonusAmount(capA, capB)).toBeCloseTo(10, 5);
  });

  it('returns bonusMax (15) when diff equals maxStrengthDiff (50)', () => {
    const capA = makeCap(FID.US, 50, 50, 50, 50); // composite = 200
    const capB = makeCap(FID.China, 50, 50, 50, 100); // composite = 250
    expect(engine.calculateBonusAmount(capA, capB)).toBeCloseTo(15, 5);
  });

  it('clamps to bonusMax (15) when diff exceeds maxStrengthDiff', () => {
    const capA = makeCap(FID.US, 50, 50, 50, 50); // composite = 200
    const capB = makeCap(FID.China, 75, 75, 75, 75); // composite = 300
    expect(engine.calculateBonusAmount(capA, capB)).toBeCloseTo(15, 5);
  });

  it('returns 12.5 for mid-range diff of 25', () => {
    const capA = makeCap(FID.US, 50, 50, 50, 50); // composite = 200
    const capB = makeCap(FID.China, 50, 50, 50, 75); // composite = 225
    // bonus = 10 + (25/50)*5 = 12.5
    expect(engine.calculateBonusAmount(capA, capB)).toBeCloseTo(12.5, 5);
  });

  it('returns 11 for small diff of 10', () => {
    const capA = makeCap(FID.US, 50, 50, 50, 50); // composite = 200
    const capB = makeCap(FID.China, 50, 50, 50, 60); // composite = 210
    // bonus = 10 + (10/50)*5 = 11
    expect(engine.calculateBonusAmount(capA, capB)).toBeCloseTo(11, 5);
  });

  it('clamps to bonusMax (15) for very large diff', () => {
    const capA = makeCap(FID.US, 0, 0, 0, 0); // composite = 0
    const capB = makeCap(FID.China, 100, 100, 100, 100); // composite = 400
    expect(engine.calculateBonusAmount(capA, capB)).toBeCloseTo(15, 5);
  });

  it('is symmetric: order of arguments does not change result', () => {
    const capA = makeCap(FID.US, 30, 30, 30, 30); // composite = 120
    const capB = makeCap(FID.China, 60, 60, 60, 60); // composite = 240
    const abBonus = engine.calculateBonusAmount(capA, capB);
    const baBonus = engine.calculateBonusAmount(capB, capA);
    expect(abBonus).toBeCloseTo(baBonus, 5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// computePactBonus
// ═══════════════════════════════════════════════════════════════════════════════

describe('computePactBonus', () => {
  const caps = new Map<FactionId, IntelCapability>([
    [FID.US, makeCap(FID.US, 30, 40, 50, 60)], // composite = 180
    [FID.China, makeCap(FID.China, 60, 70, 80, 90)], // composite = 300
    [FID.Russia, makeCap(FID.Russia, 50, 50, 50, 50)], // composite = 200
  ]);

  it('returns null for an inactive pact', () => {
    const pact = makePact(FID.US, FID.China, false);
    expect(engine.computePactBonus(pact, caps)).toBeNull();
  });

  it('returns null when factionA is missing from capabilities', () => {
    const pact = makePact(FID.EU, FID.China, true);
    expect(engine.computePactBonus(pact, caps)).toBeNull();
  });

  it('returns null when factionB is missing from capabilities', () => {
    const pact = makePact(FID.US, FID.EU, true);
    expect(engine.computePactBonus(pact, caps)).toBeNull();
  });

  it('returns correct beneficiary when A is weaker', () => {
    // US composite=180, China composite=300 → US is weaker
    const pact = makePact(FID.US, FID.China, true);
    const bonus = engine.computePactBonus(pact, caps);
    expect(bonus).not.toBeNull();
    expect(bonus!.beneficiaryFaction).toBe(FID.US);
    expect(bonus!.partnerFaction).toBe(FID.China);
  });

  it('returns correct beneficiary when B is weaker', () => {
    // China composite=300, US composite=180 → US is still weaker (factionB)
    const pact = makePact(FID.China, FID.US, true);
    const bonus = engine.computePactBonus(pact, caps);
    expect(bonus).not.toBeNull();
    expect(bonus!.beneficiaryFaction).toBe(FID.US);
    expect(bonus!.partnerFaction).toBe(FID.China);
  });

  it('targets the lowest sub-score of the weaker partner', () => {
    // US: humint=30 is the lowest sub-score
    const pact = makePact(FID.US, FID.China, true);
    const bonus = engine.computePactBonus(pact, caps);
    expect(bonus).not.toBeNull();
    expect(bonus!.targetSubScore).toBe(ISS.HUMINT);
  });

  it('returns A as beneficiary on equal composites (tie-break)', () => {
    const equalCaps = new Map<FactionId, IntelCapability>([
      [FID.US, makeCap(FID.US, 50, 50, 50, 50)], // composite = 200
      [FID.Russia, makeCap(FID.Russia, 50, 50, 50, 50)], // composite = 200
    ]);
    const pact = makePact(FID.US, FID.Russia, true);
    const bonus = engine.computePactBonus(pact, equalCaps);
    expect(bonus).not.toBeNull();
    expect(bonus!.beneficiaryFaction).toBe(FID.US);
    expect(bonus!.partnerFaction).toBe(FID.Russia);
  });

  it('includes a descriptive reason string', () => {
    const pact = makePact(FID.US, FID.China, true);
    const bonus = engine.computePactBonus(pact, caps);
    expect(bonus).not.toBeNull();
    expect(bonus!.reason).toContain('Intel-sharing pact');
    expect(bonus!.reason.length).toBeGreaterThan(0);
  });

  it('calculates the correct bonus amount', () => {
    // US composite=180, China composite=300 → diff=120 → clamped bonus=15
    const pact = makePact(FID.US, FID.China, true);
    const bonus = engine.computePactBonus(pact, caps);
    expect(bonus).not.toBeNull();
    expect(bonus!.bonusAmount).toBeCloseTo(15, 5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// applyAllPacts
// ═══════════════════════════════════════════════════════════════════════════════

describe('applyAllPacts', () => {
  it('returns no bonuses and unchanged capabilities for empty pacts array', () => {
    const caps = new Map<FactionId, IntelCapability>([
      [FID.US, makeCap(FID.US, 50, 50, 50, 50)],
    ]);
    const input: SharingInput = { pacts: [], capabilities: caps };
    const result = engine.applyAllPacts(input);

    expect(result.bonuses).toHaveLength(0);
    const adjusted = result.adjustedCapabilities.get(FID.US)!;
    expect(adjusted.humint).toBe(50);
    expect(adjusted.sigint).toBe(50);
    expect(adjusted.cyber).toBe(50);
    expect(adjusted.covert).toBe(50);
  });

  it('boosts weaker partner lowest sub-score for a single active pact', () => {
    const caps = new Map<FactionId, IntelCapability>([
      [FID.US, makeCap(FID.US, 20, 40, 40, 40)], // composite=140, lowest=humint(20)
      [FID.China, makeCap(FID.China, 50, 50, 50, 50)], // composite=200
    ]);
    // diff=60 → clamped to bonusMax=15
    const input: SharingInput = {
      pacts: [makePact(FID.US, FID.China, true)],
      capabilities: caps,
    };
    const result = engine.applyAllPacts(input);

    expect(result.bonuses).toHaveLength(1);
    const adjusted = result.adjustedCapabilities.get(FID.US)!;
    expect(adjusted.humint).toBeCloseTo(35, 5); // 20 + 15
  });

  it('stacks bonuses from two pacts benefiting the same faction', () => {
    const caps = new Map<FactionId, IntelCapability>([
      [FID.US, makeCap(FID.US, 20, 50, 50, 50)], // composite=170, lowest=humint(20)
      [FID.China, makeCap(FID.China, 50, 50, 50, 50)], // composite=200
      [FID.Russia, makeCap(FID.Russia, 60, 60, 60, 60)], // composite=240
    ]);
    const input: SharingInput = {
      pacts: [
        makePact(FID.US, FID.China, true),
        makePact(FID.US, FID.Russia, true),
      ],
      capabilities: caps,
    };
    const result = engine.applyAllPacts(input);

    expect(result.bonuses).toHaveLength(2);
    // Both target humint on US; bonuses stack
    const adjusted = result.adjustedCapabilities.get(FID.US)!;
    expect(adjusted.humint).toBeGreaterThan(20);
    // Each bonus is at least 10 → stacked at least 40
    expect(adjusted.humint).toBeGreaterThanOrEqual(40);
  });

  it('only processes active pacts (mixed active/inactive)', () => {
    const caps = new Map<FactionId, IntelCapability>([
      [FID.US, makeCap(FID.US, 20, 50, 50, 50)],
      [FID.China, makeCap(FID.China, 50, 50, 50, 50)],
    ]);
    const input: SharingInput = {
      pacts: [
        makePact(FID.US, FID.China, true),
        makePact(FID.US, FID.China, false),
      ],
      capabilities: caps,
    };
    const result = engine.applyAllPacts(input);

    expect(result.bonuses).toHaveLength(1);
  });

  it('clamps sub-score to 100 when bonus would exceed cap', () => {
    const caps = new Map<FactionId, IntelCapability>([
      [FID.US, makeCap(FID.US, 95, 95, 95, 95)], // composite=380, all at 95
      [FID.China, makeCap(FID.China, 100, 100, 100, 100)], // composite=400
    ]);
    // diff=20 → bonus=10+(20/50)*5 = 12
    const input: SharingInput = {
      pacts: [makePact(FID.US, FID.China, true)],
      capabilities: caps,
    };
    const result = engine.applyAllPacts(input);

    expect(result.bonuses).toHaveLength(1);
    const adjusted = result.adjustedCapabilities.get(FID.US)!;
    // 95 + 12 = 107 → clamped to 100
    expect(adjusted.humint).toBe(100);
  });

  it('preserves original capability for factions with no pacts', () => {
    const caps = new Map<FactionId, IntelCapability>([
      [FID.US, makeCap(FID.US, 20, 50, 50, 50)],
      [FID.China, makeCap(FID.China, 50, 50, 50, 50)],
      [FID.Russia, makeCap(FID.Russia, 70, 70, 70, 70)],
    ]);
    const input: SharingInput = {
      pacts: [makePact(FID.US, FID.China, true)],
      capabilities: caps,
    };
    const result = engine.applyAllPacts(input);

    const russiaAdj = result.adjustedCapabilities.get(FID.Russia)!;
    expect(russiaAdj.humint).toBe(70);
    expect(russiaAdj.sigint).toBe(70);
    expect(russiaAdj.cyber).toBe(70);
    expect(russiaAdj.covert).toBe(70);
  });

  it('handles multiple factions each benefiting from different pacts', () => {
    const caps = new Map<FactionId, IntelCapability>([
      [FID.US, makeCap(FID.US, 10, 50, 50, 50)], // composite=160
      [FID.China, makeCap(FID.China, 50, 50, 50, 50)], // composite=200
      [FID.Russia, makeCap(FID.Russia, 40, 40, 10, 40)], // composite=130
      [FID.EU, makeCap(FID.EU, 60, 60, 60, 60)], // composite=240
    ]);
    const input: SharingInput = {
      pacts: [
        makePact(FID.US, FID.China, true), // US benefits
        makePact(FID.Russia, FID.EU, true), // Russia benefits
      ],
      capabilities: caps,
    };
    const result = engine.applyAllPacts(input);

    expect(result.bonuses).toHaveLength(2);
    // US gets boost to humint (lowest = 10)
    const usAdj = result.adjustedCapabilities.get(FID.US)!;
    expect(usAdj.humint).toBeGreaterThan(10);
    // Russia gets boost to cyber (lowest = 10)
    const rusAdj = result.adjustedCapabilities.get(FID.Russia)!;
    expect(rusAdj.cyber).toBeGreaterThan(10);
  });

  it('gracefully skips pacts with missing capability data', () => {
    const caps = new Map<FactionId, IntelCapability>([
      [FID.US, makeCap(FID.US, 20, 50, 50, 50)],
    ]);
    const input: SharingInput = {
      pacts: [makePact(FID.US, FID.China, true)], // China missing
      capabilities: caps,
    };
    const result = engine.applyAllPacts(input);

    expect(result.bonuses).toHaveLength(0);
    // US capability unchanged
    const usAdj = result.adjustedCapabilities.get(FID.US)!;
    expect(usAdj.humint).toBe(20);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// revokePact
// ═══════════════════════════════════════════════════════════════════════════════

describe('revokePact', () => {
  const baseCaps = new Map<FactionId, IntelCapability>([
    [FID.US, makeCap(FID.US, 20, 50, 50, 50)], // composite=170
    [FID.China, makeCap(FID.China, 50, 50, 50, 50)], // composite=200
    [FID.Russia, makeCap(FID.Russia, 60, 60, 60, 60)], // composite=240
  ]);

  it('restores original capabilities when revoking the only pact', () => {
    // First apply a pact
    const pact = makePact(FID.US, FID.China, true);
    const applied = engine.applyAllPacts({ pacts: [pact], capabilities: baseCaps });
    expect(applied.bonuses).toHaveLength(1);

    // Revoke it
    const result = engine.revokePact(pact, applied.bonuses, baseCaps);
    expect(result.bonuses).toHaveLength(0);

    const usAdj = result.adjustedCapabilities.get(FID.US)!;
    expect(usAdj.humint).toBe(20);
    expect(usAdj.sigint).toBe(50);
    expect(usAdj.cyber).toBe(50);
    expect(usAdj.covert).toBe(50);
  });

  it('preserves remaining pact bonuses when revoking one of two', () => {
    const pact1 = makePact(FID.US, FID.China, true);
    const pact2 = makePact(FID.US, FID.Russia, true);
    const applied = engine.applyAllPacts({
      pacts: [pact1, pact2],
      capabilities: baseCaps,
    });
    expect(applied.bonuses).toHaveLength(2);

    // Revoke pact1 only
    const result = engine.revokePact(pact1, applied.bonuses, baseCaps);
    expect(result.bonuses).toHaveLength(1);
    expect(result.bonuses[0]!.partnerFaction).toBe(FID.Russia);

    // US still benefits from pact2
    const usAdj = result.adjustedCapabilities.get(FID.US)!;
    expect(usAdj.humint).toBeGreaterThan(20);
  });

  it('leaves bonuses unchanged when revoked pact does not match any bonuses', () => {
    const pact1 = makePact(FID.US, FID.China, true);
    const applied = engine.applyAllPacts({ pacts: [pact1], capabilities: baseCaps });

    // Revoke a pact that was never applied
    const unrelatedPact = makePact(FID.Russia, FID.EU, true);
    const result = engine.revokePact(unrelatedPact, applied.bonuses, baseCaps);
    expect(result.bonuses).toHaveLength(1);
  });

  it('preserves other factions bonuses when revoking a specific pact', () => {
    const caps = new Map<FactionId, IntelCapability>([
      [FID.US, makeCap(FID.US, 20, 50, 50, 50)], // composite=170
      [FID.China, makeCap(FID.China, 50, 50, 50, 50)], // composite=200
      [FID.Russia, makeCap(FID.Russia, 30, 60, 60, 60)], // composite=210
      [FID.EU, makeCap(FID.EU, 70, 70, 70, 70)], // composite=280
    ]);
    const pactUS = makePact(FID.US, FID.China, true);
    const pactRUS = makePact(FID.Russia, FID.EU, true);
    const applied = engine.applyAllPacts({
      pacts: [pactUS, pactRUS],
      capabilities: caps,
    });

    // Revoke US-China pact; Russia-EU should remain
    const result = engine.revokePact(pactUS, applied.bonuses, caps);
    const rusBonus = result.bonuses.find((b) => b.beneficiaryFaction === FID.Russia);
    expect(rusBonus).toBeDefined();
    const rusAdj = result.adjustedCapabilities.get(FID.Russia)!;
    expect(rusAdj.humint).toBeGreaterThan(30);
  });

  it('recalculates adjusted capabilities correctly after revocation', () => {
    const pact = makePact(FID.US, FID.China, true);
    const applied = engine.applyAllPacts({ pacts: [pact], capabilities: baseCaps });
    const boostedHumint = applied.adjustedCapabilities.get(FID.US)!.humint;
    expect(boostedHumint).toBeGreaterThan(20);

    const result = engine.revokePact(pact, applied.bonuses, baseCaps);
    const restoredHumint = result.adjustedCapabilities.get(FID.US)!.humint;
    expect(restoredHumint).toBe(20); // Back to original
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// getClarityBonus
// ═══════════════════════════════════════════════════════════════════════════════

describe('getClarityBonus', () => {
  it('returns totalSharingBonus=0 for a faction with no bonuses', () => {
    const result = engine.getClarityBonus(FID.US, []);
    expect(result.factionId).toBe(FID.US);
    expect(result.totalSharingBonus).toBe(0);
  });

  it('returns the bonus amount when faction has a single bonus', () => {
    const bonuses: SharingBonus[] = [
      {
        beneficiaryFaction: FID.US,
        partnerFaction: FID.China,
        targetSubScore: ISS.HUMINT,
        bonusAmount: 12,
        reason: 'test',
      },
    ];
    const result = engine.getClarityBonus(FID.US, bonuses);
    expect(result.totalSharingBonus).toBeCloseTo(12, 5);
  });

  it('sums all bonus amounts when faction has multiple bonuses', () => {
    const bonuses: SharingBonus[] = [
      {
        beneficiaryFaction: FID.US,
        partnerFaction: FID.China,
        targetSubScore: ISS.HUMINT,
        bonusAmount: 10,
        reason: 'pact1',
      },
      {
        beneficiaryFaction: FID.US,
        partnerFaction: FID.Russia,
        targetSubScore: ISS.HUMINT,
        bonusAmount: 13,
        reason: 'pact2',
      },
    ];
    const result = engine.getClarityBonus(FID.US, bonuses);
    expect(result.totalSharingBonus).toBeCloseTo(23, 5);
  });

  it('returns 0 for a non-beneficiary faction', () => {
    const bonuses: SharingBonus[] = [
      {
        beneficiaryFaction: FID.US,
        partnerFaction: FID.China,
        targetSubScore: ISS.HUMINT,
        bonusAmount: 15,
        reason: 'test',
      },
    ];
    const result = engine.getClarityBonus(FID.China, bonuses);
    expect(result.factionId).toBe(FID.China);
    expect(result.totalSharingBonus).toBe(0);
  });

  it('only sums bonuses for the specified faction, not others', () => {
    const bonuses: SharingBonus[] = [
      {
        beneficiaryFaction: FID.US,
        partnerFaction: FID.China,
        targetSubScore: ISS.HUMINT,
        bonusAmount: 10,
        reason: 'pact1',
      },
      {
        beneficiaryFaction: FID.Russia,
        partnerFaction: FID.EU,
        targetSubScore: ISS.CYBER,
        bonusAmount: 14,
        reason: 'pact2',
      },
    ];
    const usResult = engine.getClarityBonus(FID.US, bonuses);
    expect(usResult.totalSharingBonus).toBeCloseTo(10, 5);
    const rusResult = engine.getClarityBonus(FID.Russia, bonuses);
    expect(rusResult.totalSharingBonus).toBeCloseTo(14, 5);
  });
});
