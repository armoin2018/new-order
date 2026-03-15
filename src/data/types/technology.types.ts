/**
 * Technology Race Types — DR-130, DR-131, DR-138
 *
 * National tech indices, bloc alignment, export controls,
 * and dual-use technology accords.
 */

import type {
  FactionId,
  TechDomain,
  TechBlocAlignment,
  DecouplingStatus,
} from './enums';

// ---------------------------------------------------------------------------
// DR-130 — Technology Index Matrix
// ---------------------------------------------------------------------------

/**
 * A single active research project.
 */
export interface ActiveResearch {
  /** Technology domain being researched. */
  domain: TechDomain;
  /** Project name. */
  projectName: string;
  /** Turns invested so far. */
  turnsInvested: number;
  /** Estimated turns to completion. */
  turnsRemaining: number;
  /** Expected score boost on completion. */
  expectedBoost: number;
}

/**
 * Export control configuration — which domains are restricted and to whom.
 */
export type ExportControls = Partial<Record<TechDomain, FactionId[]>>;

/**
 * Per-nation technology index (DR-130).
 *
 * Six tech domains each scored 0–100. Tech levels provide compounding
 * bonuses to military, intelligence, economic, and diplomatic capabilities.
 */
export interface TechnologyIndex {
  factionId: FactionId;
  /** AI capability score. Range: 0–100. */
  ai: number;
  /** Semiconductor manufacturing capability. Range: 0–100. */
  semiconductors: number;
  /** Space technology capability. Range: 0–100. */
  space: number;
  /** Cyber technology capability. Range: 0–100. */
  cyber: number;
  /** Biotechnology capability. Range: 0–100. */
  biotech: number;
  /** Quantum computing capability. Range: 0–100. */
  quantum: number;
  /** Current tech bloc alignment (null if unaligned). */
  techBlocAlignment: TechBlocAlignment | null;
  /** Active research projects. */
  activeResearch: ActiveResearch[];
  /** Export control restrictions — maps domain to list of restricted nations. */
  exportControls: ExportControls;
}

// ---------------------------------------------------------------------------
// DR-131 — Tech Bloc Alignment Map
// ---------------------------------------------------------------------------

/**
 * Per-nation tech bloc membership and sharing data.
 */
export interface NationTechBlocInfo {
  factionId: FactionId;
  /** Which bloc this nation belongs to (null if non-aligned). */
  blocMembership: TechBlocAlignment | null;
  /** Nations this nation has tech-sharing agreements with. */
  techSharingPartners: FactionId[];
  /** Whether quantum threat is active for this nation. */
  quantumThreatActive: boolean;
  /** Whether quantum threat has been mitigated. */
  quantumThreatMitigated: boolean;
  /** Whether this nation has signed the Ethics Accords. */
  ethicsAccordSignatory: boolean;
}

/**
 * Global tech bloc alignment map (DR-131).
 */
export interface TechBlocAlignmentMap {
  /** Per-nation bloc information. */
  nations: Record<FactionId, NationTechBlocInfo>;
  /** Export control coalitions — groups of nations coordinating restrictions. */
  exportControlCoalitions: FactionId[][];
  /** Current global tech ecosystem status. */
  decouplingStatus: DecouplingStatus;
}

// ---------------------------------------------------------------------------
// DR-138 — Dual-Use Technology Accords
// ---------------------------------------------------------------------------

/**
 * A single violation of the Ethics Accords.
 */
export interface AccordViolation {
  /** Nation that violated the accords. */
  violator: FactionId;
  /** Description of the violation. */
  description: string;
  /** Turn the violation was detected (or committed if secret). */
  turn: number;
  /** Whether the violation is publicly known. */
  publiclyKnown: boolean;
}

/**
 * Per-nation compliance state for the dual-use technology accords.
 */
export interface NationAccordCompliance {
  factionId: FactionId;
  /** Whether this nation has signed the Ethics Accords. */
  signed: boolean;
  /** Overall compliance level. Range: 0–100. */
  compliance: number;
  /** Whether this nation has a secret violation. */
  secretViolation: boolean;
}

/**
 * Global dual-use technology accords state (DR-138).
 */
export interface DualUseTechAccords {
  /** Nations that have signed the accords. */
  signatories: FactionId[];
  /** Known and secret violations. */
  violations: AccordViolation[];
  /** Per-nation compliance data. */
  nationCompliance: Record<FactionId, NationAccordCompliance>;
}
