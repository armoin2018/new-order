/**
 * Information Warfare Types — DR-125, DR-126, DR-127, DR-139
 *
 * The "invisible battlefield" — legitimacy, narrative campaigns,
 * social media virality, and media ecosystem configurations.
 */

import type {
  FactionId,
  NarrativeType,
  MediaEcosystemType,
  TurnNumber,
} from './enums';

// ---------------------------------------------------------------------------
// DR-125 — International Legitimacy Score
// ---------------------------------------------------------------------------

/**
 * A single entry in a nation's narrative battle history.
 */
export interface NarrativeBattleEntry {
  turn: TurnNumber;
  /** Who launched the narrative. */
  attacker: FactionId;
  /** Who was targeted. */
  defender: FactionId;
  /** Type of narrative deployed. */
  narrativeType: NarrativeType;
  /** Net legitimacy delta resulting from the battle. */
  legitimacyDelta: number;
  /** Whether the narrative was successfully countered. */
  countered: boolean;
}

/**
 * Per-nation per-turn international legitimacy state (DR-125).
 *
 * Legitimacy gates diplomatic options: low legitimacy blocks alliances;
 * high legitimacy amplifies diplomatic effectiveness.
 */
export interface InternationalLegitimacy {
  factionId: FactionId;
  turn: TurnNumber;
  /** Current legitimacy score. Range: 0–100. */
  legitimacy: number;
  /** Change in legitimacy this turn. */
  legitimacyDelta: number;
  /** Currently active narrative campaign (or null). */
  narrativeActive: NarrativeType | null;
  /** History of narrative battles involving this nation. */
  narrativeBattleHistory: NarrativeBattleEntry[];
  /**
   * Risk of a whistleblower exposing covert actions.
   * Range: 0–100. Increases with covert ops volume.
   */
  whistleblowerRisk: number;
}

// ---------------------------------------------------------------------------
// DR-126 — Narrative Campaign Log
// ---------------------------------------------------------------------------

/**
 * A single narrative campaign (active or historical).
 */
export interface NarrativeCampaign {
  /** The faction running this campaign. */
  sourceFaction: FactionId;
  /** Type of narrative deployed. */
  type: NarrativeType;
  /** Target nation of the campaign. */
  target: FactionId;
  /** Number of turns the campaign has been active. */
  turnsActive: number;
  /** Cumulative effectiveness. Range: 0–100. */
  effectivenessScore: number;
  /** Whether the campaign has been discovered by the target. */
  discovered: boolean;
  /** Peak virality score achieved. Range: 0–100. */
  viralityPeak: number;
}

/**
 * Per-nation narrative campaign log.
 */
export interface NarrativeCampaignLog {
  factionId: FactionId;
  activeCampaigns: NarrativeCampaign[];
  historicalCampaigns: NarrativeCampaign[];
}

// ---------------------------------------------------------------------------
// DR-127 — Social Media Virality Queue
// ---------------------------------------------------------------------------

/**
 * A single information event propagating through social media.
 */
export interface ViralityEvent {
  /** Nation that originated or leaked this information. */
  source: FactionId;
  /** Human-readable content/headline of the viral event. */
  content: string;
  /** Current virality score. Range: 0–100. */
  virality: number;
  /** Per-nation penetration level. Range: 0–100 per nation. */
  spreadMap: Partial<Record<FactionId, number>>;
  /** Whether a counter-narrative has been deployed. */
  counterNarrativeActive: boolean;
  /** Turns remaining before this event fades from public attention. */
  turnsToDecay: number;
}

/**
 * Global per-turn virality queue (DR-127).
 */
export interface SocialMediaViralityQueue {
  turn: TurnNumber;
  events: ViralityEvent[];
}

// ---------------------------------------------------------------------------
// DR-139 — Media Ecosystem Configuration
// ---------------------------------------------------------------------------

/**
 * Per-nation media ecosystem configuration (DR-139).
 *
 * Determines how information warfare operates within and against this nation.
 */
export interface MediaEcosystemConfig {
  factionId: FactionId;
  /** Classification of the nation's media environment. */
  type: MediaEcosystemType;
  /**
   * Multiplier for viral content spread within this nation.
   * 1.0 = baseline. Free Press ≈ 1.5, Closed System ≈ 0.3.
   */
  viralityMultiplier: number;
  /** Effectiveness of state censorship apparatus. Range: 0–100. */
  censorshipEffectiveness: number;
  /** Population resistance to propaganda. Range: 0–100. */
  propagandaResistance: number;
  /** Degree of government narrative control. Range: 0–100. */
  narrativeControlScore: number;
}
