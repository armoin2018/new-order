import { describe, it, expect, beforeEach } from 'vitest';
import { TradeWarfareEngine } from '@/engine/trade-warfare';
import { FactionId } from '@/data/types';
import type { FactionId as FactionIdType, NationState } from '@/data/types';
import { GAME_CONFIG } from '@/engine/config';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockNation(overrides: Partial<NationState> = {}): NationState {
  return {
    factionId: 'us' as FactionIdType,
    stability: 55,
    treasury: 800,
    gdp: 28_000,
    inflation: 6,
    militaryReadiness: 85,
    nuclearThreshold: 25,
    diplomaticInfluence: 80,
    popularity: 48,
    allianceCredibility: 65,
    techLevel: 90,
    ...overrides,
  };
}

function makeNationsRecord(
  entries: Array<Partial<NationState> & { factionId: FactionIdType }>,
): Record<FactionIdType, NationState> {
  const record = {} as Record<FactionIdType, NationState>;
  for (const entry of entries) {
    record[entry.factionId] = makeMockNation(entry);
  }
  return record;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TradeWarfareEngine', () => {
  let engine: TradeWarfareEngine;

  beforeEach(() => {
    engine = new TradeWarfareEngine(GAME_CONFIG.economy);
  });

  // ── applyReciprocalTariff ─────────────────────────────────────────────

  describe('applyReciprocalTariff', () => {
    it('US can successfully impose a tariff', () => {
      const result = engine.applyReciprocalTariff(
        FactionId.US as FactionIdType,
        FactionId.China as FactionIdType,
      );
      expect(result.success).toBe(true);
      expect(result.imposerInflationDelta).toBe(GAME_CONFIG.economy.tariffs.usInflationIncrease);
      expect(result.imposerStabilityDelta).toBe(GAME_CONFIG.economy.tariffs.usStabilityBoost);
      expect(result.targetTreasuryDelta).toBe(-GAME_CONFIG.economy.tariffs.targetTreasuryDrain);
      expect(result.targetGDPPenaltyRate).toBe(GAME_CONFIG.economy.tariffs.targetGDPPenaltyPerTurn);
    });

    it('non-US faction cannot impose tariffs', () => {
      const result = engine.applyReciprocalTariff(
        FactionId.China as FactionIdType,
        FactionId.US as FactionIdType,
      );
      expect(result.success).toBe(false);
      expect(result.reason).toContain('Only the US');
    });

    it('max simultaneous targets enforced', () => {
      const targets: FactionIdType[] = [
        FactionId.China as FactionIdType,
        FactionId.Russia as FactionIdType,
        FactionId.Iran as FactionIdType,
        FactionId.DPRK as FactionIdType,
      ];
      // Fill up to maxSimultaneousTargets (4)
      for (const target of targets) {
        engine.applyReciprocalTariff(FactionId.US as FactionIdType, target);
      }

      // 5th tariff should fail
      const result = engine.applyReciprocalTariff(
        FactionId.US as FactionIdType,
        FactionId.EU as FactionIdType,
      );
      expect(result.success).toBe(false);
      expect(result.reason).toContain('Maximum simultaneous');
    });

    it('duplicate target fails', () => {
      engine.applyReciprocalTariff(
        FactionId.US as FactionIdType,
        FactionId.China as FactionIdType,
      );
      const result = engine.applyReciprocalTariff(
        FactionId.US as FactionIdType,
        FactionId.China as FactionIdType,
      );
      expect(result.success).toBe(false);
      expect(result.reason).toContain('already active');
    });

    it('shielded target fails', () => {
      engine.activateTradeShield(
        FactionId.US as FactionIdType,
        FactionId.Japan as string,
        1000,
      );
      const result = engine.applyReciprocalTariff(
        FactionId.US as FactionIdType,
        FactionId.Japan as FactionIdType,
      );
      expect(result.success).toBe(false);
      expect(result.reason).toContain('Trade Shield');
    });

    it('returns correct deltas on success', () => {
      const result = engine.applyReciprocalTariff(
        FactionId.US as FactionIdType,
        FactionId.Russia as FactionIdType,
      );
      expect(result.success).toBe(true);
      expect(result.imposerInflationDelta).toBe(2);
      expect(result.imposerStabilityDelta).toBe(3);
      expect(result.targetTreasuryDelta).toBe(-15);
      expect(result.targetGDPPenaltyRate).toBe(-0.01);
    });
  });

  // ── removeTariff ──────────────────────────────────────────────────────

  describe('removeTariff', () => {
    it('removes existing tariff and returns true', () => {
      engine.applyReciprocalTariff(
        FactionId.US as FactionIdType,
        FactionId.China as FactionIdType,
      );
      expect(engine.removeTariff(FactionId.China as FactionIdType)).toBe(true);
      expect(engine.getActiveTariffs()).toHaveLength(0);
    });

    it('returns false for non-existing tariff', () => {
      expect(engine.removeTariff(FactionId.China as FactionIdType)).toBe(false);
    });
  });

  // ── getActiveTariffs / getTariffsOnNation ─────────────────────────────

  describe('getActiveTariffs / getTariffsOnNation', () => {
    beforeEach(() => {
      engine.applyReciprocalTariff(
        FactionId.US as FactionIdType,
        FactionId.China as FactionIdType,
      );
      engine.applyReciprocalTariff(
        FactionId.US as FactionIdType,
        FactionId.Russia as FactionIdType,
      );
    });

    it('getActiveTariffs returns all tariffs', () => {
      expect(engine.getActiveTariffs()).toHaveLength(2);
    });

    it('getTariffsOnNation returns only tariffs on specified target', () => {
      const onChina = engine.getTariffsOnNation(FactionId.China as FactionIdType);
      expect(onChina).toHaveLength(1);
      expect(onChina[0]!.target).toBe(FactionId.China);
    });

    it('getTariffsOnNation returns empty array when no tariffs on target', () => {
      const onJapan = engine.getTariffsOnNation(FactionId.Japan as FactionIdType);
      expect(onJapan).toHaveLength(0);
    });
  });

  // ── activateTradeShield ───────────────────────────────────────────────

  describe('activateTradeShield', () => {
    it('fails with insufficient treasury', () => {
      const result = engine.activateTradeShield(
        FactionId.US as FactionIdType,
        'taiwan',
        5, // less than artInitiationCost (20)
      );
      expect(result.success).toBe(false);
      expect(result.reason).toContain('Insufficient treasury');
      expect(result.treasuryCost).toBe(0);
    });

    it('successfully creates a trade shield', () => {
      const result = engine.activateTradeShield(
        FactionId.US as FactionIdType,
        'taiwan',
        1000,
      );
      expect(result.success).toBe(true);
      expect(result.treasuryCost).toBe(GAME_CONFIG.economy.tradeShield.artInitiationCost);
      expect(result.diBonusDelta).toBe(GAME_CONFIG.economy.tradeShield.artDIBonus);
    });

    it('existing tariffs on protected entity become shielded', () => {
      // First impose a tariff on the entity
      engine.applyReciprocalTariff(
        FactionId.US as FactionIdType,
        FactionId.Japan as FactionIdType,
      );
      // Then activate shield for that entity
      engine.activateTradeShield(
        FactionId.US as FactionIdType,
        FactionId.Japan as string,
        1000,
      );
      const tariffs = engine.getTariffsOnNation(FactionId.Japan as FactionIdType);
      expect(tariffs[0]!.shielded).toBe(true);
    });

    it('duplicate shield for same entity fails', () => {
      engine.activateTradeShield(
        FactionId.US as FactionIdType,
        'taiwan',
        1000,
      );
      const result = engine.activateTradeShield(
        FactionId.US as FactionIdType,
        'taiwan',
        1000,
      );
      expect(result.success).toBe(false);
      expect(result.reason).toContain('already active');
    });
  });

  // ── deactivateTradeShield ─────────────────────────────────────────────

  describe('deactivateTradeShield', () => {
    it('deactivates shield and un-shields tariffs', () => {
      engine.applyReciprocalTariff(
        FactionId.US as FactionIdType,
        FactionId.Japan as FactionIdType,
      );
      engine.activateTradeShield(
        FactionId.US as FactionIdType,
        FactionId.Japan as string,
        1000,
      );
      // Tariff should now be shielded
      expect(engine.getTariffsOnNation(FactionId.Japan as FactionIdType)[0]!.shielded).toBe(true);

      // Deactivate shield
      const removed = engine.deactivateTradeShield(FactionId.Japan as string);
      expect(removed).toBe(true);

      // Tariff should be un-shielded
      expect(engine.getTariffsOnNation(FactionId.Japan as FactionIdType)[0]!.shielded).toBe(false);
    });

    it('returns false if no active shield exists', () => {
      expect(engine.deactivateTradeShield('taiwan')).toBe(false);
    });
  });

  // ── isShielded ────────────────────────────────────────────────────────

  describe('isShielded', () => {
    it('returns true when entity is shielded', () => {
      engine.activateTradeShield(
        FactionId.US as FactionIdType,
        'taiwan',
        1000,
      );
      expect(engine.isShielded('taiwan')).toBe(true);
    });

    it('returns false when entity is not shielded', () => {
      expect(engine.isShielded('taiwan')).toBe(false);
    });

    it('returns false after shield is deactivated', () => {
      engine.activateTradeShield(
        FactionId.US as FactionIdType,
        'taiwan',
        1000,
      );
      engine.deactivateTradeShield('taiwan');
      expect(engine.isShielded('taiwan')).toBe(false);
    });
  });

  // ── assessChinaBlockadeEscalation ─────────────────────────────────────

  describe('assessChinaBlockadeEscalation', () => {
    it('no escalation when no ART active', () => {
      const result = engine.assessChinaBlockadeEscalation(false, 50, 0.5);
      expect(result.shouldEscalate).toBe(false);
      expect(result.escalationProbability).toBe(0);
    });

    it('escalation probability increases with lower stability', () => {
      // stability = 40 → modifier = (60-40)/100 = 0.20 → prob = 0.6 + 0.20 = 0.80
      const low = engine.assessChinaBlockadeEscalation(true, 40, 1.0);
      // stability = 55 → modifier = (60-55)/100 = 0.05 → prob = 0.6 + 0.05 = 0.65
      const high = engine.assessChinaBlockadeEscalation(true, 55, 1.0);
      expect(low.escalationProbability).toBeGreaterThan(high.escalationProbability);
    });

    it('shouldEscalate when rng < probability', () => {
      // stability = 50 → modifier = (60-50)/100 = 0.10 → prob = 0.6 + 0.10 = 0.70
      const result = engine.assessChinaBlockadeEscalation(true, 50, 0.5);
      expect(result.shouldEscalate).toBe(true);
      expect(result.escalationProbability).toBeCloseTo(0.70, 5);
    });

    it('no escalation when rng >= probability', () => {
      // stability = 50 → prob = 0.70
      const result = engine.assessChinaBlockadeEscalation(true, 50, 0.9);
      expect(result.shouldEscalate).toBe(false);
    });

    it('probability clamped to [0, 1] — high end', () => {
      // stability = -100 → modifier = (60-(-100))/100 = 1.60 → prob = 0.6 + 1.60 = 2.20 → clamped to 1
      const result = engine.assessChinaBlockadeEscalation(true, -100, 0.5);
      expect(result.escalationProbability).toBe(1);
    });

    it('probability clamped to [0, 1] — low end', () => {
      // stability = 200 → modifier = (60-200)/100 = -1.40 → prob = 0.6 + (-1.40) = -0.80 → clamped to 0
      const result = engine.assessChinaBlockadeEscalation(true, 200, 0.5);
      expect(result.escalationProbability).toBe(0);
      expect(result.shouldEscalate).toBe(false);
    });
  });

  // ── processTariffTurn ─────────────────────────────────────────────────

  describe('processTariffTurn', () => {
    it('accumulates drain per nation with active tariffs', () => {
      engine.applyReciprocalTariff(
        FactionId.US as FactionIdType,
        FactionId.China as FactionIdType,
      );
      const nations = makeNationsRecord([
        { factionId: FactionId.China as FactionIdType },
      ]);

      const results = engine.processTariffTurn(nations);
      expect(results).toHaveLength(1);
      expect(results[0]!.factionId).toBe(FactionId.China);
      expect(results[0]!.totalTreasuryDrain).toBe(GAME_CONFIG.economy.tariffs.targetTreasuryDrain);
      expect(results[0]!.totalGDPPenalty).toBe(GAME_CONFIG.economy.tariffs.targetGDPPenaltyPerTurn);
      expect(results[0]!.activeTariffCount).toBe(1);
    });

    it('skips shielded tariffs for penalty accumulation', () => {
      engine.applyReciprocalTariff(
        FactionId.US as FactionIdType,
        FactionId.Japan as FactionIdType,
      );
      // Shield Japan
      engine.activateTradeShield(
        FactionId.US as FactionIdType,
        FactionId.Japan as string,
        1000,
      );

      const nations = makeNationsRecord([
        { factionId: FactionId.Japan as FactionIdType },
      ]);

      const results = engine.processTariffTurn(nations);
      // No penalties accumulated because the tariff is shielded
      expect(results).toHaveLength(0);
    });

    it('increments turnsActive on all tariffs including shielded', () => {
      engine.applyReciprocalTariff(
        FactionId.US as FactionIdType,
        FactionId.China as FactionIdType,
      );
      engine.applyReciprocalTariff(
        FactionId.US as FactionIdType,
        FactionId.Japan as FactionIdType,
      );
      // Shield Japan
      engine.activateTradeShield(
        FactionId.US as FactionIdType,
        FactionId.Japan as string,
        1000,
      );

      const nations = makeNationsRecord([
        { factionId: FactionId.China as FactionIdType },
        { factionId: FactionId.Japan as FactionIdType },
      ]);

      engine.processTariffTurn(nations);

      const tariffs = engine.getActiveTariffs();
      // Both should have turnsActive incremented to 1
      for (const t of tariffs) {
        expect(t.turnsActive).toBe(1);
      }
    });

    it('increments turnsActive on active trade shields', () => {
      engine.activateTradeShield(
        FactionId.US as FactionIdType,
        'taiwan',
        1000,
      );

      const nations = {} as Record<FactionIdType, NationState>;
      engine.processTariffTurn(nations);

      const shields = engine.getTradeShields();
      expect(shields[0]!.turnsActive).toBe(1);
    });

    it('handles multiple tariffs on different nations', () => {
      engine.applyReciprocalTariff(
        FactionId.US as FactionIdType,
        FactionId.China as FactionIdType,
      );
      engine.applyReciprocalTariff(
        FactionId.US as FactionIdType,
        FactionId.Russia as FactionIdType,
      );

      const nations = makeNationsRecord([
        { factionId: FactionId.China as FactionIdType },
        { factionId: FactionId.Russia as FactionIdType },
      ]);

      const results = engine.processTariffTurn(nations);
      expect(results).toHaveLength(2);

      const chinaResult = results.find((r) => r.factionId === FactionId.China);
      const russiaResult = results.find((r) => r.factionId === FactionId.Russia);
      expect(chinaResult).toBeDefined();
      expect(russiaResult).toBeDefined();
      expect(chinaResult!.activeTariffCount).toBe(1);
      expect(russiaResult!.activeTariffCount).toBe(1);
    });

    it('returns empty array when no tariffs active', () => {
      const nations = makeNationsRecord([
        { factionId: FactionId.US as FactionIdType },
      ]);
      const results = engine.processTariffTurn(nations);
      expect(results).toHaveLength(0);
    });
  });
});
