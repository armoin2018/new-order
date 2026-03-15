import { describe, it, expect } from 'vitest';
import { TurnPhase, ALL_TURN_PHASES } from '@/workers/protocol';

import type { SimWorkerMessage, SimWorkerResponse } from '@/workers/protocol';

// ---------------------------------------------------------------------------
// Protocol Smoke Tests
// ---------------------------------------------------------------------------

describe('TurnPhase', () => {
  it('has exactly 6 phase values matching FR-102', () => {
    expect(ALL_TURN_PHASES).toHaveLength(6);
  });

  it('contains the correct phase strings', () => {
    expect(TurnPhase.Headlines).toBe('HEADLINES');
    expect(TurnPhase.PlayerActions).toBe('PLAYER_ACTIONS');
    expect(TurnPhase.AiEvaluation).toBe('AI_EVALUATION');
    expect(TurnPhase.ConflictResolution).toBe('CONFLICT_RESOLUTION');
    expect(TurnPhase.WorldStateUpdate).toBe('WORLD_STATE_UPDATE');
    expect(TurnPhase.EndOfTurnEvents).toBe('END_OF_TURN_EVENTS');
  });

  it('ALL_TURN_PHASES is in the correct sequential order', () => {
    const expected: readonly TurnPhase[] = [
      'HEADLINES',
      'PLAYER_ACTIONS',
      'AI_EVALUATION',
      'CONFLICT_RESOLUTION',
      'WORLD_STATE_UPDATE',
      'END_OF_TURN_EVENTS',
    ];
    expect(ALL_TURN_PHASES).toEqual(expected);
  });
});

describe('SimWorkerMessage discriminated union', () => {
  it('accepts valid INIT message shape', () => {
    const msg: SimWorkerMessage = {
      type: 'INIT',
      payload: { gameState: {} as SimWorkerMessage extends { type: 'INIT'; payload: infer P } ? P extends { gameState: infer G } ? G : never : never },
    };
    expect(msg.type).toBe('INIT');
  });

  it('accepts valid CANCEL message shape', () => {
    const msg: SimWorkerMessage = { type: 'CANCEL' };
    expect(msg.type).toBe('CANCEL');
  });
});

describe('SimWorkerResponse discriminated union', () => {
  it('accepts valid INIT_ACK response shape', () => {
    const res: SimWorkerResponse = {
      type: 'INIT_ACK',
      payload: { ready: true },
    };
    expect(res.type).toBe('INIT_ACK');
    if (res.type === 'INIT_ACK') {
      expect(res.payload.ready).toBe(true);
    }
  });

  it('accepts valid ERROR response shape', () => {
    const res: SimWorkerResponse = {
      type: 'ERROR',
      payload: { code: 'E001', message: 'Something failed', recoverable: false },
    };
    expect(res.type).toBe('ERROR');
    if (res.type === 'ERROR') {
      expect(res.payload.recoverable).toBe(false);
    }
  });

  it('accepts valid PROGRESS response shape', () => {
    const res: SimWorkerResponse = {
      type: 'PROGRESS',
      payload: { phase: TurnPhase.Headlines, progress: 0.5 },
    };
    expect(res.type).toBe('PROGRESS');
    if (res.type === 'PROGRESS') {
      expect(res.payload.progress).toBe(0.5);
    }
  });
});

// ---------------------------------------------------------------------------
// Compile-time exhaustiveness check helper
// ---------------------------------------------------------------------------

/**
 * Type-level exhaustiveness assertion. If the TurnPhase union is expanded
 * without updating ALL_TURN_PHASES, this function's call-site will produce
 * a compile error because `never` won't accept the unhandled variant.
 */
function assertExhaustive(_phase: never): never {
  throw new Error(`Unhandled phase: ${String(_phase)}`);
}

describe('exhaustiveness check (compile-time safety)', () => {
  it('covers every TurnPhase variant', () => {
    // This test verifies that switching on TurnPhase is exhaustive.
    // If a new phase is added to TurnPhase but not to this switch,
    // TypeScript will emit a compile error on the assertExhaustive call.
    for (const phase of ALL_TURN_PHASES) {
      switch (phase) {
        case TurnPhase.Headlines:
        case TurnPhase.PlayerActions:
        case TurnPhase.AiEvaluation:
        case TurnPhase.ConflictResolution:
        case TurnPhase.WorldStateUpdate:
        case TurnPhase.EndOfTurnEvents:
          // All known phases handled
          break;
        default:
          assertExhaustive(phase);
      }
    }
    // If we get here, all phases were handled
    expect(true).toBe(true);
  });
});
