/**
 * Scenario Definition Type — DR-105
 *
 * The top-level JSON structure that defines an entire game scenario.
 * Loaded at game start; validated against scenario.schema.json.
 *
 * Contains ONLY initial/static setup data. Runtime-generated data
 * (event logs, viability scores, etc.) lives in GameState.
 */

import type { FactionId, HexId, TurnNumber } from './enums';
import type { HexState } from './core.types';
import type { NationState, GeographicPosture, NationFaultLines } from './nation.types';
import type {
  LeaderProfile,
  LeaderBiasAssignment,
  MassPsychologyIndex,
  EmotionalStateSnapshot,
  InterpersonalChemistry,
} from './leader.types';
import type { Unit, MilitaryForceStructure, IntelligenceCapabilityMatrix } from './military.types';
import type { MediaEcosystemConfig } from './infowar.types';
import type { TechnologyIndex, NationTechBlocInfo } from './technology.types';
import type {
  ResourceSecurityIndex,
  ClimateEvent,
} from './resources.types';
import type { NonStateActor, ProxyRelationship } from './proxy.types';
import type { CognitiveBiasDefinition } from './leader.types';
import type { TensionLevel } from './core.types';

// ---------------------------------------------------------------------------
// Flashpoint & Victory Conditions (used only in scenario config)
// ---------------------------------------------------------------------------

/**
 * A flashpoint variable seeding the initial game state.
 */
export interface FlashpointVariable {
  id: string;
  name: string;
  description: string;
  /** Key metrics affected and their initial values. */
  metricImpacts: Record<string, number | string>;
}

/**
 * A victory condition definition.
 */
export interface VictoryConditionDef {
  /** Unique identifier (e.g. "economic_dominance"). */
  id: string;
  /** Display name. */
  name: string;
  /** Description of what achieving this condition entails. */
  description: string;
  /** Metrics and thresholds that must be met. */
  requirements: Record<string, number | string>;
}

/**
 * A loss condition definition.
 */
export interface LossConditionDef {
  id: string;
  name: string;
  description: string;
  /** Metrics and thresholds that trigger this loss. */
  triggers: Record<string, number | string>;
}

/**
 * An event timeline entry — pre-scripted event that fires on a specific turn.
 */
export interface TimelineEvent {
  /** Turn on which this event triggers. */
  turn: TurnNumber;
  /** Event identifier. */
  eventKey: string;
  /** Display name. */
  name: string;
  /** Description of the event. */
  description: string;
  /** State modifications to apply. */
  effects: Record<string, unknown>;
}

/**
 * Map configuration for the hex grid.
 */
export interface MapConfig {
  /** Number of hex columns. */
  width: number;
  /** Number of hex rows. */
  height: number;
  /** Default terrain for unspecified hexes. */
  defaultTerrain: string;
  /** Explicitly configured hexes (override defaults). */
  hexOverrides: HexState[];
}

// ---------------------------------------------------------------------------
// AI Profile Configuration
// ---------------------------------------------------------------------------

/**
 * Per-faction AI behavior configuration for the scenario.
 * Combines the leader's psychological profile with initial emotional state
 * and bias assignments.
 */
export interface AIProfileConfig {
  factionId: FactionId;
  leader: LeaderProfile;
  initialEmotionalState: EmotionalStateSnapshot;
  biasAssignments: LeaderBiasAssignment[];
}

// ---------------------------------------------------------------------------
// DR-105 — Scenario Definition (top-level)
// ---------------------------------------------------------------------------

/**
 * The complete scenario definition JSON structure.
 *
 * This is what gets loaded from disk, validated against the JSON Schema,
 * and used to initialize the GameState.
 */
export interface ScenarioDefinition {
  /** Scenario metadata. */
  meta: {
    /** Unique scenario identifier. */
    id: string;
    /** Display name (e.g. "March 2026 — The Reciprocal Era"). */
    name: string;
    /** Version string for this scenario file. */
    version: string;
    /** Author or source. */
    author: string;
    /** Brief description. */
    description: string;
    /** Maximum number of turns in this scenario. */
    maxTurns: number;
  };

  /** The 8 faction IDs active in this scenario. */
  factions: FactionId[];

  /** Initial relationship matrix (tension levels). */
  relationshipMatrix: Record<FactionId, Record<FactionId, TensionLevel>>;

  /** Initial nation states. */
  nationStates: Record<FactionId, NationState>;

  /** Geographic posture per nation. */
  geographicPostures: Record<FactionId, GeographicPosture>;

  /** Ethnic/religious fault lines per nation. */
  nationFaultLines: Record<FactionId, NationFaultLines>;

  /** Map configuration. */
  mapConfig: MapConfig;

  /** Initial military units. */
  units: Unit[];

  /** Military force structures per nation. */
  militaryForceStructures: Record<FactionId, MilitaryForceStructure>;

  /** Intelligence capabilities per nation. */
  intelligenceCapabilities: Record<FactionId, IntelligenceCapabilityMatrix>;

  /** AI leader profiles and initial psychological state. */
  aiProfiles: Record<FactionId, AIProfileConfig>;

  /** Global cognitive bias definitions. */
  cognitiveBiasDefinitions: CognitiveBiasDefinition[];

  /** Initial interpersonal chemistry between leaders. */
  interpersonalChemistry: InterpersonalChemistry[];

  /** Initial mass psychology per nation. */
  massPsychology: Record<FactionId, MassPsychologyIndex>;

  /** Media ecosystem configuration per nation. */
  mediaEcosystems: Record<FactionId, MediaEcosystemConfig>;

  /** Technology indices per nation. */
  technologyIndices: Record<FactionId, TechnologyIndex>;

  /** Tech bloc alignment configuration. */
  techBlocInfo: Record<FactionId, NationTechBlocInfo>;

  /** Initial resource security per nation. */
  resourceSecurity: Record<FactionId, ResourceSecurityIndex>;

  /** Pre-scheduled climate events. */
  climateEvents: ClimateEvent[];

  /** Non-state actors present at game start. */
  nonStateActors: NonStateActor[];

  /** Initial proxy relationships. */
  proxyRelationships: ProxyRelationship[];

  /** Flashpoint variables seeding the initial state. */
  flashpoints: FlashpointVariable[];

  /** Victory conditions for the player. */
  victoryConditions: VictoryConditionDef[];

  /** Loss conditions for the player. */
  lossConditions: LossConditionDef[];

  /** Pre-scripted event timeline. */
  eventTimeline: TimelineEvent[];

  /** Hex map keyed by HexId (derived from mapConfig at load time or provided). */
  hexMap?: Record<HexId, HexState>;
}
