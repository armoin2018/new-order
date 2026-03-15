/**
 * Emergent Technology Types — FR-6100
 *
 * Per-nation technology differentiation, AI-driven emergent technology
 * generation beyond predefined models, and cross-industry impact cascading.
 *
 * Key concepts:
 * - NationTechProfile: Per-nation tech identity (strengths, focus, history)
 * - EmergentTechnology: Novel tech concepts generated during gameplay
 * - CrossIndustryImpact: How emergent techs ripple across sectors
 * - EmergentTechState: Top-level state slice
 *
 * @see FR-6100 — Emergent Technology & Per-Nation Tech Differentiation
 */

import type { FactionId, TechDomain } from './enums';

// ---------------------------------------------------------------------------
// FR-6100 — Nation Tech Profile
// ---------------------------------------------------------------------------

/**
 * Research focus area a nation can prioritise.
 * Extends beyond the 6 TechDomains to include cross-cutting disciplines.
 */
export type ResearchFocus =
  | 'ai'
  | 'semiconductors'
  | 'space'
  | 'cyber'
  | 'biotech'
  | 'quantum'
  | 'materials_science'
  | 'energy_systems'
  | 'autonomous_systems'
  | 'neural_interfaces'
  | 'climate_tech'
  | 'nanotechnology'
  | 'genetic_engineering'
  | 'fusion_energy'
  | 'hypersonics';

/**
 * Per-nation technology identity describing strengths, focus areas,
 * and historical tech achievements unique to that country.
 *
 * This replaces the single aggregate `techLevel: 0-100` with a rich
 * multi-dimensional profile that drives emergent tech generation.
 */
export interface NationTechProfile {
  /** Nation this profile belongs to. */
  readonly factionId: FactionId;
  /** Primary research specialisations (max 3). Drive emergent tech themes. */
  researchFoci: ResearchFocus[];
  /** Domain-specific research efficiency multipliers (1.0 = baseline). */
  domainEfficiency: Record<TechDomain, number>;
  /** Innovation culture score: how likely novel/risky research succeeds. 0–100. */
  innovationCulture: number;
  /** R&D spending as % of GDP — drives research throughput. 0–10. */
  rdSpendingPct: number;
  /** Brain-drain factor: negative = losing talent, positive = attracting. −50 to +50. */
  talentFlow: number;
  /** Number of active research institutions (universities, labs). */
  researchInstitutions: number;
  /** IDs of emergent techs this nation has generated. */
  generatedTechIds: string[];
  /** IDs of emergent techs this nation has adopted from others (tech transfer). */
  adoptedTechIds: string[];
  /** Per-domain breakthrough count (historical). */
  breakthroughHistory: Record<TechDomain, number>;
  /** Turn this profile was last updated. */
  lastUpdatedTurn: number;
}

// ---------------------------------------------------------------------------
// FR-6100 — Emergent Technology
// ---------------------------------------------------------------------------

/**
 * Maturity stage of an emergent technology.
 */
export type EmergentTechMaturity =
  | 'theoretical'   // Just conceived — no practical application yet
  | 'experimental'  // Lab prototype exists
  | 'prototype'     // Working prototype, limited deployment
  | 'operational'   // Deployed and producing effects
  | 'mature';       // Widely adopted, diminishing returns on further investment

/**
 * Cross-industry sector that can be impacted by emergent technologies.
 */
export type IndustrySector =
  | 'defense'
  | 'healthcare'
  | 'finance'
  | 'energy'
  | 'agriculture'
  | 'manufacturing'
  | 'transportation'
  | 'communications'
  | 'education'
  | 'entertainment'
  | 'space_commercial'
  | 'intelligence';

/**
 * A single cross-industry impact from an emergent technology.
 */
export interface CrossIndustryImpact {
  /** Target industry sector. */
  sector: IndustrySector;
  /** Signed magnitude (−100 to +100). Positive = beneficial disruption. */
  magnitude: number;
  /** Human-readable description of the impact. */
  description: string;
  /** Delay in turns before impact materialises. 0 = immediate. */
  delayTurns: number;
  /** Whether the impact is temporary (fades over time). */
  temporary: boolean;
  /** Turns remaining if temporary. Null if permanent. */
  turnsRemaining: number | null;
}

/**
 * An emergent technology generated during gameplay — not from the
 * predefined 32 tech models. These represent novel breakthroughs
 * that arise from a nation's unique research trajectory.
 *
 * Examples:
 * - US + high AI + high Biotech → "Protein-Folding Drug Discovery"
 * - China + high Semiconductors + high Quantum → "Photonic Quantum Chips"
 * - Russia + high Cyber + high Space → "Orbital Cyber Warfare Platform"
 */
export interface EmergentTechnology {
  /** Unique identifier (generated: `emt-{factionId}-{turn}-{seq}`). */
  readonly emergentTechId: string;
  /** Display name of the emergent technology. */
  name: string;
  /** Detailed description of the technology and its significance. */
  description: string;
  /** Nation that originated this technology. */
  originFaction: FactionId;
  /** Turn on which the technology was first generated. */
  originTurn: number;
  /** Primary tech domain this belongs to. */
  primaryDomain: TechDomain;
  /** Secondary domains involved in creating this tech. */
  secondaryDomains: TechDomain[];
  /** Research focus areas that led to this discovery. */
  catalystFoci: ResearchFocus[];
  /** Current maturity level. */
  maturity: EmergentTechMaturity;
  /** Progress toward next maturity level. 0–100. */
  maturityProgress: number;
  /** Cross-industry impacts this technology produces. */
  crossIndustryImpacts: CrossIndustryImpact[];
  /** Domain score boosts applied while this tech is operational+. */
  domainBoosts: Partial<Record<TechDomain, number>>;
  /** Direct nation-state stat modifiers. */
  nationStatModifiers: {
    gdpGrowthPct?: number;          // −5 to +5
    stabilityDelta?: number;        // −20 to +20
    militaryReadinessDelta?: number; // −10 to +10
    techLevelDelta?: number;        // −10 to +10
    diplomaticInfluenceDelta?: number; // −10 to +10
    populationApprovalDelta?: number;  // −10 to +10
  };
  /** Whether other nations can adopt this tech (via transfer/espionage). */
  transferable: boolean;
  /** Minimum domain scores required for another nation to adopt. */
  adoptionRequirements: Partial<Record<TechDomain, number>>;
  /** Nations that have adopted this tech. */
  adoptedBy: FactionId[];
  /** Tags for categorisation and search. */
  tags: string[];
}

// ---------------------------------------------------------------------------
// FR-6100 — Emergent Tech Event
// ---------------------------------------------------------------------------

/**
 * Event emitted when an emergent technology is generated or matures.
 */
export interface EmergentTechEvent {
  /** The emergent tech that triggered this event. */
  emergentTechId: string;
  /** Nation associated with this event. */
  factionId: FactionId;
  /** Turn on which the event occurred. */
  turn: number;
  /** Type of event. */
  eventType: 'generation' | 'maturity_advance' | 'adoption' | 'industry_disruption';
  /** News headline for the event. */
  headline: string;
  /** Narrative description. */
  narrative: string;
  /** Immediate stat impacts applied this turn. */
  immediateImpacts: {
    dimension: string;
    magnitude: number;
  }[];
}

// ---------------------------------------------------------------------------
// FR-6100 — Emergent Tech State (Top-Level Game State Slice)
// ---------------------------------------------------------------------------

/**
 * Top-level state slice for the emergent technology subsystem.
 * Added to GameState alongside innovationState.
 */
export interface EmergentTechState {
  /** Per-nation technology profiles. */
  nationProfiles: Record<FactionId, NationTechProfile>;
  /** All emergent technologies generated during the game. */
  emergentTechs: Record<string, EmergentTechnology>;
  /** Chronological log of all emergent tech events. */
  eventLog: EmergentTechEvent[];
  /** Total emergent techs generated across all nations (monotonic counter). */
  totalGenerated: number;
  /** Global tech innovation velocity — affects all nations' generation chance. */
  globalInnovationVelocity: number;
}
