/**
 * Expanded Nation Roster Types (FR-4800)
 * @see FR-4801 – FR-4807
 */

/** All 18 nation IDs in the expanded roster */
export type ExpandedNationId =
  | 'us' | 'china' | 'russia' | 'japan' | 'iran' | 'dprk' | 'eu' | 'syria'
  | 'mexico' | 'brazil' | 'australia' | 'taiwan' | 'india' | 'pakistan'
  | 'afghanistan' | 'saudi_arabia' | 'egypt' | 'lebanon';

export const ORIGINAL_NATIONS: readonly ExpandedNationId[] = [
  'us', 'china', 'russia', 'japan', 'iran', 'dprk', 'eu', 'syria',
] as const;

export const NEW_NATIONS: readonly ExpandedNationId[] = [
  'mexico', 'brazil', 'australia', 'taiwan', 'india', 'pakistan',
  'afghanistan', 'saudi_arabia', 'egypt', 'lebanon',
] as const;

export const ALL_NATIONS: readonly ExpandedNationId[] = [
  ...ORIGINAL_NATIONS, ...NEW_NATIONS,
] as const;

export const EXPANDED_NATION_COUNT = 18 as const;

/** Metadata for a nation in the expanded roster */
export interface NationRosterEntry {
  readonly id: ExpandedNationId;
  readonly displayName: string;
  readonly region: string;
  readonly defaultLeaderId: string;
  readonly politicalSystem: string;
  readonly exchangeId: string | null;
  readonly currencyCode: string;
  readonly allianceEligibility: readonly string[];
  readonly isOriginal: boolean;
}

/** Flashpoint definition for new inter-nation conflicts */
export interface FlashpointDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly primaryNations: readonly ExpandedNationId[];
  readonly triggerConditions: readonly string[];
  readonly escalationStages: readonly string[];
  readonly maxSeverity: number;
}

/** 18×18 relationship seed for the expanded matrix */
export interface ExpandedRelationshipSeed {
  readonly nation1: ExpandedNationId;
  readonly nation2: ExpandedNationId;
  readonly initialTension: number; // -100 to +100
  readonly description: string;
}

/** Summary of nation capabilities */
export interface NationCapabilitySummary {
  readonly nationId: ExpandedNationId;
  readonly stability: number;
  readonly gdp: number;
  readonly militaryPower: number;
  readonly techLevel: number;
  readonly diplomaticInfluence: number;
  readonly nuclearCapable: boolean;
}

/** Roster state used by the engine */
export interface NationRosterState {
  readonly nations: readonly NationRosterEntry[];
  readonly flashpoints: readonly FlashpointDefinition[];
  readonly relationshipSeeds: readonly ExpandedRelationshipSeed[];
}
