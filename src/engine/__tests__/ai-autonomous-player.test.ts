/**
 * Tests for CNFL-3901 — AI Autonomous Player
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GameState } from '@/data/types';
import { ALL_FACTIONS, FactionId as FID } from '@/data/types';

// ── Mock UtilityEvaluator ───────────────────────────────────────────────────
vi.mock('../ai-evaluator', () => ({
  UtilityEvaluator: {
    evaluate: vi.fn(),
  },
}));

import { UtilityEvaluator } from '../ai-evaluator';
import {
  AutonomousPlayer,
  generateCandidateActions,
  profileToWeights,
  ACTION_CATEGORIES,
  type TurnDecisions,
  type FactionDecision,
} from '../ai/ai-autonomous-player';

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeState(overrides: Record<string, unknown> = {}): GameState {
  const nationStates: Record<string, unknown> = {};
  for (const f of ALL_FACTIONS) {
    nationStates[f] = {
      gdp: 15000,
      militaryReadiness: 55,
      stability: 50,
      treasury: 300,
      popularity: 50,
      diplomaticInfluence: 40,
    };
  }

  const matrix: Record<string, Record<string, number>> = {};
  for (const a of ALL_FACTIONS) {
    matrix[a] = {};
    for (const b of ALL_FACTIONS) {
      if (a !== b) matrix[a]![b] = 50;
    }
  }

  return {
    scenarioMeta: { maxTurns: 60, id: 'test', name: 'Test' },
    currentTurn: 1,
    playerFaction: FID.US,
    nationStates,
    relationshipMatrix: matrix,
    leaderProfiles: {},
    emotionalStates: {},
    gameOver: false,
    gameEndReason: null,
    ...overrides,
  } as unknown as GameState;
}

function mockEvaluator() {
  (UtilityEvaluator.evaluate as ReturnType<typeof vi.fn>).mockImplementation(
    (ctx: { candidateActions: Array<{ name: string }> }) => ({
      selectedAction: ctx.candidateActions[0] ?? null,
      rankedActions: ctx.candidateActions.map((a, i) => ({
        action: a,
        finalScore: 100 - i * 5,
        breakdown: {},
      })),
      log: [],
    }),
  );
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('AutonomousPlayer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEvaluator();
  });

  // ── Constructor & config ───────────────────────────────────────────────

  describe('constructor & config', () => {
    it('should use default config values', () => {
      const player = new AutonomousPlayer();
      const factions = player.getControlledFactions();
      expect(factions).toEqual(expect.arrayContaining([...ALL_FACTIONS]));
    });

    it('should respect aiFactions config', () => {
      const player = new AutonomousPlayer({
        aiFactions: [FID.US, FID.China],
      });
      expect(player.getControlledFactions()).toEqual([FID.US, FID.China]);
    });

    it('should exclude manualFactions', () => {
      const player = new AutonomousPlayer({
        manualFactions: [FID.US],
      });
      const controlled = player.getControlledFactions();
      expect(controlled).not.toContain(FID.US);
      expect(controlled.length).toBe(ALL_FACTIONS.length - 1);
    });

    it('should accept custom rng', () => {
      let called = false;
      const rng = () => { called = true; return 0.5; };
      const player = new AutonomousPlayer({ strategy: 'random', rng });
      player.decideTurn(makeState(), 1);
      expect(called).toBe(true);
    });
  });

  // ── decideTurn ─────────────────────────────────────────────────────────

  describe('decideTurn', () => {
    it('should return TurnDecisions for all controlled factions', () => {
      const player = new AutonomousPlayer({ aiFactions: [FID.US, FID.China] });
      const result: TurnDecisions = player.decideTurn(makeState(), 5);
      expect(result.turn).toBe(5);
      expect(result.decisions).toHaveLength(2);
      expect(result.timestamp).toBeGreaterThan(0);
    });

    it('should skip manual factions', () => {
      const player = new AutonomousPlayer({
        aiFactions: [FID.US, FID.China, FID.Russia],
        manualFactions: [FID.China],
      });
      const result = player.decideTurn(makeState(), 1);
      expect(result.decisions).toHaveLength(2);
      const factionIds = result.decisions.map((d) => d.factionId);
      expect(factionIds).toContain(FID.US);
      expect(factionIds).toContain(FID.Russia);
      expect(factionIds).not.toContain(FID.China);
    });
  });

  // ── Strategy: rule-based ───────────────────────────────────────────────

  describe('rule-based strategy', () => {
    it('should call UtilityEvaluator.evaluate for each faction', () => {
      const player = new AutonomousPlayer({
        strategy: 'rule-based',
        aiFactions: [FID.US, FID.China],
      });
      player.decideTurn(makeState(), 1);
      expect(UtilityEvaluator.evaluate).toHaveBeenCalledTimes(2);
    });

    it('should pass candidate actions to evaluator', () => {
      const player = new AutonomousPlayer({
        strategy: 'rule-based',
        aiFactions: [FID.US],
      });
      player.decideTurn(makeState(), 1);
      const call = (UtilityEvaluator.evaluate as ReturnType<typeof vi.fn>).mock.calls[0]![0];
      expect(call.candidateActions).toBeDefined();
      expect(call.candidateActions.length).toBeGreaterThan(0);
    });

    it('should pass difficulty to evaluator', () => {
      const player = new AutonomousPlayer({
        strategy: 'rule-based',
        aiFactions: [FID.US],
        difficulty: 1.5,
      });
      player.decideTurn(makeState(), 1);
      const call = (UtilityEvaluator.evaluate as ReturnType<typeof vi.fn>).mock.calls[0]![0];
      expect(call.difficulty).toBe('aggressive');
    });

    it('should include reasoning with score in decision', () => {
      const player = new AutonomousPlayer({
        strategy: 'rule-based',
        aiFactions: [FID.US],
      });
      const result = player.decideTurn(makeState(), 1);
      const decision: FactionDecision = result.decisions[0]!;
      expect(decision.selectedAction).not.toBeNull();
      expect(decision.reasoning).toContain('Selected');
    });

    it('should handle no candidate actions', () => {
      (UtilityEvaluator.evaluate as ReturnType<typeof vi.fn>).mockReturnValue({
        selectedAction: null,
        rankedActions: [],
        log: [],
      });

      const state = makeState({ nationStates: {} });
      const player = new AutonomousPlayer({
        strategy: 'rule-based',
        aiFactions: [FID.US],
      });
      const result = player.decideTurn(state, 1);
      expect(result.decisions[0]!.selectedAction).toBeNull();
    });
  });

  // ── Strategy: random ───────────────────────────────────────────────────

  describe('random strategy', () => {
    it('should select a random action', () => {
      const player = new AutonomousPlayer({
        strategy: 'random',
        aiFactions: [FID.US],
        rng: () => 0.0, // always picks first
      });
      const result = player.decideTurn(makeState(), 1);
      const decision = result.decisions[0]!;
      expect(decision.selectedAction).not.toBeNull();
      expect(decision.reasoning).toContain('Random');
    });

    it('should not call UtilityEvaluator', () => {
      const player = new AutonomousPlayer({
        strategy: 'random',
        aiFactions: [FID.US],
      });
      player.decideTurn(makeState(), 1);
      expect(UtilityEvaluator.evaluate).not.toHaveBeenCalled();
    });
  });

  // ── Strategy: passive ──────────────────────────────────────────────────

  describe('passive strategy', () => {
    it('should take no action', () => {
      const player = new AutonomousPlayer({
        strategy: 'passive',
        aiFactions: [FID.US],
      });
      const result = player.decideTurn(makeState(), 1);
      const decision = result.decisions[0]!;
      expect(decision.selectedAction).toBeNull();
      expect(decision.reasoning).toContain('Passive');
    });

    it('should not call UtilityEvaluator', () => {
      const player = new AutonomousPlayer({
        strategy: 'passive',
        aiFactions: [FID.US],
      });
      player.decideTurn(makeState(), 1);
      expect(UtilityEvaluator.evaluate).not.toHaveBeenCalled();
    });
  });

  // ── Missing faction ────────────────────────────────────────────────────

  describe('missing faction state', () => {
    it('should return null action with reasoning', () => {
      const state = makeState({ nationStates: {} });
      const player = new AutonomousPlayer({
        strategy: 'rule-based',
        aiFactions: [FID.US],
      });
      const result = player.decideTurn(state, 1);
      expect(result.decisions[0]!.selectedAction).toBeNull();
      expect(result.decisions[0]!.reasoning).toContain('No nation state');
    });
  });
});

// ── generateCandidateActions ─────────────────────────────────────────────

describe('generateCandidateActions', () => {
  it('should generate actions for a valid faction', () => {
    const state = makeState();
    const actions = generateCandidateActions(FID.US, state);
    expect(actions.length).toBeGreaterThan(5);
  });

  it('should include all action categories', () => {
    const state = makeState();
    const actions = generateCandidateActions(FID.US, state);
    const categories = new Set(actions.map((a) => a.category));
    expect(categories.has('diplomatic')).toBe(true);
    expect(categories.has('military')).toBe(true);
    expect(categories.has('economic')).toBe(true);
    expect(categories.has('intelligence')).toBe(true);
    expect(categories.has('domestic')).toBe(true);
  });

  it('should return empty array for missing faction', () => {
    const state = makeState({ nationStates: {} });
    const actions = generateCandidateActions(FID.US, state);
    expect(actions).toEqual([]);
  });

  it('should generate diplomatic actions for each other faction', () => {
    const state = makeState();
    const actions = generateCandidateActions(FID.US, state);
    const diplo = actions.filter((a) => a.category === 'diplomatic');
    expect(diplo.length).toBeGreaterThan(0);
    // Should have at least one diplomatic action per other faction
    const targets = new Set(diplo.map((a) => a.targetFaction).filter(Boolean));
    expect(targets.size).toBeGreaterThan(0);
  });

  it('should generate summit actions when tension is high', () => {
    const matrix: Record<string, Record<string, number>> = {};
    for (const a of ALL_FACTIONS) {
      matrix[a] = {};
      for (const b of ALL_FACTIONS) {
        if (a !== b) matrix[a]![b] = 80; // high tension
      }
    }
    const state = makeState({ relationshipMatrix: matrix });
    const actions = generateCandidateActions(FID.US, state);
    const summits = actions.filter((a) => a.name.includes('summit'));
    expect(summits.length).toBeGreaterThan(0);
  });

  it('should generate extreme actions when stability is very low', () => {
    const nationStates: Record<string, unknown> = {};
    for (const f of ALL_FACTIONS) {
      nationStates[f] = {
        gdp: 15000, militaryReadiness: 55, stability: 20, treasury: 300,
      };
    }
    const state = makeState({ nationStates });
    const actions = generateCandidateActions(FID.US, state);
    const extreme = actions.filter((a) => a.isExtreme);
    expect(extreme.length).toBeGreaterThan(0);
  });

  it('should NOT generate extreme actions when stability is normal', () => {
    const state = makeState();
    const actions = generateCandidateActions(FID.US, state);
    const extreme = actions.filter((a) => a.isExtreme);
    expect(extreme).toHaveLength(0);
  });

  it('should assign unique IDs to all actions', () => {
    const state = makeState();
    const actions = generateCandidateActions(FID.US, state);
    const ids = new Set(actions.map((a) => a.id));
    expect(ids.size).toBe(actions.length);
  });
});

// ── profileToWeights ─────────────────────────────────────────────────────

describe('profileToWeights', () => {
  it('should return default weights when no leader profile', () => {
    const state = makeState({ leaderProfiles: {} });
    const weights = profileToWeights(state, FID.US);
    expect(weights.aggression).toBe(50);
    expect(weights.economicFocus).toBe(50);
    expect(weights.diplomaticPreference).toBe(50);
  });

  it('should extract weights from leader psychology', () => {
    const state = makeState({
      leaderProfiles: {
        leader1: {
          faction: FID.US,
          psychology: {
            riskTolerance: 75,
            pragmatism: 60,
            empathy: 40,
            paranoia: 30,
          },
        },
      },
    });
    const weights = profileToWeights(state, FID.US);
    expect(weights.aggression).toBe(75); // riskTolerance
    expect(weights.economicFocus).toBe(60); // pragmatism
    expect(weights.diplomaticPreference).toBe(40); // empathy
    expect(weights.riskTolerance).toBe(75); // riskTolerance
    expect(weights.domesticPriority).toBe(30); // paranoia
  });

  it('should return default weights for unknown faction', () => {
    const state = makeState({
      leaderProfiles: {
        leader1: { faction: FID.China, psychology: { riskTolerance: 80 } },
      },
    });
    const weights = profileToWeights(state, FID.US);
    expect(weights.aggression).toBe(50);
  });
});

// ── ACTION_CATEGORIES ────────────────────────────────────────────────────

describe('ACTION_CATEGORIES', () => {
  it('should contain 5 categories', () => {
    expect(ACTION_CATEGORIES).toHaveLength(5);
    expect(ACTION_CATEGORIES).toContain('diplomatic');
    expect(ACTION_CATEGORIES).toContain('military');
    expect(ACTION_CATEGORIES).toContain('economic');
    expect(ACTION_CATEGORIES).toContain('intelligence');
    expect(ACTION_CATEGORIES).toContain('domestic');
  });
});
