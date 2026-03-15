import { describe, it, expect, beforeEach } from 'vitest';
import { IntelligenceReliabilityEngine } from '@/engine/intelligence-reliability';
import { GAME_CONFIG } from '@/engine/config';
import { SeededRandom } from '@/engine/rng';
import { FactionId, UnitType } from '@/data/types';

import type { IntelligenceCapabilities } from '@/data/types';
import type { HexId, TurnNumber, UnitId } from '@/data/types';
import type {
  GhostUnitRecord,
  FalsePactRecord,
  GhostDecayResult,
  FalsePactRevealResult,
} from '@/engine/intelligence-reliability';

// ─────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────

/** Build a minimal valid IntelligenceCapabilities for testing. */
function makeMockCapabilities(
  overrides: Partial<IntelligenceCapabilities> = {},
): IntelligenceCapabilities {
  return {
    humint: 50,
    sigint: 50,
    cyber: 40,
    covert: 40,
    counterIntel: 30,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────

describe('IntelligenceReliabilityEngine', () => {
  let engine: IntelligenceReliabilityEngine;
  let rng: SeededRandom;

  beforeEach(() => {
    rng = new SeededRandom(42);
    engine = new IntelligenceReliabilityEngine(GAME_CONFIG.intelReliability, rng);
  });

  // ── calculateReliability ─────────────────────────────

  describe('calculateReliability', () => {
    it('base reliability from HUMINT+SIGINT average', () => {
      const caps = makeMockCapabilities({ humint: 50, sigint: 50 });
      const result = engine.calculateReliability(caps, 0, 0);

      // (50 + 50) / 2 = 50
      expect(result).toBe(50);
    });

    it('DI investment boosts reliability', () => {
      const caps = makeMockCapabilities({ humint: 50, sigint: 50 });
      const result = engine.calculateReliability(caps, 2, 0);

      // (50 + 50) / 2 + 2 * 5 = 60
      expect(result).toBe(60);
    });

    it('target counter-intel reduces reliability', () => {
      const caps = makeMockCapabilities({ humint: 50, sigint: 50 });
      const result = engine.calculateReliability(caps, 0, 20);

      // (50 + 50) / 2 - 20 = 30
      expect(result).toBe(30);
    });

    it('result clamped to minReliability when heavily countered', () => {
      const caps = makeMockCapabilities({ humint: 20, sigint: 20 });
      const result = engine.calculateReliability(caps, 0, 80);

      // (20 + 20) / 2 - 80 = -60 → clamped to 10
      expect(result).toBe(GAME_CONFIG.intelReliability.minReliability);
    });

    it('result clamped to maxReliability when boosted high', () => {
      const caps = makeMockCapabilities({ humint: 90, sigint: 90 });
      const result = engine.calculateReliability(caps, 10, 0);

      // (90 + 90) / 2 + 10 * 5 = 140 → clamped to 95
      expect(result).toBe(GAME_CONFIG.intelReliability.maxReliability);
    });

    it('zero DI and zero counter-intel returns HUMINT+SIGINT average', () => {
      const caps = makeMockCapabilities({ humint: 60, sigint: 40 });
      const result = engine.calculateReliability(caps, 0, 0);

      // (60 + 40) / 2 = 50
      expect(result).toBe(50);
    });

    it('high DI can overcome high counter-intel', () => {
      const caps = makeMockCapabilities({ humint: 30, sigint: 30 });
      const result = engine.calculateReliability(caps, 10, 40);

      // (30 + 30) / 2 + 10 * 5 - 40 = 30 + 50 - 40 = 40
      expect(result).toBe(40);
    });
  });

  // ── shouldSpawnGhostUnit ─────────────────────────────

  describe('shouldSpawnGhostUnit', () => {
    it('returns false when reliability >= threshold', () => {
      const result = engine.shouldSpawnGhostUnit(50);

      expect(result).toBe(false);
    });

    it('returns false when reliability exactly at threshold', () => {
      const result = engine.shouldSpawnGhostUnit(
        GAME_CONFIG.intelReliability.ghostUnitReliabilityThreshold,
      );

      expect(result).toBe(false);
    });

    it('may return true when reliability < threshold (via RNG)', () => {
      // Run multiple times to find at least one true given reliability well below threshold
      const results: boolean[] = [];
      for (let i = 0; i < 50; i++) {
        const localRng = new SeededRandom(i);
        const localEngine = new IntelligenceReliabilityEngine(
          GAME_CONFIG.intelReliability,
          localRng,
        );
        results.push(localEngine.shouldSpawnGhostUnit(10));
      }

      expect(results).toContain(true);
    });

    it('probability increases as reliability decreases', () => {
      // Reliability 10 should spawn ghosts more often than reliability 35
      let spawnCountLow = 0;
      let spawnCountHigh = 0;
      const iterations = 200;

      for (let i = 0; i < iterations; i++) {
        const rngLow = new SeededRandom(i);
        const engineLow = new IntelligenceReliabilityEngine(
          GAME_CONFIG.intelReliability,
          rngLow,
        );
        if (engineLow.shouldSpawnGhostUnit(10)) spawnCountLow++;

        const rngHigh = new SeededRandom(i);
        const engineHigh = new IntelligenceReliabilityEngine(
          GAME_CONFIG.intelReliability,
          rngHigh,
        );
        if (engineHigh.shouldSpawnGhostUnit(35)) spawnCountHigh++;
      }

      expect(spawnCountLow).toBeGreaterThan(spawnCountHigh);
    });

    it('reliability of 0 gives highest spawn chance', () => {
      let spawnCount = 0;
      const iterations = 200;

      for (let i = 0; i < iterations; i++) {
        const localRng = new SeededRandom(i);
        const localEngine = new IntelligenceReliabilityEngine(
          GAME_CONFIG.intelReliability,
          localRng,
        );
        if (localEngine.shouldSpawnGhostUnit(0)) spawnCount++;
      }

      // With reliability 0, effectiveProbability = 0.3 × (40 - 0) / 40 = 0.3
      // Expect roughly 30% of 200 = ~60 spawns
      expect(spawnCount).toBeGreaterThan(0);
    });

    it('deterministic with same RNG seed', () => {
      const rng1 = new SeededRandom(42);
      const engine1 = new IntelligenceReliabilityEngine(GAME_CONFIG.intelReliability, rng1);

      const rng2 = new SeededRandom(42);
      const engine2 = new IntelligenceReliabilityEngine(GAME_CONFIG.intelReliability, rng2);

      const results1: boolean[] = [];
      const results2: boolean[] = [];
      for (let i = 0; i < 20; i++) {
        results1.push(engine1.shouldSpawnGhostUnit(20));
        results2.push(engine2.shouldSpawnGhostUnit(20));
      }

      expect(results1).toEqual(results2);
    });
  });

  // ── createGhostUnit ──────────────────────────────────

  describe('createGhostUnit', () => {
    it('ghost unit has isGhost === true', () => {
      const ghost = engine.createGhostUnit(
        FactionId.US,
        FactionId.China,
        '3:4' as HexId,
        5 as TurnNumber,
      );

      expect(ghost.unit.isGhost).toBe(true);
    });

    it('ghost unit has hp === 0, attackPower === 0, defensePower === 0', () => {
      const ghost = engine.createGhostUnit(
        FactionId.US,
        FactionId.China,
        '3:4' as HexId,
        5 as TurnNumber,
      );

      expect(ghost.unit.hp).toBe(0);
      expect(ghost.unit.attackPower).toBe(0);
      expect(ghost.unit.defensePower).toBe(0);
    });

    it('ghost unit factionId matches targetFaction', () => {
      const ghost = engine.createGhostUnit(
        FactionId.US,
        FactionId.Russia,
        '2:1' as HexId,
        3 as TurnNumber,
      );

      expect(ghost.unit.factionId).toBe(FactionId.Russia);
    });

    it('ghost unit position matches provided HexId', () => {
      const position = '7:9' as HexId;
      const ghost = engine.createGhostUnit(
        FactionId.EU,
        FactionId.Iran,
        position,
        1 as TurnNumber,
      );

      expect(ghost.unit.position).toBe(position);
    });

    it('expiryTurn equals spawnTurn + ghostUnitDecayTurns', () => {
      const spawnTurn = 5 as TurnNumber;
      const ghost = engine.createGhostUnit(
        FactionId.US,
        FactionId.China,
        '0:0' as HexId,
        spawnTurn,
      );

      const expectedExpiry = (5 + GAME_CONFIG.intelReliability.ghostUnitDecayTurns) as TurnNumber;
      expect(ghost.expiryTurn).toBe(expectedExpiry);
    });

    it('ghost unit has a conventional unitType', () => {
      const ghost = engine.createGhostUnit(
        FactionId.Japan,
        FactionId.DPRK,
        '1:1' as HexId,
        2 as TurnNumber,
      );

      const conventionalTypes = [
        UnitType.Infantry,
        UnitType.Armor,
        UnitType.Naval,
        UnitType.Air,
      ];
      expect(conventionalTypes).toContain(ghost.unit.unitType);
    });

    it('observingFaction is set correctly', () => {
      const ghost = engine.createGhostUnit(
        FactionId.EU,
        FactionId.Syria,
        '5:5' as HexId,
        4 as TurnNumber,
      );

      expect(ghost.observingFaction).toBe(FactionId.EU);
    });
  });

  // ── shouldSpawnFalsePact ─────────────────────────────

  describe('shouldSpawnFalsePact', () => {
    it('returns false when reliability >= threshold', () => {
      const result = engine.shouldSpawnFalsePact(50);

      expect(result).toBe(false);
    });

    it('may return true when reliability is low', () => {
      const results: boolean[] = [];
      for (let i = 0; i < 50; i++) {
        const localRng = new SeededRandom(i);
        const localEngine = new IntelligenceReliabilityEngine(
          GAME_CONFIG.intelReliability,
          localRng,
        );
        results.push(localEngine.shouldSpawnFalsePact(10));
      }

      expect(results).toContain(true);
    });

    it('uses falsePactSpawnProbability (different from ghost probability)', () => {
      expect(GAME_CONFIG.intelReliability.falsePactSpawnProbability).toBe(0.2);
      expect(GAME_CONFIG.intelReliability.ghostUnitSpawnProbability).toBe(0.3);
      expect(GAME_CONFIG.intelReliability.falsePactSpawnProbability).not.toBe(
        GAME_CONFIG.intelReliability.ghostUnitSpawnProbability,
      );
    });
  });

  // ── createFalsePact ──────────────────────────────────

  describe('createFalsePact', () => {
    it('false pact has revealed === false initially', () => {
      const pact = engine.createFalsePact(
        FactionId.US,
        [FactionId.China, FactionId.Russia],
        3 as TurnNumber,
      );

      expect(pact.revealed).toBe(false);
    });

    it('revealTurn equals spawnTurn + falsePactRevealTurns', () => {
      const spawnTurn = 4 as TurnNumber;
      const pact = engine.createFalsePact(
        FactionId.Japan,
        [FactionId.Iran, FactionId.DPRK],
        spawnTurn,
      );

      const expectedReveal = (4 + GAME_CONFIG.intelReliability.falsePactRevealTurns) as TurnNumber;
      expect(pact.revealTurn).toBe(expectedReveal);
    });

    it('allegedFactions matches provided pair', () => {
      const pair: [FactionId, FactionId] = [FactionId.EU, FactionId.Syria];
      const pact = engine.createFalsePact(FactionId.US, pair, 1 as TurnNumber);

      expect(pact.allegedFactions).toEqual(pair);
    });

    it('observingFaction is set correctly', () => {
      const pact = engine.createFalsePact(
        FactionId.Russia,
        [FactionId.US, FactionId.Japan],
        2 as TurnNumber,
      );

      expect(pact.observingFaction).toBe(FactionId.Russia);
    });
  });

  // ── processGhostDecay ────────────────────────────────

  describe('processGhostDecay', () => {
    function makeGhostRecord(
      spawnTurn: number,
      expiryTurn: number,
    ): GhostUnitRecord {
      return {
        unit: {
          id: `ghost-${spawnTurn}-1` as UnitId,
          factionId: FactionId.China,
          unitType: UnitType.Infantry,
          hp: 0,
          attackPower: 0,
          defensePower: 0,
          movementRange: 0,
          specialAbilities: [],
          supplyStatus: 0,
          morale: 0,
          position: '0:0' as HexId,
          isGhost: true,
        },
        observingFaction: FactionId.US,
        spawnTurn: spawnTurn as TurnNumber,
        expiryTurn: expiryTurn as TurnNumber,
      };
    }

    it('active ghosts remain when currentTurn < expiryTurn', () => {
      const ghost = makeGhostRecord(1, 4);
      const result: GhostDecayResult = engine.processGhostDecay(
        [ghost],
        2 as TurnNumber,
      );

      expect(result.active).toHaveLength(1);
      expect(result.expired).toHaveLength(0);
    });

    it('ghosts expire when currentTurn >= expiryTurn', () => {
      const ghost = makeGhostRecord(1, 4);
      const result: GhostDecayResult = engine.processGhostDecay(
        [ghost],
        4 as TurnNumber,
      );

      expect(result.expired).toHaveLength(1);
      expect(result.active).toHaveLength(0);
    });

    it('mixed list is correctly partitioned', () => {
      const active1 = makeGhostRecord(3, 6);
      const active2 = makeGhostRecord(4, 7);
      const expired1 = makeGhostRecord(1, 4);
      const expired2 = makeGhostRecord(2, 5);

      const result: GhostDecayResult = engine.processGhostDecay(
        [active1, active2, expired1, expired2],
        5 as TurnNumber,
      );

      expect(result.active).toHaveLength(2);   // active1 (expiry 6), active2 (expiry 7)
      expect(result.expired).toHaveLength(2);   // expired1 (expiry 4), expired2 (expiry 5)
    });
  });

  // ── processFalsePactReveal ───────────────────────────

  describe('processFalsePactReveal', () => {
    function makePactRecord(
      spawnTurn: number,
      revealTurn: number,
    ): FalsePactRecord {
      return {
        id: `false-pact-${spawnTurn}-1`,
        observingFaction: FactionId.US,
        allegedFactions: [FactionId.China, FactionId.Russia] as const,
        spawnTurn: spawnTurn as TurnNumber,
        revealTurn: revealTurn as TurnNumber,
        revealed: false,
      };
    }

    it('hidden pacts remain when currentTurn < revealTurn', () => {
      const pact = makePactRecord(1, 3);
      const result: FalsePactRevealResult = engine.processFalsePactReveal(
        [pact],
        2 as TurnNumber,
      );

      expect(result.hidden).toHaveLength(1);
      expect(result.revealed).toHaveLength(0);
    });

    it('pacts are revealed when currentTurn >= revealTurn, revealed flag set to true', () => {
      const pact = makePactRecord(1, 3);
      const result: FalsePactRevealResult = engine.processFalsePactReveal(
        [pact],
        3 as TurnNumber,
      );

      expect(result.revealed).toHaveLength(1);
      expect(result.revealed[0]!.revealed).toBe(true);
      expect(result.hidden).toHaveLength(0);
    });

    it('mixed list is correctly partitioned', () => {
      const hidden1 = makePactRecord(3, 5);
      const hidden2 = makePactRecord(4, 6);
      const revealed1 = makePactRecord(1, 3);
      const revealed2 = makePactRecord(2, 4);

      const result: FalsePactRevealResult = engine.processFalsePactReveal(
        [hidden1, hidden2, revealed1, revealed2],
        4 as TurnNumber,
      );

      expect(result.hidden).toHaveLength(2);    // hidden1 (revealTurn 5), hidden2 (revealTurn 6)
      expect(result.revealed).toHaveLength(2);   // revealed1 (revealTurn 3), revealed2 (revealTurn 4)
    });
  });

  // ── investInIntelligence ─────────────────────────────

  describe('investInIntelligence', () => {
    it('increases reliability by diSpent × reliabilityBoostPerDI', () => {
      const result = engine.investInIntelligence(50, 3);

      // 50 + 3 * 5 = 65
      expect(result).toBe(65);
    });

    it('caps at maxReliability', () => {
      const result = engine.investInIntelligence(80, 10);

      // 80 + 10 * 5 = 130 → clamped to 95
      expect(result).toBe(GAME_CONFIG.intelReliability.maxReliability);
    });
  });
});
