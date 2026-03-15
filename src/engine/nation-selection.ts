/**
 * Nation Selection Engine — FR-1201
 *
 * Handles player nation selection at game start. Presents all 8 factions
 * with summary statistics, validates the player's choice, assigns
 * player / AI control, and resolves the default leader profile from
 * the scenario definition.
 *
 * All methods are pure — they return results without mutating inputs.
 *
 * @see FR-1201
 */

import type {
  FactionId,
  LeaderId,
  LeaderProfile,
  NationState,
  IntelligenceCapabilityMatrix,
  AIProfileConfig,
  ScenarioDefinition,
} from '@/data/types';

import { GAME_CONFIG } from './config';

// ---------------------------------------------------------------------------
// Exported Types
// ---------------------------------------------------------------------------

/**
 * Configuration sourced from the game meta constants.
 * @see FR-1201
 */
export type NationSelectionConfig = typeof GAME_CONFIG.meta;

/**
 * Summary data for a single faction shown on the nation-selection screen.
 * @see FR-1201
 */
export interface NationSummary {
  readonly factionId: FactionId;
  readonly leaderName: string;
  readonly leaderTitle: string;
  readonly ideology: string;
  readonly stability: number;
  readonly treasury: number;
  readonly gdp: number;
  readonly militaryReadiness: number;
  readonly techLevel: number;
  readonly diplomaticInfluence: number;
  /** Derived from the faction's strongest intelligence or geographic trait. */
  readonly specialCapability: string;
}

/**
 * Describes whether a faction is player- or AI-controlled.
 * @see FR-1201
 */
export interface FactionAssignment {
  readonly factionId: FactionId;
  readonly isPlayer: boolean;
  readonly leaderId: LeaderId;
}

/**
 * Outcome of validating a player's faction selection.
 * @see FR-1201
 */
export interface NationSelectionValidation {
  readonly valid: boolean;
  readonly reason: string;
}

/**
 * Complete result of the nation-selection phase.
 * @see FR-1201
 */
export interface NationSelectionResult {
  readonly playerFaction: FactionId;
  readonly playerLeader: LeaderProfile;
  readonly assignments: readonly FactionAssignment[];
  readonly allSummaries: readonly NationSummary[];
}

// ---------------------------------------------------------------------------
// Helpers (module-private)
// ---------------------------------------------------------------------------

/**
 * Map of intelligence capability keys to human-readable labels.
 */
const INTEL_CAPABILITY_LABELS: Record<string, string> = {
  humint: 'HUMINT Dominance',
  sigint: 'SIGINT Dominance',
  cyber: 'Cyber Dominance',
  covert: 'Covert Ops Dominance',
  counterIntel: 'Counter-Intel Dominance',
};

/**
 * Derive a "special capability" string from a faction's intelligence
 * capability matrix by selecting the highest-scoring discipline.
 */
function deriveSpecialCapability(
  intelMatrix: IntelligenceCapabilityMatrix | undefined,
): string {
  if (intelMatrix === undefined) {
    return 'Unknown';
  }

  const caps = intelMatrix.capabilities;
  const entries: readonly (readonly [string, number])[] = [
    ['humint', caps.humint] as const,
    ['sigint', caps.sigint] as const,
    ['cyber', caps.cyber] as const,
    ['covert', caps.covert] as const,
    ['counterIntel', caps.counterIntel] as const,
  ];

  let bestKey = 'cyber';
  let bestValue = -1;

  for (const [key, value] of entries) {
    if (value > bestValue) {
      bestKey = key;
      bestValue = value;
    }
  }

  return INTEL_CAPABILITY_LABELS[bestKey] ?? 'Unknown';
}

/**
 * Build a single {@link NationSummary} from scenario data for one faction.
 */
function buildSingleSummary(
  factionId: FactionId,
  nationState: NationState,
  aiProfile: AIProfileConfig,
  intelMatrix: IntelligenceCapabilityMatrix | undefined,
): NationSummary {
  const leader = aiProfile.leader;

  return {
    factionId,
    leaderName: leader.identity.name,
    leaderTitle: leader.identity.title,
    ideology: leader.identity.ideology,
    stability: nationState.stability,
    treasury: nationState.treasury,
    gdp: nationState.gdp,
    militaryReadiness: nationState.militaryReadiness,
    techLevel: nationState.techLevel,
    diplomaticInfluence: nationState.diplomaticInfluence,
    specialCapability: deriveSpecialCapability(intelMatrix),
  };
}

// ---------------------------------------------------------------------------
// NationSelectionEngine
// ---------------------------------------------------------------------------

/**
 * Engine responsible for the nation-selection phase at game start.
 *
 * Provides pure methods to validate a player's faction choice, build
 * per-faction summary data for the selection screen, resolve the default
 * leader profile, and produce the full selection result.
 *
 * @see FR-1201
 */
export class NationSelectionEngine {
  /** Game-meta configuration (faction count, max turns, etc.). */
  private readonly config: NationSelectionConfig;

  /**
   * @param config — Game-meta constants, typically `GAME_CONFIG.meta`.
   * @see FR-1201
   */
  constructor(config: NationSelectionConfig) {
    this.config = config;
  }

  // ── Public API ──────────────────────────────────────────────────────────

  /**
   * Validate that a faction ID is a legal player selection for the given
   * scenario.
   *
   * @param factionId — The faction the player wishes to control.
   * @param scenario  — The loaded scenario definition.
   * @returns A validation result indicating success or the reason for failure.
   * @see FR-1201
   */
  validateSelection(
    factionId: FactionId,
    scenario: ScenarioDefinition,
  ): NationSelectionValidation {
    if (scenario.factions.length !== this.config.FACTIONS_COUNT) {
      return {
        valid: false,
        reason:
          'Scenario has ' +
          String(scenario.factions.length) +
          ' factions but expected ' +
          String(this.config.FACTIONS_COUNT),
      };
    }

    const inScenario = scenario.factions.includes(factionId);

    if (!inScenario) {
      return {
        valid: false,
        reason:
          'Faction ' +
          String(factionId) +
          ' is not available in scenario ' +
          String(scenario.meta.id),
      };
    }

    // Ensure scenario has the required supporting data for the faction.
    const nationState: NationState | undefined =
      scenario.nationStates[factionId];
    if (nationState === undefined) {
      return {
        valid: false,
        reason:
          'Faction ' +
          String(factionId) +
          ' is missing nation-state data in the scenario',
      };
    }

    const aiProfile: AIProfileConfig | undefined =
      scenario.aiProfiles[factionId];
    if (aiProfile === undefined) {
      return {
        valid: false,
        reason:
          'Faction ' +
          String(factionId) +
          ' is missing an AI profile (leader data) in the scenario',
      };
    }

    return { valid: true, reason: 'Selection is valid' };
  }

  /**
   * Build summary data for every faction in the scenario, suitable for
   * rendering the nation-selection screen.
   *
   * @param scenario — The loaded scenario definition.
   * @returns An array of {@link NationSummary} objects, one per faction.
   * @see FR-1201
   */
  buildNationSummaries(scenario: ScenarioDefinition): NationSummary[] {
    const summaries: NationSummary[] = [];

    for (const factionId of scenario.factions) {
      const nationState: NationState | undefined =
        scenario.nationStates[factionId];
      const aiProfile: AIProfileConfig | undefined =
        scenario.aiProfiles[factionId];

      if (nationState === undefined || aiProfile === undefined) {
        // Skip factions with incomplete data — should not happen in a
        // validated scenario, but guards against noUncheckedIndexedAccess.
        continue;
      }

      const intelMatrix: IntelligenceCapabilityMatrix | undefined =
        scenario.intelligenceCapabilities[factionId] ?? undefined;

      summaries.push(
        buildSingleSummary(
          factionId,
          nationState,
          aiProfile,
          intelMatrix,
        ),
      );
    }

    return summaries;
  }

  /**
   * Resolve the default leader profile for a faction from the scenario's
   * AI profiles.
   *
   * @param factionId — The faction whose leader to resolve.
   * @param scenario  — The loaded scenario definition.
   * @returns The {@link LeaderProfile} for the faction.
   * @throws {Error} If no AI profile or leader is defined for the faction.
   * @see FR-1201
   */
  resolveDefaultLeader(
    factionId: FactionId,
    scenario: ScenarioDefinition,
  ): LeaderProfile {
    const aiProfile: AIProfileConfig | undefined =
      scenario.aiProfiles[factionId];

    if (aiProfile === undefined) {
      throw new Error(
        'No AI profile found for faction ' +
          String(factionId) +
          ' in scenario ' +
          String(scenario.meta.id),
      );
    }

    const leader: LeaderProfile | undefined = aiProfile.leader ?? undefined;

    if (leader === undefined) {
      throw new Error(
        'No leader profile found for faction ' +
          String(factionId) +
          ' in scenario ' +
          String(scenario.meta.id),
      );
    }

    return leader;
  }

  /**
   * Execute the full nation-selection workflow: validate the player's choice,
   * build summaries for all factions, resolve the player's leader, and
   * produce the complete assignment list.
   *
   * @param playerFactionId — The faction the player has chosen to control.
   * @param scenario        — The loaded scenario definition.
   * @returns A {@link NationSelectionResult} with all assignments and summaries.
   * @throws {Error} If the selection is invalid or leader resolution fails.
   * @see FR-1201
   */
  createSelectionResult(
    playerFactionId: FactionId,
    scenario: ScenarioDefinition,
  ): NationSelectionResult {
    // 1. Validate the player's selection.
    const validation = this.validateSelection(playerFactionId, scenario);
    if (!validation.valid) {
      throw new Error(
        'Invalid nation selection: ' + validation.reason,
      );
    }

    // 2. Build summaries for all factions.
    const allSummaries = this.buildNationSummaries(scenario);

    // 3. Resolve the player's default leader.
    const playerLeader = this.resolveDefaultLeader(playerFactionId, scenario);

    // 4. Build faction assignments.
    const assignments: FactionAssignment[] = scenario.factions.map(
      (factionId): FactionAssignment => {
        const aiProfile: AIProfileConfig | undefined =
          scenario.aiProfiles[factionId];
        const leaderId: LeaderId =
          aiProfile?.leader.id ?? ('' as unknown as LeaderId);

        return {
          factionId,
          isPlayer: factionId === playerFactionId,
          leaderId,
        };
      },
    );

    return {
      playerFaction: playerFactionId,
      playerLeader,
      assignments,
      allSummaries,
    };
  }
}
