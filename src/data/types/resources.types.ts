/**
 * Climate and Resource Types — DR-132, DR-133, DR-134
 *
 * Resource security tracking, climate event queuing,
 * and refugee flow management.
 */

import type {
  FactionId,
  ClimateEventType,
  RefugeeResponse,
  RefugeeCause,
  TurnNumber,
} from './enums';

// ---------------------------------------------------------------------------
// DR-132 — Resource Security Index
// ---------------------------------------------------------------------------

/**
 * Strategic reserve stockpile levels.
 */
export interface StrategicReserves {
  /** Energy reserves (e.g. oil, gas) in months of consumption. */
  energy: number;
  /** Food reserves in months of consumption. */
  food: number;
  /** Water reserves in months of consumption. */
  water: number;
  /** Critical mineral reserves in months of consumption. */
  criticalMinerals: number;
}

/**
 * Per-nation import dependency mapping — how dependent each resource
 * category is on foreign imports. Values are 0–100 (percentage).
 */
export interface ImportDependency {
  energy: number;
  food: number;
  water: number;
  criticalMinerals: number;
}

/**
 * A single resource leverage action — using resource control as a weapon.
 */
export interface ResourceLeverage {
  /** The resource being leveraged. */
  resource: string;
  /** Target nation being coerced. */
  target: FactionId;
  /** Description of the leverage action. */
  description: string;
  /** Turn the leverage was initiated. */
  turnInitiated: TurnNumber;
  /** Whether the leverage is currently active. */
  active: boolean;
}

/**
 * Per-nation per-turn resource security index (DR-132).
 *
 * Indices below 30 trigger escalating crises:
 * inflation → rationing → famine/collapse.
 */
export interface ResourceSecurityIndex {
  factionId: FactionId;
  turn: TurnNumber;
  /** Energy security. Range: 0–100. */
  energy: number;
  /** Food security. Range: 0–100. */
  food: number;
  /** Water security. Range: 0–100. */
  water: number;
  /** Critical minerals security. Range: 0–100. */
  criticalMinerals: number;
  /** Stockpile levels. */
  strategicReserves: StrategicReserves;
  /** Active resource leverage actions by this nation. */
  activeResourceLeverage: ResourceLeverage[];
  /** Import dependency percentages. */
  importDependency: ImportDependency;
}

// ---------------------------------------------------------------------------
// DR-133 — Climate Event Queue
// ---------------------------------------------------------------------------

/**
 * A single climate event — scheduled, active, or resolved.
 */
export interface ClimateEvent {
  /** Type of climate disaster. */
  type: ClimateEventType;
  /** Geographic region affected (hex region or nation label). */
  targetRegion: string;
  /** Severity of the event. Range: 1–10. */
  severity: number;
  /** Turn when this event triggers. */
  turnToFire: TurnNumber;
  /**
   * Recurrence frequency in turns (0 = one-time event).
   * Increases over game time to simulate accelerating climate change.
   */
  frequency: number;
  /** Whether this event has already fired. */
  fired: boolean;
  /** Resolution description (populated after the event resolves). */
  resolution: string | null;
  /** Impact summary (populated after the event resolves). */
  impactSummary: string | null;
}

/**
 * Global climate event queue (DR-133).
 *
 * Upcoming and historical events. Frequency increases over game time
 * to simulate accelerating climate instability.
 */
export interface ClimateEventQueue {
  /** Events yet to fire. */
  upcoming: ClimateEvent[];
  /** Events that have already fired. */
  historical: ClimateEvent[];
}

// ---------------------------------------------------------------------------
// DR-134 — Refugee Flow Tracker
// ---------------------------------------------------------------------------

/**
 * A single active refugee flow between nations.
 */
export interface RefugeeFlow {
  /** Nation the refugees are fleeing from. */
  sourceNation: FactionId;
  /** Nation receiving (or rejecting) the refugees. */
  targetNation: FactionId;
  /** Number of refugees in this wave (in thousands). */
  waveSize: number;
  /** Root cause of displacement. */
  cause: RefugeeCause;
  /** How many turns this flow has been active. */
  turnsActive: number;
  /** How the target nation is responding. */
  response: RefugeeResponse;
}

/**
 * Global refugee flow tracker (DR-134).
 */
export interface RefugeeFlowTracker {
  turn: TurnNumber;
  /** All active refugee flows. */
  activeFlows: RefugeeFlow[];
}
