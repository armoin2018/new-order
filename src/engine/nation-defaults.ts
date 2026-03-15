/**
 * Nation Default Assignments — CNFL-3102, CNFL-3203, CNFL-3403
 *
 * Maps the 8 playable factions to their default political systems,
 * military equipment inventories, and education profiles.
 *
 * This is a pure data module — no engine logic, no side-effects.
 *
 * @module engine/nation-defaults
 */

import type { FactionId } from '@/data/types';

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

/** A single piece of military equipment assigned to a faction at game start. */
export interface DefaultEquipmentEntry {
  /** Equipment model id (matches models/military/\*\*\/\*.json `id` field). */
  readonly equipmentId: string;
  /** Starting quantity of this equipment. */
  readonly quantity: number;
  /** Readiness percentage (0–100). */
  readonly readiness: number;
}

/** A single education program assigned to a faction at game start. */
export interface DefaultEducationEntry {
  /** Education model id (matches models/education/\*.json `id` field). */
  readonly educationId: string;
  /** Investment level (0–100). */
  readonly investmentLevel: number;
  /** Number of turns the program has already been active. */
  readonly turnsActive: number;
}

/** Aggregate defaults for a single faction. */
export interface NationDefaults {
  readonly factionId: FactionId;
  readonly politicalSystemId: string;
  readonly equipment: readonly DefaultEquipmentEntry[];
  readonly education: readonly DefaultEducationEntry[];
}

// ---------------------------------------------------------------------------
// Political System Map
// ---------------------------------------------------------------------------

/**
 * Maps every faction to its starting political-system model id.
 * Ids correspond to `models/political-systems/*.json`.
 */
export const NATION_POLITICAL_SYSTEMS: Readonly<Record<FactionId, string>> = {
  us: 'liberal-democracy',
  china: 'one-party-state',
  russia: 'authoritarian-republic',
  japan: 'parliamentary-democracy',
  iran: 'theocracy',
  dprk: 'communist-state',
  eu: 'liberal-democracy',
  syria: 'hybrid-regime',
} as const;

// ---------------------------------------------------------------------------
// Equipment Inventory Map
// ---------------------------------------------------------------------------

/**
 * Maps every faction to its starting military equipment inventory.
 * Ids correspond to `models/military/**\/*.json`.
 */
export const NATION_EQUIPMENT_DEFAULTS: Readonly<
  Record<FactionId, readonly DefaultEquipmentEntry[]>
> = {
  // ── United States ──────────────────────────────────────────────────────
  us: [
    { equipmentId: 'f-35a-lightning', quantity: 300, readiness: 92 },
    { equipmentId: 'f-22-raptor', quantity: 186, readiness: 88 },
    { equipmentId: 'm1a2-abrams', quantity: 2500, readiness: 85 },
    { equipmentId: 'arleigh-burke-destroyer', quantity: 70, readiness: 90 },
    { equipmentId: 'gerald-ford-carrier', quantity: 4, readiness: 95 },
    { equipmentId: 'patriot-pac3', quantity: 60, readiness: 91 },
    { equipmentId: 'himars-mlrs', quantity: 500, readiness: 89 },
    { equipmentId: 'b-21-raider', quantity: 20, readiness: 94 },
    { equipmentId: 'mq-9-reaper', quantity: 250, readiness: 88 },
    { equipmentId: 'virginia-class-submarine', quantity: 22, readiness: 91 },
    { equipmentId: 'endpoint-protection-suite', quantity: 50, readiness: 90 },
    { equipmentId: 'zero-day-exploit-kit', quantity: 15, readiness: 85 },
    { equipmentId: 'humint-network', quantity: 80, readiness: 87 },
    { equipmentId: 'signals-intercept-station', quantity: 40, readiness: 92 },
    { equipmentId: 'rq-4-global-hawk', quantity: 30, readiness: 86 },
  ] as const,

  // ── China ──────────────────────────────────────────────────────────────
  china: [
    { equipmentId: 'j-20-mighty-dragon', quantity: 200, readiness: 85 },
    { equipmentId: 'type-99a-tank', quantity: 3000, readiness: 80 },
    { equipmentId: 'type-055-destroyer', quantity: 8, readiness: 88 },
    { equipmentId: 'type-039a-submarine', quantity: 17, readiness: 82 },
    { equipmentId: 's-400-triumf', quantity: 32, readiness: 84 },
    { equipmentId: 'wing-loong-2', quantity: 180, readiness: 83 },
    { equipmentId: 'ddos-botnet', quantity: 25, readiness: 88 },
    { equipmentId: 'apt-infrastructure', quantity: 30, readiness: 90 },
    { equipmentId: 'network-intrusion-detection', quantity: 40, readiness: 82 },
    { equipmentId: 'humint-network', quantity: 60, readiness: 80 },
    { equipmentId: 'surveillance-network', quantity: 100, readiness: 85 },
  ] as const,

  // ── Russia ─────────────────────────────────────────────────────────────
  russia: [
    { equipmentId: 'su-57-felon', quantity: 50, readiness: 75 },
    { equipmentId: 't-14-armata', quantity: 100, readiness: 70 },
    { equipmentId: 'tu-160m-blackjack', quantity: 16, readiness: 72 },
    { equipmentId: 's-400-triumf', quantity: 56, readiness: 78 },
    { equipmentId: 'yasen-class-submarine', quantity: 9, readiness: 74 },
    { equipmentId: 'shahed-136', quantity: 500, readiness: 80 },
    { equipmentId: 'ransomware-toolkit', quantity: 20, readiness: 82 },
    { equipmentId: 'zero-day-exploit-kit', quantity: 10, readiness: 78 },
    { equipmentId: 'counterintelligence-unit', quantity: 45, readiness: 76 },
    { equipmentId: 'covert-action-team', quantity: 30, readiness: 74 },
  ] as const,

  // ── Japan ──────────────────────────────────────────────────────────────
  japan: [
    { equipmentId: 'f-35a-lightning', quantity: 42, readiness: 93 },
    { equipmentId: 'leopard-2a7', quantity: 120, readiness: 88 },
    { equipmentId: 'arleigh-burke-destroyer', quantity: 8, readiness: 92 },
    { equipmentId: 'patriot-pac3', quantity: 24, readiness: 94 },
    { equipmentId: 'endpoint-protection-suite', quantity: 30, readiness: 91 },
    { equipmentId: 'signals-intercept-station', quantity: 15, readiness: 90 },
  ] as const,

  // ── Iran ───────────────────────────────────────────────────────────────
  iran: [
    { equipmentId: 's-400-triumf', quantity: 12, readiness: 72 },
    { equipmentId: 'shahed-136', quantity: 800, readiness: 85 },
    { equipmentId: 'tb2-bayraktar', quantity: 40, readiness: 78 },
    { equipmentId: 'border-patrol-system', quantity: 60, readiness: 70 },
    { equipmentId: 'riot-control-unit', quantity: 100, readiness: 75 },
    { equipmentId: 'humint-network', quantity: 50, readiness: 73 },
    { equipmentId: 'covert-action-team', quantity: 25, readiness: 70 },
  ] as const,

  // ── DPRK ───────────────────────────────────────────────────────────────
  dprk: [
    { equipmentId: 'type-99a-tank', quantity: 800, readiness: 55 },
    { equipmentId: 's-400-triumf', quantity: 8, readiness: 60 },
    { equipmentId: 'shahed-136', quantity: 200, readiness: 65 },
    { equipmentId: 'border-patrol-system', quantity: 80, readiness: 70 },
    { equipmentId: 'surveillance-network', quantity: 60, readiness: 72 },
    { equipmentId: 'riot-control-unit', quantity: 150, readiness: 68 },
    { equipmentId: 'counterintelligence-unit', quantity: 30, readiness: 62 },
  ] as const,

  // ── European Union ─────────────────────────────────────────────────────
  eu: [
    { equipmentId: 'eurofighter-typhoon', quantity: 400, readiness: 88 },
    { equipmentId: 'leopard-2a7', quantity: 800, readiness: 86 },
    { equipmentId: 'queen-elizabeth-carrier', quantity: 2, readiness: 90 },
    { equipmentId: 'arleigh-burke-destroyer', quantity: 20, readiness: 87 },
    { equipmentId: 'patriot-pac3', quantity: 35, readiness: 89 },
    { equipmentId: 'mq-9-reaper', quantity: 60, readiness: 85 },
    { equipmentId: 'endpoint-protection-suite', quantity: 45, readiness: 88 },
    { equipmentId: 'threat-intelligence-platform', quantity: 20, readiness: 86 },
    { equipmentId: 'humint-network', quantity: 40, readiness: 84 },
  ] as const,

  // ── Syria ──────────────────────────────────────────────────────────────
  syria: [
    { equipmentId: 't-14-armata', quantity: 50, readiness: 40 },
    { equipmentId: 's-400-triumf', quantity: 4, readiness: 55 },
    { equipmentId: 'shahed-136', quantity: 100, readiness: 60 },
    { equipmentId: 'riot-control-unit', quantity: 80, readiness: 50 },
    { equipmentId: 'border-patrol-system', quantity: 30, readiness: 45 },
    { equipmentId: 'surveillance-network', quantity: 40, readiness: 48 },
  ] as const,
} as const;

// ---------------------------------------------------------------------------
// Education Profile Map
// ---------------------------------------------------------------------------

/**
 * Maps every faction to its starting education program roster.
 * Ids correspond to `models/education/*.json`.
 */
export const NATION_EDUCATION_DEFAULTS: Readonly<
  Record<FactionId, readonly DefaultEducationEntry[]>
> = {
  // ── United States ──────────────────────────────────────────────────────
  us: [
    { educationId: 'universal-primary', investmentLevel: 90, turnsActive: 100 },
    { educationId: 'elite-university-system', investmentLevel: 95, turnsActive: 80 },
    { educationId: 'national-stem-initiative', investmentLevel: 85, turnsActive: 30 },
    { educationId: 'advanced-research-institute', investmentLevel: 80, turnsActive: 50 },
    { educationId: 'intelligence-analyst-school', investmentLevel: 75, turnsActive: 40 },
    { educationId: 'digital-literacy-campaign', investmentLevel: 70, turnsActive: 15 },
  ] as const,

  // ── China ──────────────────────────────────────────────────────────────
  china: [
    { educationId: 'universal-primary', investmentLevel: 88, turnsActive: 90 },
    { educationId: 'national-stem-initiative', investmentLevel: 90, turnsActive: 25 },
    { educationId: 'vocational-training-program', investmentLevel: 80, turnsActive: 35 },
    { educationId: 'military-officer-academy', investmentLevel: 75, turnsActive: 50 },
    { educationId: 'state-propaganda-program', investmentLevel: 85, turnsActive: 60 },
    { educationId: 'digital-literacy-campaign', investmentLevel: 72, turnsActive: 10 },
  ] as const,

  // ── Russia ─────────────────────────────────────────────────────────────
  russia: [
    { educationId: 'universal-primary', investmentLevel: 82, turnsActive: 95 },
    { educationId: 'military-officer-academy', investmentLevel: 80, turnsActive: 60 },
    { educationId: 'intelligence-analyst-school', investmentLevel: 78, turnsActive: 55 },
    { educationId: 'state-propaganda-program', investmentLevel: 75, turnsActive: 70 },
    { educationId: 'advanced-research-institute', investmentLevel: 65, turnsActive: 40 },
  ] as const,

  // ── Japan ──────────────────────────────────────────────────────────────
  japan: [
    { educationId: 'universal-primary', investmentLevel: 95, turnsActive: 100 },
    { educationId: 'elite-university-system', investmentLevel: 90, turnsActive: 75 },
    { educationId: 'national-stem-initiative', investmentLevel: 88, turnsActive: 35 },
    { educationId: 'digital-literacy-campaign', investmentLevel: 85, turnsActive: 20 },
    { educationId: 'vocational-training-program', investmentLevel: 78, turnsActive: 50 },
  ] as const,

  // ── Iran ───────────────────────────────────────────────────────────────
  iran: [
    { educationId: 'universal-primary', investmentLevel: 70, turnsActive: 80 },
    { educationId: 'military-officer-academy', investmentLevel: 72, turnsActive: 45 },
    { educationId: 'state-propaganda-program', investmentLevel: 80, turnsActive: 55 },
    { educationId: 'vocational-training-program', investmentLevel: 55, turnsActive: 25 },
  ] as const,

  // ── DPRK ───────────────────────────────────────────────────────────────
  dprk: [
    { educationId: 'universal-primary', investmentLevel: 60, turnsActive: 85 },
    { educationId: 'military-officer-academy', investmentLevel: 70, turnsActive: 50 },
    { educationId: 'state-propaganda-program', investmentLevel: 90, turnsActive: 70 },
  ] as const,

  // ── European Union ─────────────────────────────────────────────────────
  eu: [
    { educationId: 'universal-primary', investmentLevel: 92, turnsActive: 100 },
    { educationId: 'elite-university-system', investmentLevel: 88, turnsActive: 70 },
    { educationId: 'national-stem-initiative', investmentLevel: 82, turnsActive: 25 },
    { educationId: 'advanced-research-institute', investmentLevel: 78, turnsActive: 45 },
    { educationId: 'vocational-training-program', investmentLevel: 80, turnsActive: 55 },
    { educationId: 'digital-literacy-campaign', investmentLevel: 82, turnsActive: 18 },
    { educationId: 'secondary-modernization', investmentLevel: 85, turnsActive: 40 },
  ] as const,

  // ── Syria ──────────────────────────────────────────────────────────────
  syria: [
    { educationId: 'universal-primary', investmentLevel: 45, turnsActive: 60 },
    { educationId: 'vocational-training-program', investmentLevel: 35, turnsActive: 20 },
    { educationId: 'state-propaganda-program', investmentLevel: 55, turnsActive: 40 },
  ] as const,
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the full set of defaults (political system, equipment, education)
 * for the given faction.
 *
 * @param factionId - One of the 8 playable faction ids.
 * @returns Aggregated {@link NationDefaults} for the faction.
 */
export function getNationDefaults(factionId: FactionId): NationDefaults {
  return {
    factionId,
    politicalSystemId: NATION_POLITICAL_SYSTEMS[factionId],
    equipment: NATION_EQUIPMENT_DEFAULTS[factionId],
    education: NATION_EDUCATION_DEFAULTS[factionId],
  };
}

/**
 * Returns defaults for every faction, in canonical faction order.
 *
 * @returns An array of {@link NationDefaults}, one per faction.
 */
export function getAllNationDefaults(): readonly NationDefaults[] {
  const factionIds: readonly FactionId[] = [
    'us',
    'china',
    'russia',
    'japan',
    'iran',
    'dprk',
    'eu',
    'syria',
  ];
  return factionIds.map(getNationDefaults);
}
