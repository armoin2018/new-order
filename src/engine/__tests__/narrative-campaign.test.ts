import { describe, it, expect, beforeEach } from 'vitest';
import type {
  FactionId,
  NarrativeCampaign,
  NarrativeCampaignLog,
  NarrativeType,
} from '@/data/types';
import { NarrativeCampaignEngine } from '@/engine/narrative-campaign';
import type { BackfireContext, TurnContext } from '@/engine/narrative-campaign';

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

const US = 'us' as FactionId;
const CHINA = 'china' as FactionId;
const RUSSIA = 'russia' as FactionId;

/** Factory for a `NarrativeCampaign` with sensible defaults. */
function makeCampaign(
  overrides: Partial<NarrativeCampaign> = {},
): NarrativeCampaign {
  return {
    sourceFaction: US,
    type: 'Victimhood' as NarrativeType,
    target: CHINA,
    turnsActive: 0,
    effectivenessScore: 100,
    discovered: false,
    viralityPeak: 100,
    ...overrides,
  };
}

/** Factory for a `NarrativeCampaignLog` with empty lists. */
function makeLog(
  overrides: Partial<NarrativeCampaignLog> = {},
): NarrativeCampaignLog {
  return {
    factionId: US,
    activeCampaigns: [],
    historicalCampaigns: [],
    ...overrides,
  };
}

/** Factory for a no-op `BackfireContext`. */
function makeBackfireCtx(
  overrides: Partial<BackfireContext> = {},
): BackfireContext {
  return {
    hasAggressiveMilitaryAction: false,
    hasEconomicCoercion: false,
    hasContradictoryEvidence: false,
    ...overrides,
  };
}

/** Factory for a minimal `TurnContext`. */
function makeTurnCtx(
  overrides: Partial<TurnContext> = {},
): TurnContext {
  return {
    backfireContexts: new Map<NarrativeType, BackfireContext>(),
    currentVirality: 0,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────

describe('NarrativeCampaignEngine', () => {
  let engine: NarrativeCampaignEngine;

  beforeEach(() => {
    engine = new NarrativeCampaignEngine();
  });

  // ── computeEffects ──────────────────────────────────────

  describe('computeEffects', () => {
    describe('victimhood', () => {
      it('nationalismDelta = 10, sympathyDelta = 5, diCost = -5', () => {
        const campaign = makeCampaign({
          type: 'Victimhood' as NarrativeType,
          effectivenessScore: 100,
        });
        const effects = engine.computeEffects(campaign);

        expect(effects.nationalismDelta).toBe(10);
        expect(effects.sympathyDelta).toBe(5);
        expect(effects.diCost).toBe(-5);
      });
    });

    describe('liberation', () => {
      it('militaryLegitimacyReduction = 0.5', () => {
        const campaign = makeCampaign({
          type: 'Liberation' as NarrativeType,
          effectivenessScore: 100,
        });
        const effects = engine.computeEffects(campaign);

        expect(effects.militaryLegitimacyReduction).toBe(0.5);
      });
    });

    describe('economicJustice', () => {
      it('diplomaticPenaltyReduction = 0.3', () => {
        const campaign = makeCampaign({
          type: 'EconomicJustice' as NarrativeType,
          effectivenessScore: 100,
        });
        const effects = engine.computeEffects(campaign);

        expect(effects.diplomaticPenaltyReduction).toBe(0.3);
      });
    });

    describe('historicalGrievance', () => {
      it('nationalismDelta = 15, angerDelta = 10, legitimacyDelta = -5', () => {
        const campaign = makeCampaign({
          type: 'HistoricalGrievance' as NarrativeType,
          effectivenessScore: 100,
        });
        const effects = engine.computeEffects(campaign);

        expect(effects.nationalismDelta).toBe(15);
        expect(effects.angerDelta).toBe(10);
        expect(effects.legitimacyDelta).toBe(-5);
      });
    });

    it('scales effects by effectivenessScore (100 = full, 50 = half)', () => {
      const fullCampaign = makeCampaign({
        type: 'Victimhood' as NarrativeType,
        effectivenessScore: 100,
      });
      const halfCampaign = makeCampaign({
        type: 'Victimhood' as NarrativeType,
        effectivenessScore: 50,
      });

      const fullEffects = engine.computeEffects(fullCampaign);
      const halfEffects = engine.computeEffects(halfCampaign);

      expect(halfEffects.nationalismDelta).toBe(fullEffects.nationalismDelta / 2);
      expect(halfEffects.sympathyDelta).toBe(fullEffects.sympathyDelta / 2);
    });

    it('zero effectiveness produces zero effects', () => {
      const campaign = makeCampaign({
        type: 'Victimhood' as NarrativeType,
        effectivenessScore: 0,
      });
      const effects = engine.computeEffects(campaign);

      expect(effects.nationalismDelta).toBe(0);
      expect(effects.sympathyDelta).toBe(0);
      // diCost is a flat cost, not scaled by effectiveness
      expect(effects.diCost).toBe(-5);
    });
  });

  // ── checkBackfire ───────────────────────────────────────

  describe('checkBackfire', () => {
    it('liberation backfires with aggressive military action', () => {
      const campaign = makeCampaign({ type: 'Liberation' as NarrativeType });
      const ctx = makeBackfireCtx({ hasAggressiveMilitaryAction: true });
      const result = engine.checkBackfire(campaign, ctx);

      expect(result.backfired).toBe(true);
      expect(result.legitimacyPenalty).toBe(-15);
    });

    it('liberation backfires with contradictory evidence', () => {
      const campaign = makeCampaign({ type: 'Liberation' as NarrativeType });
      const ctx = makeBackfireCtx({ hasContradictoryEvidence: true });
      const result = engine.checkBackfire(campaign, ctx);

      expect(result.backfired).toBe(true);
      expect(result.legitimacyPenalty).toBe(-15);
    });

    it('liberation does not backfire without aggressive actions', () => {
      const campaign = makeCampaign({ type: 'Liberation' as NarrativeType });
      const ctx = makeBackfireCtx();
      const result = engine.checkBackfire(campaign, ctx);

      expect(result.backfired).toBe(false);
      expect(result.legitimacyPenalty).toBe(0);
    });

    it('victimhood never backfires', () => {
      const campaign = makeCampaign({ type: 'Victimhood' as NarrativeType });
      const ctx = makeBackfireCtx({
        hasAggressiveMilitaryAction: true,
        hasContradictoryEvidence: true,
      });
      const result = engine.checkBackfire(campaign, ctx);

      expect(result.backfired).toBe(false);
    });

    it('economicJustice never backfires', () => {
      const campaign = makeCampaign({ type: 'EconomicJustice' as NarrativeType });
      const ctx = makeBackfireCtx({
        hasAggressiveMilitaryAction: true,
        hasContradictoryEvidence: true,
      });
      const result = engine.checkBackfire(campaign, ctx);

      expect(result.backfired).toBe(false);
    });

    it('historicalGrievance never backfires', () => {
      const campaign = makeCampaign({ type: 'HistoricalGrievance' as NarrativeType });
      const ctx = makeBackfireCtx({
        hasAggressiveMilitaryAction: true,
        hasContradictoryEvidence: true,
      });
      const result = engine.checkBackfire(campaign, ctx);

      expect(result.backfired).toBe(false);
    });

    it('backfire returns correct penalty (-15)', () => {
      const campaign = makeCampaign({ type: 'Liberation' as NarrativeType });
      const ctx = makeBackfireCtx({ hasAggressiveMilitaryAction: true });
      const result = engine.checkBackfire(campaign, ctx);

      expect(result.legitimacyPenalty).toBe(-15);
    });
  });

  // ── deployCampaign ──────────────────────────────────────

  describe('deployCampaign', () => {
    it('adds new campaign to active list', () => {
      const log = makeLog();
      const result = engine.deployCampaign(
        log,
        'Victimhood' as NarrativeType,
        CHINA,
        80,
      );

      expect(result.log.activeCampaigns).toHaveLength(1);
      expect(result.campaign.type).toBe('Victimhood');
      expect(result.campaign.target).toBe(CHINA);
    });

    it('replaces existing same-type/same-target campaign (moves to historical)', () => {
      const existing = makeCampaign({
        type: 'Victimhood' as NarrativeType,
        target: CHINA,
        turnsActive: 3,
        effectivenessScore: 60,
      });
      const log = makeLog({ activeCampaigns: [existing] });

      const result = engine.deployCampaign(
        log,
        'Victimhood' as NarrativeType,
        CHINA,
        90,
      );

      expect(result.log.activeCampaigns).toHaveLength(1);
      expect(result.log.activeCampaigns[0]?.turnsActive).toBe(0);
      expect(result.log.historicalCampaigns).toHaveLength(1);
      expect(result.log.historicalCampaigns[0]?.turnsActive).toBe(3);
    });

    it('preserves other active campaigns', () => {
      const liberation = makeCampaign({
        type: 'Liberation' as NarrativeType,
        target: RUSSIA,
      });
      const log = makeLog({ activeCampaigns: [liberation] });

      const result = engine.deployCampaign(
        log,
        'Victimhood' as NarrativeType,
        CHINA,
        80,
      );

      expect(result.log.activeCampaigns).toHaveLength(2);
    });

    it('sets turnsActive to 0 for new campaign', () => {
      const log = makeLog();
      const result = engine.deployCampaign(
        log,
        'Victimhood' as NarrativeType,
        CHINA,
        80,
      );

      expect(result.campaign.turnsActive).toBe(0);
    });

    it('sets effectivenessScore from virality parameter', () => {
      const log = makeLog();
      const result = engine.deployCampaign(
        log,
        'Victimhood' as NarrativeType,
        CHINA,
        75,
      );

      expect(result.campaign.effectivenessScore).toBe(75);
    });

    it('sets discovered to false for new campaign', () => {
      const log = makeLog();
      const result = engine.deployCampaign(
        log,
        'Victimhood' as NarrativeType,
        CHINA,
        80,
      );

      expect(result.campaign.discovered).toBe(false);
    });
  });

  // ── cancelCampaign ──────────────────────────────────────

  describe('cancelCampaign', () => {
    it('moves campaign from active to historical', () => {
      const campaign = makeCampaign({
        type: 'Victimhood' as NarrativeType,
        target: CHINA,
      });
      const log = makeLog({ activeCampaigns: [campaign] });

      const result = engine.cancelCampaign(
        log,
        'Victimhood' as NarrativeType,
        CHINA,
      );

      expect(result.activeCampaigns).toHaveLength(0);
      expect(result.historicalCampaigns).toHaveLength(1);
    });

    it('does not error when campaign not found (idempotent)', () => {
      const log = makeLog();
      const result = engine.cancelCampaign(
        log,
        'Liberation' as NarrativeType,
        CHINA,
      );

      expect(result.activeCampaigns).toHaveLength(0);
      expect(result.historicalCampaigns).toHaveLength(0);
    });

    it('preserves other active campaigns', () => {
      const victimhood = makeCampaign({
        type: 'Victimhood' as NarrativeType,
        target: CHINA,
      });
      const liberation = makeCampaign({
        type: 'Liberation' as NarrativeType,
        target: RUSSIA,
      });
      const log = makeLog({ activeCampaigns: [victimhood, liberation] });

      const result = engine.cancelCampaign(
        log,
        'Victimhood' as NarrativeType,
        CHINA,
      );

      expect(result.activeCampaigns).toHaveLength(1);
      expect(result.activeCampaigns[0]?.type).toBe('Liberation');
    });
  });

  // ── advanceTurn ─────────────────────────────────────────

  describe('advanceTurn', () => {
    it('increments turnsActive for all active campaigns', () => {
      const campaign1 = makeCampaign({
        type: 'Victimhood' as NarrativeType,
        target: CHINA,
        turnsActive: 2,
      });
      const campaign2 = makeCampaign({
        type: 'Liberation' as NarrativeType,
        target: RUSSIA,
        turnsActive: 0,
      });
      const log = makeLog({ activeCampaigns: [campaign1, campaign2] });
      const ctx = makeTurnCtx();

      const result = engine.advanceTurn(log, ctx);

      expect(result.log.activeCampaigns[0]?.turnsActive).toBe(3);
      expect(result.log.activeCampaigns[1]?.turnsActive).toBe(1);
    });

    it('decays effectiveness (5% per turn)', () => {
      const campaign = makeCampaign({
        type: 'Victimhood' as NarrativeType,
        target: CHINA,
        effectivenessScore: 100,
        viralityPeak: 100,
      });
      const log = makeLog({ activeCampaigns: [campaign] });
      const ctx = makeTurnCtx();

      const result = engine.advanceTurn(log, ctx);
      const advanced = result.log.activeCampaigns[0];

      // 100 × (1 - 0.05) = 95, but must be ≥ floor (20% of 100 = 20)
      expect(advanced?.effectivenessScore).toBe(95);
    });

    it('effectiveness does not decay below floor (20% of peak)', () => {
      const campaign = makeCampaign({
        type: 'Victimhood' as NarrativeType,
        target: CHINA,
        effectivenessScore: 21,
        viralityPeak: 100,
      });
      const log = makeLog({ activeCampaigns: [campaign] });
      const ctx = makeTurnCtx();

      const result = engine.advanceTurn(log, ctx);
      const advanced = result.log.activeCampaigns[0];

      // 21 × 0.95 = 19.95, but floor = 20% of 100 = 20
      expect(advanced?.effectivenessScore).toBe(20);
    });

    it('checks for backfire on each campaign', () => {
      const liberation = makeCampaign({
        type: 'Liberation' as NarrativeType,
        target: CHINA,
      });
      const victimhood = makeCampaign({
        type: 'Victimhood' as NarrativeType,
        target: RUSSIA,
      });
      const log = makeLog({ activeCampaigns: [liberation, victimhood] });

      const backfireContexts = new Map<NarrativeType, BackfireContext>();
      backfireContexts.set(
        'Liberation' as NarrativeType,
        makeBackfireCtx({ hasAggressiveMilitaryAction: true }),
      );
      const ctx = makeTurnCtx({ backfireContexts });

      const result = engine.advanceTurn(log, ctx);

      expect(result.backfires).toHaveLength(2);
      expect(result.backfires[0]?.backfired).toBe(true);
      expect(result.backfires[1]?.backfired).toBe(false);
    });

    it('returns aggregated effects from all active campaigns', () => {
      const victimhood = makeCampaign({
        type: 'Victimhood' as NarrativeType,
        target: CHINA,
        effectivenessScore: 100,
        viralityPeak: 100,
      });
      const grievance = makeCampaign({
        type: 'HistoricalGrievance' as NarrativeType,
        target: RUSSIA,
        effectivenessScore: 100,
        viralityPeak: 100,
      });
      const log = makeLog({ activeCampaigns: [victimhood, grievance] });
      const ctx = makeTurnCtx();

      const result = engine.advanceTurn(log, ctx);

      // Both campaigns decay to 95, so scale = 0.95
      // Victimhood: nationalismDelta = 10 × 0.95 = 9.5
      // HistoricalGrievance: nationalismDelta = 15 × 0.95 = 14.25
      // Total nationalismDelta = 9.5 + 14.25 = 23.75
      expect(result.aggregatedEffects.nationalismDelta).toBeCloseTo(23.75, 5);
    });

    it('returns backfire results', () => {
      const liberation = makeCampaign({
        type: 'Liberation' as NarrativeType,
        target: CHINA,
      });
      const log = makeLog({ activeCampaigns: [liberation] });

      const backfireContexts = new Map<NarrativeType, BackfireContext>();
      backfireContexts.set(
        'Liberation' as NarrativeType,
        makeBackfireCtx({ hasAggressiveMilitaryAction: true }),
      );
      const ctx = makeTurnCtx({ backfireContexts });

      const result = engine.advanceTurn(log, ctx);

      expect(result.backfires).toHaveLength(1);
      expect(result.backfires[0]?.backfired).toBe(true);
      expect(result.backfires[0]?.legitimacyPenalty).toBe(-15);
    });
  });

  // ── getActiveCampaignByType ─────────────────────────────

  describe('getActiveCampaignByType', () => {
    it('finds existing active campaign', () => {
      const campaign = makeCampaign({
        type: 'Victimhood' as NarrativeType,
        target: CHINA,
      });
      const log = makeLog({ activeCampaigns: [campaign] });

      const found = engine.getActiveCampaignByType(
        log,
        'Victimhood' as NarrativeType,
      );

      expect(found).toBeDefined();
      expect(found?.type).toBe('Victimhood');
    });

    it('returns undefined when none active', () => {
      const log = makeLog();

      const found = engine.getActiveCampaignByType(
        log,
        'Liberation' as NarrativeType,
      );

      expect(found).toBeUndefined();
    });

    it('finds correct type among multiple', () => {
      const victimhood = makeCampaign({
        type: 'Victimhood' as NarrativeType,
        target: CHINA,
      });
      const liberation = makeCampaign({
        type: 'Liberation' as NarrativeType,
        target: RUSSIA,
      });
      const log = makeLog({ activeCampaigns: [victimhood, liberation] });

      const found = engine.getActiveCampaignByType(
        log,
        'Liberation' as NarrativeType,
      );

      expect(found).toBeDefined();
      expect(found?.type).toBe('Liberation');
      expect(found?.target).toBe(RUSSIA);
    });
  });
});
