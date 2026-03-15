/**
 * Typed React hooks for the New Order game store.
 *
 * These hooks provide convenient access to specific slices of game state
 * and keep components subscribed only to the data they need via Zustand's
 * selector-based subscription model.
 */

import { useGameStore } from './store';

import type { GameActions } from './store';
import type { FactionId, TurnNumber, NationState } from '@/data/types';
import type { MapViewState } from '@/data/types/map-view.types';
import type { ActionSlate } from '@/data/types/action-slate.types';
import type { InnovationState } from '@/data/types/innovation.types';
import type { NationalPolicyState } from '@/data/types/policy.types';
import type { NationCivilWarState } from '@/data/types/civil-war.types';

/** Re-export the raw store hook for full state + action access. */
export { useGameStore };

/** Select the current turn number. */
export function useCurrentTurn(): TurnNumber {
  return useGameStore((s) => s.currentTurn);
}

/** Select the player's faction. */
export function usePlayerFaction(): FactionId {
  return useGameStore((s) => s.playerFaction);
}

/** Select a specific nation's state by faction ID. */
export function useNationState(factionId: FactionId): NationState | undefined {
  return useGameStore((s) => s.nationStates[factionId]);
}

/** Select whether the game is over. */
export function useIsGameOver(): boolean {
  return useGameStore((s) => s.gameOver);
}

/** Select only the store actions (non-state). Action refs are stable across renders. */
export function useGameActions(): GameActions {
  const initializeFromScenario = useGameStore(
    (s) => s.initializeFromScenario,
  );
  const advanceTurn = useGameStore((s) => s.advanceTurn);
  const setGameOver = useGameStore((s) => s.setGameOver);
  const resetGame = useGameStore((s) => s.resetGame);
  const addPolicy = useGameStore((s) => s.addPolicy);
  const removePolicy = useGameStore((s) => s.removePolicy);
  return { initializeFromScenario, advanceTurn, setGameOver, resetGame, addPolicy, removePolicy };
}

// ── v10 Feature Hooks ─────────────────────────────────────────────────────

/** Select the interactive map view state. */
export function useMapViewState(): MapViewState | null {
  return useGameStore((s) => s.mapViewState);
}

/** Select the player's multi-action turn slate. */
export function useActionSlate(): ActionSlate | null {
  return useGameStore((s) => s.actionSlate);
}

/** Select the global innovation research/discovery state. */
export function useInnovationState(): InnovationState | null {
  return useGameStore((s) => s.innovationState);
}

/** Select a specific nation's policy state. */
export function useNationalPolicies(factionId: FactionId): NationalPolicyState | undefined {
  return useGameStore((s) => s.nationalPolicies[factionId]);
}

/** Select a specific nation's civil war / protest state. */
export function useCivilWarState(factionId: FactionId): NationCivilWarState | undefined {
  return useGameStore((s) => s.civilWarStates[factionId]);
}
