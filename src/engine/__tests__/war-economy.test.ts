import { describe, it, expect } from 'vitest';
import { WarEconomyEngine } from '@/engine/war-economy';
import type {
  WarEconomyInput,
  GFSIInput,
  ContagionEffectsInput,
} from '@/engine/war-economy';
import { WarEconomyPhase } from '@/data/types';
import type { FactionId, TurnNumber } from '@/data/types';

const US = 'us' as FactionId;
const RUSSIA = 'russia' as FactionId;
const TURN = 5 as TurnNumber;

// ---------------------------------------------------------------------------
// FR-1707 — evaluateWarEconomy
// ---------------------------------------------------------------------------

describe('WarEconomyEngine.evaluateWarEconomy', () => {
  // ── Peacetime ───────────────────────────────────────────────────────────

  describe('Peacetime phase', () => {
    it('stays Peacetime when not activating — all effects zero', () => {
      const input: WarEconomyInput = {
        factionId: US,
        currentPhase: WarEconomyPhase.Peacetime,
        turnsMobilized: 0,
        turnsInRecession: 0,
        activating: false,
        deactivating: false,
        currentTurn: TURN,
      };

      const result = WarEconomyEngine.evaluateWarEconomy(input);

      expect(result.factionId).toBe(US);
      expect(result.phase).toBe(WarEconomyPhase.Peacetime);
      expect(result.effects.militaryProductionBoost).toBe(0);
      expect(result.effects.treasuryMobilizationBoost).toBe(0);
      expect(result.effects.gdpGrowthModifier).toBe(0);
      expect(result.effects.civilUnrestPerTurn).toBe(0);
      expect(result.effects.legitimacyCost).toBe(0);
    });

    it('transitions to Mobilized when activating — full boosts + legitimacy cost', () => {
      const input: WarEconomyInput = {
        factionId: US,
        currentPhase: WarEconomyPhase.Peacetime,
        turnsMobilized: 0,
        turnsInRecession: 0,
        activating: true,
        deactivating: false,
        currentTurn: TURN,
      };

      const result = WarEconomyEngine.evaluateWarEconomy(input);

      expect(result.factionId).toBe(US);
      expect(result.phase).toBe(WarEconomyPhase.Mobilized);
      expect(result.effects.militaryProductionBoost).toBeCloseTo(0.3);
      expect(result.effects.treasuryMobilizationBoost).toBeCloseTo(0.2);
      expect(result.effects.gdpGrowthModifier).toBe(0);
      expect(result.effects.civilUnrestPerTurn).toBe(3);
      expect(result.effects.legitimacyCost).toBe(-5);
    });
  });

  // ── Mobilized ───────────────────────────────────────────────────────────

  describe('Mobilized phase', () => {
    it('stays Mobilized when not deactivating and under exhaustion threshold (turnsMobilized=5)', () => {
      const input: WarEconomyInput = {
        factionId: RUSSIA,
        currentPhase: WarEconomyPhase.Mobilized,
        turnsMobilized: 5,
        turnsInRecession: 0,
        activating: false,
        deactivating: false,
        currentTurn: TURN,
      };

      const result = WarEconomyEngine.evaluateWarEconomy(input);

      expect(result.factionId).toBe(RUSSIA);
      expect(result.phase).toBe(WarEconomyPhase.Mobilized);
      expect(result.effects.militaryProductionBoost).toBeCloseTo(0.3);
      expect(result.effects.treasuryMobilizationBoost).toBeCloseTo(0.2);
      expect(result.effects.gdpGrowthModifier).toBe(0);
      expect(result.effects.civilUnrestPerTurn).toBe(3);
      expect(result.effects.legitimacyCost).toBe(0);
    });

    it('transitions to Recession when deactivating', () => {
      const input: WarEconomyInput = {
        factionId: US,
        currentPhase: WarEconomyPhase.Mobilized,
        turnsMobilized: 5,
        turnsInRecession: 0,
        activating: false,
        deactivating: true,
        currentTurn: TURN,
      };

      const result = WarEconomyEngine.evaluateWarEconomy(input);

      expect(result.phase).toBe(WarEconomyPhase.Recession);
      expect(result.effects.gdpGrowthModifier).toBeCloseTo(-0.03);
      expect(result.effects.militaryProductionBoost).toBe(0);
      expect(result.effects.treasuryMobilizationBoost).toBe(0);
      expect(result.effects.civilUnrestPerTurn).toBe(0);
      expect(result.effects.legitimacyCost).toBe(0);
    });

    it('transitions to Exhausted when turnsMobilized reaches threshold (12)', () => {
      const input: WarEconomyInput = {
        factionId: RUSSIA,
        currentPhase: WarEconomyPhase.Mobilized,
        turnsMobilized: 12,
        turnsInRecession: 0,
        activating: false,
        deactivating: false,
        currentTurn: TURN,
      };

      const result = WarEconomyEngine.evaluateWarEconomy(input);

      expect(result.phase).toBe(WarEconomyPhase.Exhausted);
      expect(result.effects.militaryProductionBoost).toBeCloseTo(0.3);
      expect(result.effects.treasuryMobilizationBoost).toBe(0);
      expect(result.effects.gdpGrowthModifier).toBeCloseTo(-0.02);
      expect(result.effects.civilUnrestPerTurn).toBe(3);
      expect(result.effects.legitimacyCost).toBe(0);
    });

    it('stays Mobilized when turnsMobilized is just below threshold (11)', () => {
      const input: WarEconomyInput = {
        factionId: RUSSIA,
        currentPhase: WarEconomyPhase.Mobilized,
        turnsMobilized: 11,
        turnsInRecession: 0,
        activating: false,
        deactivating: false,
        currentTurn: TURN,
      };

      const result = WarEconomyEngine.evaluateWarEconomy(input);

      expect(result.phase).toBe(WarEconomyPhase.Mobilized);
      expect(result.effects.militaryProductionBoost).toBeCloseTo(0.3);
      expect(result.effects.treasuryMobilizationBoost).toBeCloseTo(0.2);
      expect(result.effects.gdpGrowthModifier).toBe(0);
    });
  });

  // ── Exhausted ───────────────────────────────────────────────────────────

  describe('Exhausted phase', () => {
    it('stays Exhausted when not deactivating — military boost but no treasury', () => {
      const input: WarEconomyInput = {
        factionId: RUSSIA,
        currentPhase: WarEconomyPhase.Exhausted,
        turnsMobilized: 15,
        turnsInRecession: 0,
        activating: false,
        deactivating: false,
        currentTurn: TURN,
      };

      const result = WarEconomyEngine.evaluateWarEconomy(input);

      expect(result.factionId).toBe(RUSSIA);
      expect(result.phase).toBe(WarEconomyPhase.Exhausted);
      expect(result.effects.militaryProductionBoost).toBeCloseTo(0.3);
      expect(result.effects.treasuryMobilizationBoost).toBe(0);
      expect(result.effects.gdpGrowthModifier).toBeCloseTo(-0.02);
      expect(result.effects.civilUnrestPerTurn).toBe(3);
      expect(result.effects.legitimacyCost).toBe(0);
    });

    it('transitions to Recession when deactivating from Exhausted', () => {
      const input: WarEconomyInput = {
        factionId: US,
        currentPhase: WarEconomyPhase.Exhausted,
        turnsMobilized: 15,
        turnsInRecession: 0,
        activating: false,
        deactivating: true,
        currentTurn: TURN,
      };

      const result = WarEconomyEngine.evaluateWarEconomy(input);

      expect(result.phase).toBe(WarEconomyPhase.Recession);
      expect(result.effects.gdpGrowthModifier).toBeCloseTo(-0.03);
      expect(result.effects.militaryProductionBoost).toBe(0);
      expect(result.effects.treasuryMobilizationBoost).toBe(0);
      expect(result.effects.civilUnrestPerTurn).toBe(0);
      expect(result.effects.legitimacyCost).toBe(0);
    });
  });

  // ── Recession ───────────────────────────────────────────────────────────

  describe('Recession phase', () => {
    it('stays in Recession when turnsInRecession=0 (< 3)', () => {
      const input: WarEconomyInput = {
        factionId: US,
        currentPhase: WarEconomyPhase.Recession,
        turnsMobilized: 0,
        turnsInRecession: 0,
        activating: false,
        deactivating: false,
        currentTurn: TURN,
      };

      const result = WarEconomyEngine.evaluateWarEconomy(input);

      expect(result.phase).toBe(WarEconomyPhase.Recession);
      expect(result.effects.gdpGrowthModifier).toBeCloseTo(-0.03);
      expect(result.effects.militaryProductionBoost).toBe(0);
      expect(result.effects.treasuryMobilizationBoost).toBe(0);
      expect(result.effects.civilUnrestPerTurn).toBe(0);
      expect(result.effects.legitimacyCost).toBe(0);
    });

    it('stays in Recession when turnsInRecession=2 (< 3)', () => {
      const input: WarEconomyInput = {
        factionId: US,
        currentPhase: WarEconomyPhase.Recession,
        turnsMobilized: 0,
        turnsInRecession: 2,
        activating: false,
        deactivating: false,
        currentTurn: TURN,
      };

      const result = WarEconomyEngine.evaluateWarEconomy(input);

      expect(result.phase).toBe(WarEconomyPhase.Recession);
      expect(result.effects.gdpGrowthModifier).toBeCloseTo(-0.03);
    });

    it('transitions to Peacetime when turnsInRecession reaches duration (3)', () => {
      const input: WarEconomyInput = {
        factionId: US,
        currentPhase: WarEconomyPhase.Recession,
        turnsMobilized: 0,
        turnsInRecession: 3,
        activating: false,
        deactivating: false,
        currentTurn: TURN,
      };

      const result = WarEconomyEngine.evaluateWarEconomy(input);

      expect(result.phase).toBe(WarEconomyPhase.Peacetime);
      expect(result.effects.militaryProductionBoost).toBe(0);
      expect(result.effects.treasuryMobilizationBoost).toBe(0);
      expect(result.effects.gdpGrowthModifier).toBe(0);
      expect(result.effects.civilUnrestPerTurn).toBe(0);
      expect(result.effects.legitimacyCost).toBe(0);
    });
  });

  // ── Cross-cutting ───────────────────────────────────────────────────────

  it('result always includes the correct factionId', () => {
    const phases = [
      WarEconomyPhase.Peacetime,
      WarEconomyPhase.Mobilized,
      WarEconomyPhase.Exhausted,
      WarEconomyPhase.Recession,
    ] as const;

    for (const phase of phases) {
      const input: WarEconomyInput = {
        factionId: RUSSIA,
        currentPhase: phase,
        turnsMobilized: 0,
        turnsInRecession: 0,
        activating: false,
        deactivating: false,
        currentTurn: TURN,
      };

      const result = WarEconomyEngine.evaluateWarEconomy(input);
      expect(result.factionId).toBe(RUSSIA);
    }
  });
});

// ---------------------------------------------------------------------------
// FR-1708 — computeGFSI
// ---------------------------------------------------------------------------

describe('WarEconomyEngine.computeGFSI', () => {
  it('returns score=100, no contagion, penalty=0 when no disruptions', () => {
    const input: GFSIInput = {
      activeSanctionsCount: 0,
      activeTradeWarsCount: 0,
      activeCurrencyAttacksCount: 0,
      activeDebtCrisesCount: 0,
      currentTurn: TURN,
    };

    const result = WarEconomyEngine.computeGFSI(input);

    expect(result.score).toBe(100);
    expect(result.contagionActive).toBe(false);
    expect(result.globalGDPPenalty).toBe(0);
  });

  it('2 sanctions → score=90, no contagion', () => {
    const input: GFSIInput = {
      activeSanctionsCount: 2,
      activeTradeWarsCount: 0,
      activeCurrencyAttacksCount: 0,
      activeDebtCrisesCount: 0,
      currentTurn: TURN,
    };

    const result = WarEconomyEngine.computeGFSI(input);

    expect(result.score).toBe(90);
    expect(result.contagionActive).toBe(false);
    expect(result.globalGDPPenalty).toBe(0);
  });

  it('10 sanctions + 2 trade wars → score=34, no contagion', () => {
    const input: GFSIInput = {
      activeSanctionsCount: 10,
      activeTradeWarsCount: 2,
      activeCurrencyAttacksCount: 0,
      activeDebtCrisesCount: 0,
      currentTurn: TURN,
    };

    const result = WarEconomyEngine.computeGFSI(input);

    // 100 - (50 + 16) = 34
    expect(result.score).toBe(34);
    expect(result.contagionActive).toBe(false);
  });

  it('heavy crisis triggers contagion with GDP penalty', () => {
    const input: GFSIInput = {
      activeSanctionsCount: 5,
      activeTradeWarsCount: 3,
      activeCurrencyAttacksCount: 2,
      activeDebtCrisesCount: 2,
      currentTurn: TURN,
    };

    const result = WarEconomyEngine.computeGFSI(input);

    // 100 - (25 + 24 + 20 + 14) = 17
    expect(result.score).toBe(17);
    expect(result.contagionActive).toBe(true);
    expect(result.globalGDPPenalty).toBeCloseTo(-0.02);
  });

  it('all zero counts → score=100', () => {
    const input: GFSIInput = {
      activeSanctionsCount: 0,
      activeTradeWarsCount: 0,
      activeCurrencyAttacksCount: 0,
      activeDebtCrisesCount: 0,
      currentTurn: TURN,
    };

    const result = WarEconomyEngine.computeGFSI(input);
    expect(result.score).toBe(100);
  });

  it('score is clamped to 0 for massive disruption', () => {
    const input: GFSIInput = {
      activeSanctionsCount: 20,
      activeTradeWarsCount: 20,
      activeCurrencyAttacksCount: 20,
      activeDebtCrisesCount: 20,
      currentTurn: TURN,
    };

    const result = WarEconomyEngine.computeGFSI(input);

    // 100 - (100 + 160 + 200 + 140) = -500 → clamped to 0
    expect(result.score).toBe(0);
    expect(result.contagionActive).toBe(true);
  });

  it('score exactly at threshold (30) → contagion inactive', () => {
    // Need score = 30 → total impact = 70
    // 14 sanctions = 70 impact
    const input: GFSIInput = {
      activeSanctionsCount: 14,
      activeTradeWarsCount: 0,
      activeCurrencyAttacksCount: 0,
      activeDebtCrisesCount: 0,
      currentTurn: TURN,
    };

    const result = WarEconomyEngine.computeGFSI(input);

    expect(result.score).toBe(30);
    expect(result.contagionActive).toBe(false);
    expect(result.globalGDPPenalty).toBe(0);
  });

  it('score just below threshold (29) → contagion active', () => {
    // Need score = 29 → total impact = 71
    // 14 sanctions (70) + 1 debt crisis (7) = 77 → score = 23, too low
    // Let's use: impact = 71 → score = 29
    // 13 sanctions = 65, 1 debt crisis = 7 → 72 → score = 28... need exact 71
    // 7 sanctions = 35, 3 trade wars = 24, 1 currency = 10, 1/7 no fractional
    // simplest: use values that give 71 impact → score = 29
    // 5 sanctions(25) + 4 trade wars(32) + 1 currency(10) + 0 debt = 67 → 33
    // 5 sanctions(25) + 4 trade wars(32) + 1 currency(10) + 4/7 no
    // 6 sanctions(30) + 4 trade wars(32) + 0 + 1 debt(7) = 69 → 31
    // 6 sanctions(30) + 4 trade wars(32) + 0 + 1 debt(7) + 1/5 no
    // Direct: 100 - impact = 29 → impact = 71
    // 1 currency(10) + 1 debt(7) + 6 trade wars(48) + 1 sanctions(5) = 70... 
    // + 1 more sanction would be 75. Let's just pick: score will be < 30
    // 8 trade wars(64) + 1 debt(7) = 71 → score = 29
    const input: GFSIInput = {
      activeSanctionsCount: 0,
      activeTradeWarsCount: 8,
      activeCurrencyAttacksCount: 0,
      activeDebtCrisesCount: 1,
      currentTurn: TURN,
    };

    const result = WarEconomyEngine.computeGFSI(input);

    // 100 - (0 + 64 + 0 + 7) = 29
    expect(result.score).toBe(29);
    expect(result.contagionActive).toBe(true);
    expect(result.globalGDPPenalty).toBeCloseTo(-0.02);
  });

  it('contributingFactors are correctly calculated', () => {
    const input: GFSIInput = {
      activeSanctionsCount: 3,
      activeTradeWarsCount: 2,
      activeCurrencyAttacksCount: 1,
      activeDebtCrisesCount: 4,
      currentTurn: TURN,
    };

    const result = WarEconomyEngine.computeGFSI(input);

    expect(result.contributingFactors.sanctionsImpact).toBe(15);
    expect(result.contributingFactors.tradeWarsImpact).toBe(16);
    expect(result.contributingFactors.currencyAttacksImpact).toBe(10);
    expect(result.contributingFactors.debtCrisesImpact).toBe(28);
    // score = 100 - (15+16+10+28) = 31
    expect(result.score).toBe(31);
  });
});

// ---------------------------------------------------------------------------
// FR-1708 — computeContagionEffects
// ---------------------------------------------------------------------------

describe('WarEconomyEngine.computeContagionEffects', () => {
  it('no contagion (score >= 30) → all modifiers zero', () => {
    const input: ContagionEffectsInput = {
      factionId: US,
      gfsiScore: 50,
      factionTradeDependency: 0.5,
      isSafeHavenCurrency: true,
      currentTurn: TURN,
    };

    const result = WarEconomyEngine.computeContagionEffects(input);

    expect(result.factionId).toBe(US);
    expect(result.contagionActive).toBe(false);
    expect(result.gdpPenalty).toBe(0);
    expect(result.currencyStrengthModifier).toBe(0);
  });

  it('contagion (score=20) + tradeDependency 0.5 → gdpPenalty = -0.03', () => {
    const input: ContagionEffectsInput = {
      factionId: RUSSIA,
      gfsiScore: 20,
      factionTradeDependency: 0.5,
      isSafeHavenCurrency: false,
      currentTurn: TURN,
    };

    const result = WarEconomyEngine.computeContagionEffects(input);

    expect(result.contagionActive).toBe(true);
    // -0.02 * (1 + 0.5) = -0.03
    expect(result.gdpPenalty).toBeCloseTo(-0.03);
  });

  it('contagion + tradeDependency 0 → gdpPenalty = -0.02', () => {
    const input: ContagionEffectsInput = {
      factionId: RUSSIA,
      gfsiScore: 10,
      factionTradeDependency: 0,
      isSafeHavenCurrency: false,
      currentTurn: TURN,
    };

    const result = WarEconomyEngine.computeContagionEffects(input);

    expect(result.contagionActive).toBe(true);
    // -0.02 * (1 + 0) = -0.02
    expect(result.gdpPenalty).toBeCloseTo(-0.02);
  });

  it('contagion + tradeDependency 0.8 → gdpPenalty = -0.036', () => {
    const input: ContagionEffectsInput = {
      factionId: RUSSIA,
      gfsiScore: 15,
      factionTradeDependency: 0.8,
      isSafeHavenCurrency: false,
      currentTurn: TURN,
    };

    const result = WarEconomyEngine.computeContagionEffects(input);

    expect(result.contagionActive).toBe(true);
    // -0.02 * (1 + 0.8) = -0.036
    expect(result.gdpPenalty).toBeCloseTo(-0.036);
  });

  it('safe haven during contagion → currencyStrengthModifier = +0.1', () => {
    const input: ContagionEffectsInput = {
      factionId: US,
      gfsiScore: 10,
      factionTradeDependency: 0.3,
      isSafeHavenCurrency: true,
      currentTurn: TURN,
    };

    const result = WarEconomyEngine.computeContagionEffects(input);

    expect(result.contagionActive).toBe(true);
    expect(result.currencyStrengthModifier).toBeCloseTo(0.1);
  });

  it('non-safe haven during contagion → currencyStrengthModifier = -0.1', () => {
    const input: ContagionEffectsInput = {
      factionId: RUSSIA,
      gfsiScore: 10,
      factionTradeDependency: 0.3,
      isSafeHavenCurrency: false,
      currentTurn: TURN,
    };

    const result = WarEconomyEngine.computeContagionEffects(input);

    expect(result.contagionActive).toBe(true);
    expect(result.currencyStrengthModifier).toBeCloseTo(-0.1);
  });

  it('no contagion → currencyStrengthModifier = 0 regardless of safeHaven', () => {
    const input: ContagionEffectsInput = {
      factionId: US,
      gfsiScore: 80,
      factionTradeDependency: 0.5,
      isSafeHavenCurrency: true,
      currentTurn: TURN,
    };

    const result = WarEconomyEngine.computeContagionEffects(input);

    expect(result.contagionActive).toBe(false);
    expect(result.currencyStrengthModifier).toBe(0);
  });

  it('result includes correct factionId', () => {
    const input: ContagionEffectsInput = {
      factionId: RUSSIA,
      gfsiScore: 10,
      factionTradeDependency: 0.4,
      isSafeHavenCurrency: false,
      currentTurn: TURN,
    };

    const result = WarEconomyEngine.computeContagionEffects(input);
    expect(result.factionId).toBe(RUSSIA);
  });

  it('boundary: gfsiScore exactly 30 → no contagion', () => {
    const input: ContagionEffectsInput = {
      factionId: US,
      gfsiScore: 30,
      factionTradeDependency: 0.5,
      isSafeHavenCurrency: true,
      currentTurn: TURN,
    };

    const result = WarEconomyEngine.computeContagionEffects(input);

    expect(result.contagionActive).toBe(false);
    expect(result.gdpPenalty).toBe(0);
    expect(result.currencyStrengthModifier).toBe(0);
  });

  it('boundary: gfsiScore = 29 → contagion active', () => {
    const input: ContagionEffectsInput = {
      factionId: RUSSIA,
      gfsiScore: 29,
      factionTradeDependency: 0.5,
      isSafeHavenCurrency: false,
      currentTurn: TURN,
    };

    const result = WarEconomyEngine.computeContagionEffects(input);

    expect(result.contagionActive).toBe(true);
    expect(result.gdpPenalty).toBeCloseTo(-0.03);
    expect(result.currencyStrengthModifier).toBeCloseTo(-0.1);
  });
});
