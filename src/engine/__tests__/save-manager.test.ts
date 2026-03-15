import { describe, it, expect, beforeEach } from 'vitest';
import { SaveManager } from '@/engine/save-manager';
import { useGameStore } from '@/engine/store';

import type { GameState } from '@/data/types/gamestate.types';
import type { TurnEngineState } from '@/engine/turn-engine';
import type { SaveEnvelope } from '@/engine/save-manager';
import type { ScenarioDefinition } from '@/data/types/scenario.types';
import type { FactionId, TurnNumber } from '@/data/types/enums';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

/** Minimal mock scenario — mirrors store.test.ts pattern. */
function createMockScenario(): ScenarioDefinition {
  const factions: FactionId[] = ['us' as FactionId, 'china' as FactionId];

  return {
    meta: {
      id: 'test-scenario',
      name: 'Test Scenario',
      version: '0.1.0',
      author: 'Test',
      description: 'Minimal scenario for unit testing',
      maxTurns: 30,
    },
    factions,
    relationshipMatrix: {
      ['us' as FactionId]: { ['us' as FactionId]: 0, ['china' as FactionId]: 50 },
      ['china' as FactionId]: { ['us' as FactionId]: 50, ['china' as FactionId]: 0 },
    } as ScenarioDefinition['relationshipMatrix'],
    nationStates: {
      ['us' as FactionId]: {
        factionId: 'us' as FactionId,
        stability: 70,
        treasury: 5_000,
        gdp: 25_000,
        inflation: 3,
        militaryReadiness: 80,
        nuclearThreshold: 10,
        diplomaticInfluence: 90,
        popularity: 60,
        allianceCredibility: 85,
        techLevel: 85,
      },
      ['china' as FactionId]: {
        factionId: 'china' as FactionId,
        stability: 65,
        treasury: 4_000,
        gdp: 18_000,
        inflation: 2,
        militaryReadiness: 75,
        nuclearThreshold: 15,
        diplomaticInfluence: 70,
        popularity: 55,
        allianceCredibility: 60,
        techLevel: 80,
      },
    } as unknown as ScenarioDefinition['nationStates'],
    geographicPostures: {} as ScenarioDefinition['geographicPostures'],
    nationFaultLines: {} as ScenarioDefinition['nationFaultLines'],
    mapConfig: { width: 10, height: 10, defaultTerrain: 'Plains', hexOverrides: [] },
    units: [],
    militaryForceStructures: {} as ScenarioDefinition['militaryForceStructures'],
    intelligenceCapabilities: {} as ScenarioDefinition['intelligenceCapabilities'],
    aiProfiles: {} as ScenarioDefinition['aiProfiles'],
    cognitiveBiasDefinitions: [],
    interpersonalChemistry: [],
    massPsychology: {} as ScenarioDefinition['massPsychology'],
    mediaEcosystems: {} as ScenarioDefinition['mediaEcosystems'],
    technologyIndices: {} as ScenarioDefinition['technologyIndices'],
    techBlocInfo: {} as ScenarioDefinition['techBlocInfo'],
    resourceSecurity: {} as ScenarioDefinition['resourceSecurity'],
    climateEvents: [],
    nonStateActors: [],
    proxyRelationships: [],
    flashpoints: [],
    victoryConditions: [],
    lossConditions: [],
    eventTimeline: [],
  };
}

/**
 * Obtain a fully-initialised GameState by running the store's
 * `initializeFromScenario` action — guarantees every field is populated.
 */
function createMockGameState(): GameState {
  const store = useGameStore;
  store.getState().resetGame();
  store.getState().initializeFromScenario(
    createMockScenario(),
    'us' as FactionId,
  );
  // Extract only GameState fields (strip Zustand action methods).
  const full = store.getState();
  const actionKeys = [
    'initializeFromScenario',
    'advanceTurn',
    'setGameOver',
    'resetGame',
    'addPolicy',
    'removePolicy',
  ] as const;
  const gameState = { ...full };
  for (const key of actionKeys) {
    delete (gameState as Record<string, unknown>)[key];
  }
  return gameState as unknown as GameState;
}

/** Minimal TurnEngineState fixture. */
function createMockEngineState(): TurnEngineState {
  return {
    rngState: { seed: 42, state: 42, callCount: 0 },
    eventLog: [],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SaveManager', () => {
  let mgr: SaveManager;
  let gameState: GameState;
  let engineState: TurnEngineState;

  beforeEach(() => {
    localStorage.clear();
    mgr = new SaveManager();
    gameState = createMockGameState();
    engineState = createMockEngineState();
  });

  // ─── Roundtrip ──────────────────────────────────────

  describe('save/load roundtrip (FR-103)', () => {
    it('preserves all GameState fields through a save/load cycle', () => {
      const saveRes = mgr.save('slot-1', gameState, engineState);
      expect(saveRes.success).toBe(true);

      const loadRes = mgr.load('slot-1');
      expect(loadRes.success).toBe(true);
      expect(loadRes.envelope).toBeDefined();
      expect(loadRes.envelope!.gameState).toEqual(gameState);
    });

    it('preserves engineState (rngState + eventLog) through a cycle', () => {
      const engineWithLog: TurnEngineState = {
        rngState: { seed: 99, state: 12345, callCount: 7 },
        eventLog: [
          {
            id: 'evt-1' as import('@/data/types/enums').EventId,
            turn: 1 as TurnNumber,
            category: 'Diplomacy' as import('@/data/types/enums').EventCategory,
            sourceFaction: 'us' as FactionId,
            targetFactions: ['china' as FactionId],
            actionKey: 'test-action',
            description: 'A test event for roundtrip verification',
            payload: { delta: 5 },
            timestamp: new Date().toISOString(),
          },
        ],
      };

      mgr.save('slot-eng', gameState, engineWithLog);
      const loadRes = mgr.load('slot-eng');
      expect(loadRes.success).toBe(true);
      expect(loadRes.envelope!.engineState).toEqual(engineWithLog);
    });
  });

  // ─── Checksum validation (NFR-401) ──────────────────

  describe('checksum validation (NFR-401)', () => {
    it('detects and rejects a tampered save', () => {
      mgr.save('tampered', gameState, engineState);
      const key = 'conflict-2026-slot-tampered';
      const raw = localStorage.getItem(key)!;
      const envelope = JSON.parse(raw) as SaveEnvelope;

      // Tamper with the game state
      const tampered = {
        ...envelope,
        gameState: { ...envelope.gameState, gameOver: true },
      };
      localStorage.setItem(key, JSON.stringify(tampered));

      const loadRes = mgr.load('tampered');
      expect(loadRes.success).toBe(false);
      expect(loadRes.error).toContain('checksum mismatch');
    });

    it('detects tampered engineState', () => {
      mgr.save('tampered-eng', gameState, engineState);
      const key = 'conflict-2026-slot-tampered-eng';
      const raw = localStorage.getItem(key)!;
      const envelope = JSON.parse(raw) as SaveEnvelope;

      const tampered = {
        ...envelope,
        engineState: {
          ...envelope.engineState,
          rngState: { seed: 999, state: 999, callCount: 999 },
        },
      };
      localStorage.setItem(key, JSON.stringify(tampered));

      const loadRes = mgr.load('tampered-eng');
      expect(loadRes.success).toBe(false);
      expect(loadRes.error).toContain('checksum mismatch');
    });
  });

  // ─── Corrupted JSON ─────────────────────────────────

  describe('corrupted JSON handling', () => {
    it('returns error for invalid JSON without crashing', () => {
      localStorage.setItem('conflict-2026-slot-bad', '{{{not json!!!');
      const loadRes = mgr.load('bad');
      expect(loadRes.success).toBe(false);
      expect(loadRes.error).toContain('invalid JSON');
    });

    it('returns error for missing gameState / engineState', () => {
      const incomplete = JSON.stringify({ version: 1, checksum: 'abc' });
      localStorage.setItem('conflict-2026-slot-incomplete', incomplete);
      const loadRes = mgr.load('incomplete');
      expect(loadRes.success).toBe(false);
      expect(loadRes.error).toContain('missing gameState or engineState');
    });
  });

  // ─── Multiple slots ─────────────────────────────────

  describe('multiple slots', () => {
    it('saves to 3 slots and listSlots returns all 3', () => {
      mgr.save('alpha', gameState, engineState);
      mgr.save('beta', gameState, engineState);
      mgr.save('gamma', gameState, engineState);

      const slots = mgr.listSlots();
      expect(slots).toHaveLength(3);
      const names = slots.map((s) => s.slotName);
      expect(names).toContain('alpha');
      expect(names).toContain('beta');
      expect(names).toContain('gamma');
    });

    it('listSlots is sorted by savedAt descending', () => {
      // Save sequentially so timestamps differ
      mgr.save('first', gameState, engineState);
      mgr.save('second', gameState, engineState);
      mgr.save('third', gameState, engineState);

      const slots = mgr.listSlots();
      for (let i = 0; i < slots.length - 1; i++) {
        expect(
          new Date(slots[i]!.savedAt).getTime(),
        ).toBeGreaterThanOrEqual(
          new Date(slots[i + 1]!.savedAt).getTime(),
        );
      }
    });
  });

  // ─── Delete slot ────────────────────────────────────

  describe('deleteSlot', () => {
    it('removes a saved slot from storage', () => {
      mgr.save('to-delete', gameState, engineState);
      expect(mgr.hasSlot('to-delete')).toBe(true);

      const res = mgr.deleteSlot('to-delete');
      expect(res.success).toBe(true);
      expect(mgr.hasSlot('to-delete')).toBe(false);
    });

    it('returns error when deleting a non-existent slot', () => {
      const res = mgr.deleteSlot('no-such-slot');
      expect(res.success).toBe(false);
      expect(res.error).toContain('not found');
    });
  });

  // ─── Delete all slots ───────────────────────────────

  describe('deleteAllSlots', () => {
    it('clears all managed slots including autosave', () => {
      mgr.save('one', gameState, engineState);
      mgr.save('two', gameState, engineState);
      mgr.autosave(gameState, engineState);

      mgr.deleteAllSlots();

      expect(mgr.getSlotCount()).toBe(0);
      expect(mgr.hasSlot('one')).toBe(false);
      expect(mgr.hasSlot('two')).toBe(false);
      expect(mgr.loadAutosave().success).toBe(false);
    });

    it('does not remove keys from other prefixes', () => {
      localStorage.setItem('other-prefix-key', 'keep-me');
      mgr.save('slot-a', gameState, engineState);

      mgr.deleteAllSlots();
      expect(localStorage.getItem('other-prefix-key')).toBe('keep-me');
    });
  });

  // ─── hasSlot ────────────────────────────────────────

  describe('hasSlot', () => {
    it('returns true for an existing slot', () => {
      mgr.save('exists', gameState, engineState);
      expect(mgr.hasSlot('exists')).toBe(true);
    });

    it('returns false for a non-existent slot', () => {
      expect(mgr.hasSlot('nope')).toBe(false);
    });
  });

  // ─── Autosave ───────────────────────────────────────

  describe('autosave', () => {
    it('saves and loads autosave independently from named slots', () => {
      mgr.save('named', gameState, engineState);
      mgr.autosave(gameState, engineState);

      const autoRes = mgr.loadAutosave();
      expect(autoRes.success).toBe(true);
      expect(autoRes.envelope!.metadata.slotName).toBe('__autosave__');

      const namedRes = mgr.load('named');
      expect(namedRes.success).toBe(true);
      expect(namedRes.envelope!.metadata.slotName).toBe('named');
    });

    it('autosave does not count towards slot limit', () => {
      const tiny = new SaveManager({ maxSlots: 1 });
      tiny.save('only-slot', gameState, engineState);
      // Autosave should still work even though we're at max
      const autoRes = tiny.autosave(gameState, engineState);
      expect(autoRes.success).toBe(true);
    });

    it('autosave is excluded from listSlots', () => {
      mgr.save('visible', gameState, engineState);
      mgr.autosave(gameState, engineState);

      const slots = mgr.listSlots();
      expect(slots).toHaveLength(1);
      expect(slots[0]!.slotName).toBe('visible');
    });
  });

  // ─── Max slots enforcement ──────────────────────────

  describe('max slots enforcement', () => {
    it('rejects new saves when at max capacity', () => {
      const limited = new SaveManager({ maxSlots: 2 });
      limited.save('a', gameState, engineState);
      limited.save('b', gameState, engineState);

      const res = limited.save('c', gameState, engineState);
      expect(res.success).toBe(false);
      expect(res.error).toContain('Maximum save slots reached');
    });

    it('allows overwriting an existing slot when at max', () => {
      const limited = new SaveManager({ maxSlots: 2 });
      limited.save('a', gameState, engineState);
      limited.save('b', gameState, engineState);

      const res = limited.save('a', gameState, engineState);
      expect(res.success).toBe(true);
    });
  });

  // ─── Metadata correctness ──────────────────────────

  describe('metadata', () => {
    it('captures correct turnNumber, calendarDate, scenarioName, playerFaction', () => {
      mgr.save('meta-check', gameState, engineState);
      const loadRes = mgr.load('meta-check');
      expect(loadRes.success).toBe(true);
      const meta = loadRes.envelope!.metadata;

      expect(meta.turnNumber).toBe(gameState.currentTurn);
      expect(meta.scenarioName).toBe('Test Scenario');
      expect(meta.playerFaction).toBe('us');
      // Turn 1 = March 2026
      expect(meta.calendarDate).toBe('March 2026');
    });

    it('records a valid ISO-8601 savedAt timestamp', () => {
      mgr.save('ts-check', gameState, engineState);
      const loadRes = mgr.load('ts-check');
      const savedAt = loadRes.envelope!.metadata.savedAt;
      expect(new Date(savedAt).toISOString()).toBe(savedAt);
    });
  });

  // ─── Version check ──────────────────────────────────

  describe('version check', () => {
    it('rejects an envelope with an unsupported future version', () => {
      mgr.save('versioned', gameState, engineState);
      const key = 'conflict-2026-slot-versioned';
      const raw = localStorage.getItem(key)!;
      const envelope = JSON.parse(raw) as SaveEnvelope;

      const futureVersion = { ...envelope, version: 999 };
      localStorage.setItem(key, JSON.stringify(futureVersion));

      const loadRes = mgr.load('versioned');
      expect(loadRes.success).toBe(false);
      expect(loadRes.error).toContain('Unsupported save version');
    });
  });

  // ─── Empty / non-existent slot ──────────────────────

  describe('non-existent slot', () => {
    it('returns not-found error when loading a slot that does not exist', () => {
      const loadRes = mgr.load('ghost');
      expect(loadRes.success).toBe(false);
      expect(loadRes.error).toContain('not found');
    });
  });

  // ─── Empty slot name validation ─────────────────────

  describe('slot name validation', () => {
    it('rejects an empty slot name', () => {
      const res = mgr.save('', gameState, engineState);
      expect(res.success).toBe(false);
      expect(res.error).toContain('empty');
    });

    it('rejects a whitespace-only slot name', () => {
      const res = mgr.save('   ', gameState, engineState);
      expect(res.success).toBe(false);
      expect(res.error).toContain('empty');
    });
  });

  // ─── Custom options ─────────────────────────────────

  describe('custom options', () => {
    it('uses a custom storage prefix', () => {
      const custom = new SaveManager({ storagePrefix: 'test-prefix-' });
      custom.save('x', gameState, engineState);
      expect(localStorage.getItem('test-prefix-x')).not.toBeNull();
    });

    it('instances with different prefixes are isolated', () => {
      const a = new SaveManager({ storagePrefix: 'ns-a-' });
      const b = new SaveManager({ storagePrefix: 'ns-b-' });

      a.save('shared-name', gameState, engineState);
      expect(b.hasSlot('shared-name')).toBe(false);
    });
  });
});
