/**
 * Core World State Types — DR-101, DR-102, DR-106, DR-107
 *
 * These types represent the fundamental world state data structures
 * that every subsystem reads and writes each turn.
 */

import type {
  FactionId,
  HexId,
  TerrainType,
  EventId,
  EventCategory,
  HeadlinePerspective,
  TurnNumber,
} from './enums';

// ---------------------------------------------------------------------------
// DR-101 — Relationship Matrix
// ---------------------------------------------------------------------------

/**
 * Bilateral tension score between two factions.
 * Range: −100 (allied) to +100 (hostile).
 */
export type TensionLevel = number;

/**
 * A 2D matrix tracking pairwise TensionLevel for all 8 factions.
 * Indexed as `matrix[factionA][factionB]`.
 *
 * Invariants:
 * - `matrix[a][a] === 0` (self-relation is always zero)
 * - `matrix[a][b] === matrix[b][a]` (symmetric)
 */
export type RelationshipMatrix = Record<FactionId, Record<FactionId, TensionLevel>>;

// ---------------------------------------------------------------------------
// DR-102 — Hex-State Data
// ---------------------------------------------------------------------------

/**
 * Per-hex data representing territorial control, terrain, and conditions.
 *
 * - `nationControl` — which faction currently controls this hex (or null for contested/neutral)
 * - `terrainType` — base terrain classification
 * - `terrainBonus` — numeric modifier for combat on this hex (−20 to +20)
 * - `resourceYield` — economic output per turn (0–100)
 * - `civilianUnrest` — local population unrest level (0–100)
 * - `militaryPresence` — strength of stationed forces (0–100)
 * - `infrastructureLevel` — built infrastructure quality (0–100); affects supply & resource yield
 */
export interface HexState {
  readonly id: HexId;
  nationControl: FactionId | null;
  terrainType: TerrainType;
  /** Terrain combat modifier. Range: −20 to +20. */
  terrainBonus: number;
  /** Economic output per turn. Range: 0–100. */
  resourceYield: number;
  /** Local population unrest. Range: 0–100. */
  civilianUnrest: number;
  /** Military force density. Range: 0–100. */
  militaryPresence: number;
  /** Built infrastructure quality. Range: 0–100. */
  infrastructureLevel: number;
}

/** The full hex map keyed by HexId. */
export type HexMap = Record<HexId, HexState>;

// ---------------------------------------------------------------------------
// DR-106 — Event Log
// ---------------------------------------------------------------------------

/**
 * A single event log entry. Append-only per turn.
 *
 * Used for replay, debugging, post-game analysis, and the headline system.
 */
export interface EventLogEntry {
  readonly id: EventId;
  /** Turn in which this event occurred. */
  turn: TurnNumber;
  /** Broad classification. */
  category: EventCategory;
  /** Which faction initiated the event (null for system/environment events). */
  sourceFaction: FactionId | null;
  /** Which faction(s) are affected. */
  targetFactions: FactionId[];
  /** Human-readable summary. */
  description: string;
  /** Machine-readable action key (e.g. "IMPOSE_SANCTIONS", "LAUNCH_STRIKE"). */
  actionKey: string;
  /** Arbitrary key-value payload for subsystem-specific data. */
  payload: Record<string, unknown>;
  /** ISO-8601 timestamp of when the event was logged. */
  timestamp: string;
}

/** The full event log — ordered array of entries. */
export type EventLog = EventLogEntry[];

// ---------------------------------------------------------------------------
// DR-107 — Headline Archive
// ---------------------------------------------------------------------------

/**
 * A single headline from one of three media perspectives.
 */
export interface Headline {
  /** Which perspective generated this headline. */
  perspective: HeadlinePerspective;
  /** The headline text. */
  text: string;
  /** Optional sub-headline or lede paragraph. */
  subtext?: string;
  /** The event(s) this headline references. */
  relatedEventIds: EventId[];
}

/**
 * Per-turn headline set: one headline per perspective.
 */
export interface TurnHeadlines {
  turn: TurnNumber;
  headlines: Record<HeadlinePerspective, Headline>;
}

/** The full headline archive across all turns. */
export type HeadlineArchive = TurnHeadlines[];
