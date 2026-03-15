/**
 * Expanded Nation Roster Engine — FR-4800
 *
 * 12 pure functions for querying and transforming the 18-nation roster,
 * flashpoints, and relationship seeds.
 *
 * **No side effects** — all functions are stateless transformations.
 *
 * @see FR-4801 — Nation roster definitions
 * @see FR-4802 — Regional groupings
 * @see FR-4803 — Alliance eligibility
 * @see FR-4804 — Exchange / currency mapping
 * @see FR-4805 — Default leader assignments
 * @see FR-4806 — Relationship seeds
 * @see FR-4807 — Flashpoint definitions
 */

import type {
  NationRosterState,
  NationRosterEntry,
  FlashpointDefinition,
  ExpandedNationId,
  NationCapabilitySummary,
  ExpandedRelationshipSeed,
} from '@/data/types/nation-roster.types';
import { ALL_NATIONS, EXPANDED_NATION_COUNT } from '@/data/types/nation-roster.types';

// ═══════════════════════════════════════════════════════════════════════════
// 1 — initializeRosterState                                       FR-4801
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a {@link NationRosterState} from a configuration object.
 *
 * @param config - Object with `nations`, `flashpoints`, and `relationshipSeeds` arrays.
 * @returns A fully initialised roster state.
 * @see FR-4801
 */
export function initializeRosterState(config: {
  readonly nations: readonly NationRosterEntry[];
  readonly flashpoints: readonly FlashpointDefinition[];
  readonly relationshipSeeds: readonly ExpandedRelationshipSeed[];
}): NationRosterState {
  return {
    nations: [...config.nations],
    flashpoints: [...config.flashpoints],
    relationshipSeeds: [...config.relationshipSeeds],
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 2 — getNation                                                   FR-4801
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Look up a single nation by its ID.
 *
 * @param state  - Current roster state.
 * @param nationId - The nation to find.
 * @returns The matching entry, or `undefined` if not found.
 * @see FR-4801
 */
export function getNation(
  state: NationRosterState,
  nationId: ExpandedNationId,
): NationRosterEntry | undefined {
  return state.nations.find((n) => n.id === nationId);
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 — getNationsByRegion                                          FR-4802
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Return all nations belonging to a specific region.
 *
 * @param state  - Current roster state.
 * @param region - Region string to match (case-sensitive).
 * @returns Array of nations in the given region.
 * @see FR-4802
 */
export function getNationsByRegion(
  state: NationRosterState,
  region: string,
): NationRosterEntry[] {
  return state.nations.filter((n) => n.region === region);
}

// ═══════════════════════════════════════════════════════════════════════════
// 4 — getNewNations                                               FR-4801
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Return only the 10 newly-added nations.
 *
 * @param state - Current roster state.
 * @returns Array of nations with `isOriginal === false`.
 * @see FR-4801
 */
export function getNewNations(state: NationRosterState): NationRosterEntry[] {
  return state.nations.filter((n) => !n.isOriginal);
}

// ═══════════════════════════════════════════════════════════════════════════
// 5 — getOriginalNations                                          FR-4801
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Return only the 8 original nations.
 *
 * @param state - Current roster state.
 * @returns Array of nations with `isOriginal === true`.
 * @see FR-4801
 */
export function getOriginalNations(state: NationRosterState): NationRosterEntry[] {
  return state.nations.filter((n) => n.isOriginal);
}

// ═══════════════════════════════════════════════════════════════════════════
// 6 — getFlashpointsForNation                                     FR-4807
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Return all flashpoints in which a given nation is listed as a primary participant.
 *
 * @param state    - Current roster state.
 * @param nationId - The nation to query.
 * @returns Array of flashpoint definitions involving the nation.
 * @see FR-4807
 */
export function getFlashpointsForNation(
  state: NationRosterState,
  nationId: ExpandedNationId,
): FlashpointDefinition[] {
  return state.flashpoints.filter((fp) =>
    fp.primaryNations.includes(nationId),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 7 — getRelationshipSeed                                         FR-4806
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Look up the initial tension value between two nations.
 *
 * The lookup is bidirectional — `(a, b)` matches a seed stored as `(b, a)`.
 *
 * @param state   - Current roster state.
 * @param nation1 - First nation ID.
 * @param nation2 - Second nation ID.
 * @returns The `initialTension` value, or `0` if no seed exists.
 * @see FR-4806
 */
export function getRelationshipSeed(
  state: NationRosterState,
  nation1: ExpandedNationId,
  nation2: ExpandedNationId,
): number {
  const seed = state.relationshipSeeds.find(
    (rs) =>
      (rs.nation1 === nation1 && rs.nation2 === nation2) ||
      (rs.nation1 === nation2 && rs.nation2 === nation1),
  );
  return seed?.initialTension ?? 0;
}

// ═══════════════════════════════════════════════════════════════════════════
// 8 — buildExpandedRelationshipMatrix                             FR-4806
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Build a full 18×18 relationship matrix from the roster's seed data.
 *
 * Diagonal entries (self-relations) are always `0`.
 * Missing pairs default to `0`.
 *
 * @param state - Current roster state.
 * @returns A symmetric `Record<string, Record<string, number>>`.
 * @see FR-4806
 */
export function buildExpandedRelationshipMatrix(
  state: NationRosterState,
): Record<string, Record<string, number>> {
  const ids = state.nations.map((n) => n.id);
  const matrix: Record<string, Record<string, number>> = {};

  for (const row of ids) {
    matrix[row] = {};
    for (const col of ids) {
      matrix[row]![col] = row === col ? 0 : getRelationshipSeed(state, row, col);
    }
  }

  return matrix;
}

// ═══════════════════════════════════════════════════════════════════════════
// 9 — getNationsWithAllianceEligibility                           FR-4803
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Return all nations eligible for a given alliance or bloc.
 *
 * @param state    - Current roster state.
 * @param alliance - Alliance name to match (e.g. `'NATO'`, `'BRICS'`).
 * @returns Array of matching nation entries.
 * @see FR-4803
 */
export function getNationsWithAllianceEligibility(
  state: NationRosterState,
  alliance: string,
): NationRosterEntry[] {
  return state.nations.filter((n) => n.allianceEligibility.includes(alliance));
}

// ═══════════════════════════════════════════════════════════════════════════
// 10 — getNuclearCapableNations                                   FR-4801
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Filter a capabilities array to only nuclear-capable nations.
 *
 * @param capabilities - Array of nation capability summaries.
 * @returns Only those entries where `nuclearCapable` is `true`.
 * @see FR-4801
 */
export function getNuclearCapableNations(
  capabilities: NationCapabilitySummary[],
): NationCapabilitySummary[] {
  return capabilities.filter((c) => c.nuclearCapable);
}

// ═══════════════════════════════════════════════════════════════════════════
// 11 — validateRosterCompleteness                                 FR-4801
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Verify that every nation in {@link ALL_NATIONS} is present in the roster.
 *
 * @param state - Current roster state.
 * @returns An object with `complete` boolean and `missing` nation IDs.
 * @see FR-4801
 */
export function validateRosterCompleteness(
  state: NationRosterState,
): { complete: boolean; missing: string[] } {
  const presentIds = new Set(state.nations.map((n) => n.id));
  const missing = ALL_NATIONS.filter((id) => !presentIds.has(id));
  return { complete: missing.length === 0, missing: [...missing] };
}

// ═══════════════════════════════════════════════════════════════════════════
// 12 — getRosterSummary                                           FR-4801
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Produce a high-level summary of the current roster state.
 *
 * @param state - Current roster state.
 * @returns Object with counts, region list, and flashpoint count.
 * @see FR-4801
 */
export function getRosterSummary(state: NationRosterState): {
  total: number;
  original: number;
  new: number;
  regions: string[];
  flashpointCount: number;
} {
  const original = state.nations.filter((n) => n.isOriginal).length;
  const regions = [...new Set(state.nations.map((n) => n.region))].sort();

  return {
    total: state.nations.length,
    original,
    new: state.nations.length - original,
    regions,
    flashpointCount: state.flashpoints.length,
  };
}
