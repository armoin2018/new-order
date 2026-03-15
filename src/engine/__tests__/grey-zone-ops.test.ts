import { describe, it, expect, beforeEach } from 'vitest';
import { GreyZoneOpsEngine } from '@/engine/grey-zone-ops';
import { GAME_CONFIG } from '@/engine/config';
import { SeededRandom } from '@/engine/rng';
import type {
  FactionId as FactionIdType,
  TurnNumber,
  HexId,
  NationState,
  IntelligenceCapabilities,
} from '@/data/types';
import { FactionId } from '@/data/types';

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

function makeMockCapabilities(
  overrides: Partial<IntelligenceCapabilities> = {},
): IntelligenceCapabilities {
  return {
    humint: 50,
    sigint: 50,
    cyber: 50,
    covert: 50,
    counterIntel: 50,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GreyZoneOpsEngine', () => {
  let engine: GreyZoneOpsEngine;
  let rng: SeededRandom;
  const gzConfig = GAME_CONFIG.greyZone;
  const maritimeCfg = gzConfig.maritimeMilitia;
  const cyberCfg = gzConfig.cyberOps;

  beforeEach(() => {
    rng = new SeededRandom(42);
    engine = new GreyZoneOpsEngine(gzConfig, rng);
  });

  // ═══════════════════════════════════════════════════════
  // MARITIME MILITIA — FR-402
  // ═══════════════════════════════════════════════════════

  describe('Maritime Militia (FR-402)', () => {
    // ── canDeployBlockade ──────────────────────────────

    describe('canDeployBlockade', () => {
      it('passes when all preconditions are met', () => {
        const sponsor = makeMockNation({
          treasury: maritimeCfg.treasuryCostPerTurn,
        });
        const result = engine.canDeployBlockade(sponsor, 0);
        expect(result.valid).toBe(true);
      });

      it('rejects when treasury is insufficient', () => {
        const sponsor = makeMockNation({
          treasury: maritimeCfg.treasuryCostPerTurn - 1,
        });
        const result = engine.canDeployBlockade(sponsor, 0);
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('Treasury');
      });

      it('rejects when max fleet units reached', () => {
        const sponsor = makeMockNation({
          treasury: maritimeCfg.treasuryCostPerTurn,
        });
        const result = engine.canDeployBlockade(
          sponsor,
          maritimeCfg.maxFleetUnits,
        );
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('Maximum fleet units');
      });
    });

    // ── deployBlockade ─────────────────────────────────

    describe('deployBlockade', () => {
      it('creates a record with correct fields', () => {
        const record = engine.deployBlockade(
          FactionId.China as FactionIdType,
          FactionId.Japan as FactionIdType,
          'hex-001' as HexId,
          1 as TurnNumber,
        );
        expect(record.sponsorFaction).toBe(FactionId.China);
        expect(record.targetFaction).toBe(FactionId.Japan);
        expect(record.targetHex).toBe('hex-001');
        expect(record.active).toBe(true);
        expect(record.endTurn).toBeNull();
      });

      it('has triggersWarState === false (FR-402 invariant)', () => {
        const record = engine.deployBlockade(
          FactionId.China as FactionIdType,
          FactionId.Japan as FactionIdType,
          'hex-001' as HexId,
          1 as TurnNumber,
        );
        expect(record.triggersWarState).toBe(false);
      });

      it('generates unique IDs', () => {
        const r1 = engine.deployBlockade(
          FactionId.China as FactionIdType,
          FactionId.Japan as FactionIdType,
          'hex-001' as HexId,
          1 as TurnNumber,
        );
        const r2 = engine.deployBlockade(
          FactionId.China as FactionIdType,
          FactionId.Japan as FactionIdType,
          'hex-002' as HexId,
          1 as TurnNumber,
        );
        expect(r1.id).not.toBe(r2.id);
      });
    });

    // ── processBlockadeTurn ────────────────────────────

    describe('processBlockadeTurn', () => {
      it('returns configured trade disruption delta', () => {
        const record = engine.deployBlockade(
          FactionId.China as FactionIdType,
          FactionId.Japan as FactionIdType,
          'hex-001' as HexId,
          1 as TurnNumber,
        );
        const result = engine.processBlockadeTurn(record);
        expect(result.tradeDisruptionDelta).toBe(
          maritimeCfg.tradeDisruptionPercent,
        );
      });

      it('returns configured tension delta', () => {
        const record = engine.deployBlockade(
          FactionId.China as FactionIdType,
          FactionId.Japan as FactionIdType,
          'hex-001' as HexId,
          1 as TurnNumber,
        );
        const result = engine.processBlockadeTurn(record);
        expect(result.tensionDelta).toBe(maritimeCfg.tensionIncreasePerTurn);
      });

      it('charges configured treasury cost', () => {
        const record = engine.deployBlockade(
          FactionId.China as FactionIdType,
          FactionId.Japan as FactionIdType,
          'hex-001' as HexId,
          1 as TurnNumber,
        );
        const result = engine.processBlockadeTurn(record);
        expect(result.treasuryCost).toBe(maritimeCfg.treasuryCostPerTurn);
      });

      it('never triggers war-state in turn results (FR-402)', () => {
        const record = engine.deployBlockade(
          FactionId.China as FactionIdType,
          FactionId.Japan as FactionIdType,
          'hex-001' as HexId,
          1 as TurnNumber,
        );
        const result = engine.processBlockadeTurn(record);
        expect(result.triggersWarState).toBe(false);
      });
    });

    // ── liftBlockade ───────────────────────────────────

    describe('liftBlockade', () => {
      it('returns a new record with active: false', () => {
        const record = engine.deployBlockade(
          FactionId.China as FactionIdType,
          FactionId.Japan as FactionIdType,
          'hex-001' as HexId,
          1 as TurnNumber,
        );
        const lifted = engine.liftBlockade(record, 5 as TurnNumber);
        expect(lifted.active).toBe(false);
        expect(lifted.endTurn).toBe(5);
      });

      it('does not mutate the original record', () => {
        const record = engine.deployBlockade(
          FactionId.China as FactionIdType,
          FactionId.Japan as FactionIdType,
          'hex-001' as HexId,
          1 as TurnNumber,
        );
        engine.liftBlockade(record, 5 as TurnNumber);
        expect(record.active).toBe(true);
        expect(record.endTurn).toBeNull();
      });

      it('preserves triggersWarState: false in lifted record', () => {
        const record = engine.deployBlockade(
          FactionId.China as FactionIdType,
          FactionId.Japan as FactionIdType,
          'hex-001' as HexId,
          1 as TurnNumber,
        );
        const lifted = engine.liftBlockade(record, 5 as TurnNumber);
        expect(lifted.triggersWarState).toBe(false);
      });
    });
  });

  // ═══════════════════════════════════════════════════════
  // CYBER OPERATIONS — FR-403
  // ═══════════════════════════════════════════════════════

  describe('Cyber Operations (FR-403)', () => {
    // ── canLaunchCyberOp ───────────────────────────────

    describe('canLaunchCyberOp', () => {
      it('passes when all preconditions are met', () => {
        const sponsor = makeMockNation({ treasury: cyberCfg.treasuryCost });
        const caps = makeMockCapabilities({
          cyber: cyberCfg.minCyberCapability,
        });
        const result = engine.canLaunchCyberOp(sponsor, caps, 0);
        expect(result.valid).toBe(true);
      });

      it('rejects when treasury is insufficient', () => {
        const sponsor = makeMockNation({
          treasury: cyberCfg.treasuryCost - 1,
        });
        const caps = makeMockCapabilities({
          cyber: cyberCfg.minCyberCapability,
        });
        const result = engine.canLaunchCyberOp(sponsor, caps, 0);
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('Treasury');
      });

      it('rejects when cyber capability is below threshold', () => {
        const sponsor = makeMockNation({ treasury: cyberCfg.treasuryCost });
        const caps = makeMockCapabilities({
          cyber: cyberCfg.minCyberCapability - 1,
        });
        const result = engine.canLaunchCyberOp(sponsor, caps, 0);
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('Cyber capability');
      });

      it('rejects when max concurrent ops reached', () => {
        const sponsor = makeMockNation({ treasury: cyberCfg.treasuryCost });
        const caps = makeMockCapabilities({
          cyber: cyberCfg.minCyberCapability,
        });
        const result = engine.canLaunchCyberOp(
          sponsor,
          caps,
          cyberCfg.maxConcurrentOps,
        );
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('Maximum concurrent cyber ops');
      });
    });

    // ── launchCyberOp ──────────────────────────────────

    describe('launchCyberOp', () => {
      it('creates a record targeting militaryReadiness', () => {
        const record = engine.launchCyberOp(
          FactionId.China as FactionIdType,
          FactionId.US as FactionIdType,
          'militaryReadiness',
          1 as TurnNumber,
        );
        expect(record.targetStat).toBe('militaryReadiness');
        expect(record.active).toBe(true);
      });

      it('creates a record targeting gdpGrowth', () => {
        const record = engine.launchCyberOp(
          FactionId.Russia as FactionIdType,
          FactionId.EU as FactionIdType,
          'gdpGrowth',
          1 as TurnNumber,
        );
        expect(record.targetStat).toBe('gdpGrowth');
      });

      it('sets expiryTurn = startTurn + effectDurationTurns', () => {
        const record = engine.launchCyberOp(
          FactionId.China as FactionIdType,
          FactionId.US as FactionIdType,
          'militaryReadiness',
          5 as TurnNumber,
        );
        expect(record.expiryTurn).toBe(5 + cyberCfg.effectDurationTurns);
      });

      it('generates unique IDs', () => {
        const r1 = engine.launchCyberOp(
          FactionId.China as FactionIdType,
          FactionId.US as FactionIdType,
          'militaryReadiness',
          1 as TurnNumber,
        );
        const r2 = engine.launchCyberOp(
          FactionId.China as FactionIdType,
          FactionId.US as FactionIdType,
          'gdpGrowth',
          1 as TurnNumber,
        );
        expect(r1.id).not.toBe(r2.id);
      });
    });

    // ── processCyberOpTurn ─────────────────────────────

    describe('processCyberOpTurn', () => {
      it('degrades militaryReadiness by configured amount', () => {
        const record = engine.launchCyberOp(
          FactionId.China as FactionIdType,
          FactionId.US as FactionIdType,
          'militaryReadiness',
          1 as TurnNumber,
        );
        const result = engine.processCyberOpTurn(record, 1 as TurnNumber);
        expect(result.statDelta).toBe(-cyberCfg.militaryReadinessReduction);
        expect(result.expired).toBe(false);
      });

      it('degrades gdpGrowth by configured amount', () => {
        const record = engine.launchCyberOp(
          FactionId.Russia as FactionIdType,
          FactionId.EU as FactionIdType,
          'gdpGrowth',
          1 as TurnNumber,
        );
        const result = engine.processCyberOpTurn(record, 1 as TurnNumber);
        expect(result.statDelta).toBe(-cyberCfg.gdpGrowthReduction);
        expect(result.expired).toBe(false);
      });

      it('returns zero delta and expired: true after expiryTurn', () => {
        const record = engine.launchCyberOp(
          FactionId.China as FactionIdType,
          FactionId.US as FactionIdType,
          'militaryReadiness',
          1 as TurnNumber,
        );
        const expiredTurn = (record.expiryTurn + 1) as TurnNumber;
        const result = engine.processCyberOpTurn(record, expiredTurn);
        expect(result.statDelta).toBe(0);
        expect(result.expired).toBe(true);
      });

      it('is still active on the exact expiryTurn', () => {
        const record = engine.launchCyberOp(
          FactionId.China as FactionIdType,
          FactionId.US as FactionIdType,
          'militaryReadiness',
          1 as TurnNumber,
        );
        const result = engine.processCyberOpTurn(
          record,
          record.expiryTurn,
        );
        expect(result.expired).toBe(false);
        expect(result.statDelta).toBe(-cyberCfg.militaryReadinessReduction);
      });
    });

    // ── processAllCyberOps ─────────────────────────────

    describe('processAllCyberOps', () => {
      it('aggregates per-target effects across multiple ops', () => {
        const op1 = engine.launchCyberOp(
          FactionId.China as FactionIdType,
          FactionId.US as FactionIdType,
          'militaryReadiness',
          1 as TurnNumber,
        );
        const op2 = engine.launchCyberOp(
          FactionId.Russia as FactionIdType,
          FactionId.US as FactionIdType,
          'gdpGrowth',
          1 as TurnNumber,
        );
        const result = engine.processAllCyberOps(
          [op1, op2],
          1 as TurnNumber,
        );

        const usEffects = result.perTargetEffects[FactionId.US];
        expect(usEffects).toBeDefined();
        expect(usEffects!.militaryReadinessDelta).toBe(
          -cyberCfg.militaryReadinessReduction,
        );
        expect(usEffects!.gdpGrowthDelta).toBe(
          -cyberCfg.gdpGrowthReduction,
        );
      });

      it('partitions expired and active ops', () => {
        const op1 = engine.launchCyberOp(
          FactionId.China as FactionIdType,
          FactionId.US as FactionIdType,
          'militaryReadiness',
          1 as TurnNumber,
        );
        // Process well past expiry
        const lateTurn = (op1.expiryTurn + 5) as TurnNumber;
        const result = engine.processAllCyberOps([op1], lateTurn);
        expect(result.expired).toHaveLength(1);
        expect(result.active).toHaveLength(0);
      });

      it('skips inactive ops', () => {
        const op1 = engine.launchCyberOp(
          FactionId.China as FactionIdType,
          FactionId.US as FactionIdType,
          'militaryReadiness',
          1 as TurnNumber,
        );
        op1.active = false;
        const result = engine.processAllCyberOps([op1], 1 as TurnNumber);
        expect(result.results).toHaveLength(0);
      });

      it('returns empty aggregates for empty input', () => {
        const result = engine.processAllCyberOps([], 1 as TurnNumber);
        expect(result.results).toHaveLength(0);
        expect(result.expired).toHaveLength(0);
        expect(result.active).toHaveLength(0);
        expect(Object.keys(result.perTargetEffects)).toHaveLength(0);
      });
    });
  });
});
