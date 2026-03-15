import { describe, it, expect } from 'vitest';
import {
  MilitaryDoctrineEngine,
  type HexContext,
} from '@/engine/military-doctrine';
import { FactionId, DoctrineId } from '@/data/types';

// ── Helper ──────────────────────────────────────────────────────────────────

const engine = new MilitaryDoctrineEngine();

function makeHex(overrides?: Partial<HexContext>): HexContext {
  return {
    isHomeTerritory: false,
    isIslandChain: false,
    isLittoralHex: false,
    isCoastalHex: false,
    isAlliedTerritory: false,
    isNavalEngagement: false,
    combatTurnCount: 0,
    ...overrides,
  };
}

// ── getDoctrineForFaction ───────────────────────────────────────────────────

describe('MilitaryDoctrineEngine.getDoctrineForFaction', () => {
  it('China → A2AD', () => {
    expect(engine.getDoctrineForFaction(FactionId.China)).toBe(DoctrineId.A2AD);
  });

  it('Iran → AsymmetricSwarm', () => {
    expect(engine.getDoctrineForFaction(FactionId.Iran)).toBe(DoctrineId.AsymmetricSwarm);
  });

  it('DPRK → FortressKorea', () => {
    expect(engine.getDoctrineForFaction(FactionId.DPRK)).toBe(DoctrineId.FortressKorea);
  });

  it('US → GlobalReach', () => {
    expect(engine.getDoctrineForFaction(FactionId.US)).toBe(DoctrineId.GlobalReach);
  });

  it('Russia → EscalationDominance', () => {
    expect(engine.getDoctrineForFaction(FactionId.Russia)).toBe(DoctrineId.EscalationDominance);
  });

  it('EU → CollectiveDefense', () => {
    expect(engine.getDoctrineForFaction(FactionId.EU)).toBe(DoctrineId.CollectiveDefense);
  });

  it('Japan → MaritimeShield', () => {
    expect(engine.getDoctrineForFaction(FactionId.Japan)).toBe(DoctrineId.MaritimeShield);
  });

  it('Syria → null (no doctrine)', () => {
    expect(engine.getDoctrineForFaction(FactionId.Syria)).toBeNull();
  });
});

// ── computeDoctrineBonus — A2AD ─────────────────────────────────────────────

describe('computeDoctrineBonus — A2AD', () => {
  it('grants +0.3 defense on island chain hex', () => {
    const bonus = engine.computeDoctrineBonus(DoctrineId.A2AD, makeHex({ isIslandChain: true }));
    expect(bonus.defenseModifier).toBeCloseTo(0.3, 5);
    expect(bonus.active).toBe(true);
  });

  it('grants 0 defense off island chain', () => {
    const bonus = engine.computeDoctrineBonus(DoctrineId.A2AD, makeHex());
    expect(bonus.defenseModifier).toBeCloseTo(0, 5);
    expect(bonus.active).toBe(false);
  });

  it('has correct label', () => {
    const bonus = engine.computeDoctrineBonus(DoctrineId.A2AD, makeHex());
    expect(bonus.label).toBe('A2/AD');
  });
});

// ── computeDoctrineBonus — AsymmetricSwarm ──────────────────────────────────

describe('computeDoctrineBonus — AsymmetricSwarm', () => {
  it('grants +0.2 defense when littoral + naval engagement', () => {
    const bonus = engine.computeDoctrineBonus(
      DoctrineId.AsymmetricSwarm,
      makeHex({ isLittoralHex: true, isNavalEngagement: true }),
    );
    expect(bonus.defenseModifier).toBeCloseTo(0.2, 5);
    expect(bonus.attackModifier).toBeCloseTo(0, 5);
    expect(bonus.active).toBe(true);
  });

  it('grants +0.2 attack when naval engagement only (not littoral)', () => {
    const bonus = engine.computeDoctrineBonus(
      DoctrineId.AsymmetricSwarm,
      makeHex({ isNavalEngagement: true }),
    );
    expect(bonus.attackModifier).toBeCloseTo(0.2, 5);
    expect(bonus.defenseModifier).toBeCloseTo(0, 5);
    expect(bonus.active).toBe(true);
  });

  it('grants 0 when neither naval nor littoral', () => {
    const bonus = engine.computeDoctrineBonus(DoctrineId.AsymmetricSwarm, makeHex());
    expect(bonus.attackModifier).toBeCloseTo(0, 5);
    expect(bonus.defenseModifier).toBeCloseTo(0, 5);
    expect(bonus.active).toBe(false);
  });

  it('has correct label', () => {
    const bonus = engine.computeDoctrineBonus(DoctrineId.AsymmetricSwarm, makeHex());
    expect(bonus.label).toBe('Asymmetric Swarm');
  });
});

// ── computeDoctrineBonus — FortressKorea ────────────────────────────────────

describe('computeDoctrineBonus — FortressKorea', () => {
  it('grants +0.4 defense on home territory', () => {
    const bonus = engine.computeDoctrineBonus(
      DoctrineId.FortressKorea,
      makeHex({ isHomeTerritory: true }),
    );
    expect(bonus.defenseModifier).toBeCloseTo(0.4, 5);
    expect(bonus.active).toBe(true);
  });

  it('grants 0 defense off home territory', () => {
    const bonus = engine.computeDoctrineBonus(DoctrineId.FortressKorea, makeHex());
    expect(bonus.defenseModifier).toBeCloseTo(0, 5);
    expect(bonus.active).toBe(false);
  });

  it('has correct label', () => {
    const bonus = engine.computeDoctrineBonus(DoctrineId.FortressKorea, makeHex());
    expect(bonus.label).toBe('Fortress Korea');
  });
});

// ── computeDoctrineBonus — GlobalReach ──────────────────────────────────────

describe('computeDoctrineBonus — GlobalReach', () => {
  it('always grants projection=3, attack=0.1', () => {
    const bonus = engine.computeDoctrineBonus(DoctrineId.GlobalReach, makeHex());
    expect(bonus.projectionBonus).toBeCloseTo(3, 5);
    expect(bonus.attackModifier).toBeCloseTo(0.1, 5);
    expect(bonus.active).toBe(true);
  });

  it('is active even on a fully neutral hex', () => {
    const bonus = engine.computeDoctrineBonus(DoctrineId.GlobalReach, makeHex());
    expect(bonus.active).toBe(true);
  });
});

// ── computeDoctrineBonus — EscalationDominance ──────────────────────────────

describe('computeDoctrineBonus — EscalationDominance', () => {
  it('grants +0.15 defense + nuclearPressure=5 on home territory', () => {
    const bonus = engine.computeDoctrineBonus(
      DoctrineId.EscalationDominance,
      makeHex({ isHomeTerritory: true }),
    );
    expect(bonus.defenseModifier).toBeCloseTo(0.15, 5);
    expect(bonus.nuclearPressure).toBeCloseTo(5, 5);
    expect(bonus.active).toBe(true);
  });

  it('grants 0 defense but nuclearPressure=5 off home territory', () => {
    const bonus = engine.computeDoctrineBonus(DoctrineId.EscalationDominance, makeHex());
    expect(bonus.defenseModifier).toBeCloseTo(0, 5);
    expect(bonus.nuclearPressure).toBeCloseTo(5, 5);
  });

  it('is active off home territory due to nuclear pressure', () => {
    const bonus = engine.computeDoctrineBonus(DoctrineId.EscalationDominance, makeHex());
    expect(bonus.active).toBe(true);
  });
});

// ── computeDoctrineBonus — CollectiveDefense ────────────────────────────────

describe('computeDoctrineBonus — CollectiveDefense', () => {
  it('grants +0.2 defense + readinessDecayModifier=0.5 on allied territory', () => {
    const bonus = engine.computeDoctrineBonus(
      DoctrineId.CollectiveDefense,
      makeHex({ isAlliedTerritory: true }),
    );
    expect(bonus.defenseModifier).toBeCloseTo(0.2, 5);
    expect(bonus.readinessDecayModifier).toBeCloseTo(0.5, 5);
    expect(bonus.active).toBe(true);
  });

  it('grants 0 defense but readinessDecayModifier=0.5 off allied territory', () => {
    const bonus = engine.computeDoctrineBonus(DoctrineId.CollectiveDefense, makeHex());
    expect(bonus.defenseModifier).toBeCloseTo(0, 5);
    expect(bonus.readinessDecayModifier).toBeCloseTo(0.5, 5);
  });

  it('is active off allied territory due to decay modifier', () => {
    const bonus = engine.computeDoctrineBonus(DoctrineId.CollectiveDefense, makeHex());
    expect(bonus.active).toBe(true);
  });
});

// ── computeDoctrineBonus — MaritimeShield ───────────────────────────────────

describe('computeDoctrineBonus — MaritimeShield', () => {
  it('grants +0.25 defense on coastal + naval engagement', () => {
    const bonus = engine.computeDoctrineBonus(
      DoctrineId.MaritimeShield,
      makeHex({ isCoastalHex: true, isNavalEngagement: true }),
    );
    expect(bonus.defenseModifier).toBeCloseTo(0.25, 5);
    expect(bonus.active).toBe(true);
  });

  it('grants 0 defense when only coastal (no naval)', () => {
    const bonus = engine.computeDoctrineBonus(
      DoctrineId.MaritimeShield,
      makeHex({ isCoastalHex: true }),
    );
    expect(bonus.defenseModifier).toBeCloseTo(0, 5);
    expect(bonus.active).toBe(false);
  });

  it('grants 0 defense when only naval (no coastal)', () => {
    const bonus = engine.computeDoctrineBonus(
      DoctrineId.MaritimeShield,
      makeHex({ isNavalEngagement: true }),
    );
    expect(bonus.defenseModifier).toBeCloseTo(0, 5);
    expect(bonus.active).toBe(false);
  });
});

// ── computeDoctrineBonus — StrategicPatience ────────────────────────────────

describe('computeDoctrineBonus — StrategicPatience', () => {
  it('grants attrition=-0.2, attack=0 when combatTurnCount=0', () => {
    const bonus = engine.computeDoctrineBonus(
      DoctrineId.StrategicPatience,
      makeHex({ combatTurnCount: 0 }),
    );
    expect(bonus.attritionModifier).toBeCloseTo(-0.2, 5);
    expect(bonus.attackModifier).toBeCloseTo(0, 5);
    expect(bonus.active).toBe(true);
  });

  it('grants attrition=-0.2, attack=0.1 when combatTurnCount=3', () => {
    const bonus = engine.computeDoctrineBonus(
      DoctrineId.StrategicPatience,
      makeHex({ combatTurnCount: 3 }),
    );
    expect(bonus.attritionModifier).toBeCloseTo(-0.2, 5);
    expect(bonus.attackModifier).toBeCloseTo(0.1, 5);
    expect(bonus.active).toBe(true);
  });

  it('grants attack=0.1 when combatTurnCount=5', () => {
    const bonus = engine.computeDoctrineBonus(
      DoctrineId.StrategicPatience,
      makeHex({ combatTurnCount: 5 }),
    );
    expect(bonus.attackModifier).toBeCloseTo(0.1, 5);
  });
});

// ── computeReadinessDecay ───────────────────────────────────────────────────

describe('MilitaryDoctrineEngine.computeReadinessDecay', () => {
  it('no combat, no low treasury → totalDecay=0, readiness unchanged', () => {
    const result = engine.computeReadinessDecay({
      factionId: FactionId.US,
      currentReadiness: 80,
      isInActiveCombat: false,
      isTreasuryLow: false,
      doctrineBonus: null,
    });
    expect(result.combatDecay).toBeCloseTo(0, 5);
    expect(result.treasuryDecay).toBeCloseTo(0, 5);
    expect(result.totalDecay).toBeCloseTo(0, 5);
    expect(result.newReadiness).toBeCloseTo(80, 5);
  });

  it('active combat only → totalDecay=-2', () => {
    const result = engine.computeReadinessDecay({
      factionId: FactionId.US,
      currentReadiness: 80,
      isInActiveCombat: true,
      isTreasuryLow: false,
      doctrineBonus: null,
    });
    expect(result.combatDecay).toBeCloseTo(-2, 5);
    expect(result.treasuryDecay).toBeCloseTo(0, 5);
    expect(result.totalDecay).toBeCloseTo(-2, 5);
    expect(result.newReadiness).toBeCloseTo(78, 5);
  });

  it('low treasury only → totalDecay=-1', () => {
    const result = engine.computeReadinessDecay({
      factionId: FactionId.US,
      currentReadiness: 80,
      isInActiveCombat: false,
      isTreasuryLow: true,
      doctrineBonus: null,
    });
    expect(result.combatDecay).toBeCloseTo(0, 5);
    expect(result.treasuryDecay).toBeCloseTo(-1, 5);
    expect(result.totalDecay).toBeCloseTo(-1, 5);
    expect(result.newReadiness).toBeCloseTo(79, 5);
  });

  it('both combat and low treasury → totalDecay=-3', () => {
    const result = engine.computeReadinessDecay({
      factionId: FactionId.US,
      currentReadiness: 80,
      isInActiveCombat: true,
      isTreasuryLow: true,
      doctrineBonus: null,
    });
    expect(result.combatDecay).toBeCloseTo(-2, 5);
    expect(result.treasuryDecay).toBeCloseTo(-1, 5);
    expect(result.totalDecay).toBeCloseTo(-3, 5);
    expect(result.newReadiness).toBeCloseTo(77, 5);
  });

  it('EU doctrine modifier 0.5 halves decay: rawDecay=-3, totalDecay=-1.5', () => {
    const euBonus = engine.computeDoctrineBonus(
      DoctrineId.CollectiveDefense,
      makeHex({ isAlliedTerritory: true }),
    );
    const result = engine.computeReadinessDecay({
      factionId: FactionId.EU,
      currentReadiness: 80,
      isInActiveCombat: true,
      isTreasuryLow: true,
      doctrineBonus: euBonus,
    });
    expect(result.combatDecay).toBeCloseTo(-2, 5);
    expect(result.treasuryDecay).toBeCloseTo(-1, 5);
    expect(result.totalDecay).toBeCloseTo(-1.5, 5);
    expect(result.newReadiness).toBeCloseTo(78.5, 5);
  });

  it('readiness drops to low: current=31, combat → new=29, isLow=true', () => {
    const result = engine.computeReadinessDecay({
      factionId: FactionId.US,
      currentReadiness: 31,
      isInActiveCombat: true,
      isTreasuryLow: false,
      doctrineBonus: null,
    });
    expect(result.newReadiness).toBeCloseTo(29, 5);
    expect(result.isLowReadiness).toBe(true);
    expect(result.combatPenalty).toBeCloseTo(-0.25, 5);
  });

  it('readiness clamped to 0: current=1, both → clamp(1-3, 0, 100)=0', () => {
    const result = engine.computeReadinessDecay({
      factionId: FactionId.US,
      currentReadiness: 1,
      isInActiveCombat: true,
      isTreasuryLow: true,
      doctrineBonus: null,
    });
    expect(result.newReadiness).toBeCloseTo(0, 5);
    expect(result.isLowReadiness).toBe(true);
  });

  it('readiness clamped to 100 when decay is 0', () => {
    const result = engine.computeReadinessDecay({
      factionId: FactionId.US,
      currentReadiness: 100,
      isInActiveCombat: false,
      isTreasuryLow: false,
      doctrineBonus: null,
    });
    expect(result.newReadiness).toBeCloseTo(100, 5);
    expect(result.isLowReadiness).toBe(false);
  });
});

// ── computeCombatModifier ───────────────────────────────────────────────────

describe('MilitaryDoctrineEngine.computeCombatModifier', () => {
  it('high readiness + active doctrine: totalAttack = doctrine.attack + 0', () => {
    const result = engine.computeCombatModifier({
      factionId: FactionId.US,
      doctrineId: DoctrineId.GlobalReach,
      hexContext: makeHex(),
      readiness: 80,
    });
    expect(result.readinessPenalty).toBeCloseTo(0, 5);
    expect(result.totalAttackModifier).toBeCloseTo(0.1, 5);
  });

  it('low readiness + active doctrine: totalAttack = doctrine.attack + (-0.25)', () => {
    const result = engine.computeCombatModifier({
      factionId: FactionId.US,
      doctrineId: DoctrineId.GlobalReach,
      hexContext: makeHex(),
      readiness: 20,
    });
    expect(result.readinessPenalty).toBeCloseTo(-0.25, 5);
    expect(result.totalAttackModifier).toBeCloseTo(0.1 + (-0.25), 5);
  });

  it('defense modifier combined correctly', () => {
    const result = engine.computeCombatModifier({
      factionId: FactionId.DPRK,
      doctrineId: DoctrineId.FortressKorea,
      hexContext: makeHex({ isHomeTerritory: true }),
      readiness: 20,
    });
    expect(result.totalDefenseModifier).toBeCloseTo(0.4 + (-0.25), 5);
  });

  it('returns correct factionId', () => {
    const result = engine.computeCombatModifier({
      factionId: FactionId.Japan,
      doctrineId: DoctrineId.MaritimeShield,
      hexContext: makeHex({ isCoastalHex: true, isNavalEngagement: true }),
      readiness: 80,
    });
    expect(result.factionId).toBe(FactionId.Japan);
  });
});

// ── isLowReadiness ──────────────────────────────────────────────────────────

describe('MilitaryDoctrineEngine.isLowReadiness', () => {
  it('29 → true', () => {
    expect(engine.isLowReadiness(29)).toBe(true);
  });

  it('30 → false', () => {
    expect(engine.isLowReadiness(30)).toBe(false);
  });

  it('0 → true', () => {
    expect(engine.isLowReadiness(0)).toBe(true);
  });
});

// ── getLowReadinessPenalty ───────────────────────────────────────────────────

describe('MilitaryDoctrineEngine.getLowReadinessPenalty', () => {
  it('29 → -0.25', () => {
    expect(engine.getLowReadinessPenalty(29)).toBeCloseTo(-0.25, 5);
  });

  it('30 → 0', () => {
    expect(engine.getLowReadinessPenalty(30)).toBeCloseTo(0, 5);
  });

  it('100 → 0', () => {
    expect(engine.getLowReadinessPenalty(100)).toBeCloseTo(0, 5);
  });
});
