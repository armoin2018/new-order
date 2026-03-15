/**
 * Leader Creation Engine — FR-1202, FR-1203
 *
 * Handles leader profile creation and customization during game setup.
 * Players can select from 4 preset archetypes (Hawk, Dove, Populist,
 * Technocrat) that pre-fill psychology sliders, then fine-tune individual
 * dimensions. The engine also assesses consistency between a leader's
 * psychological profile and in-game actions — inconsistencies trigger
 * "Leader Contradicts Own Doctrine" headlines, reducing Popularity.
 *
 * All methods are pure — they return results without mutating inputs.
 *
 * @see FR-1202
 * @see FR-1203
 */

import type {
  LeaderProfile,
  LeaderPsychology,
} from '@/data/types';

import { GAME_CONFIG } from './config';

// ---------------------------------------------------------------------------
// Exported Types
// ---------------------------------------------------------------------------

/**
 * Configuration sourced from the leader creation game constants.
 * @see FR-1202
 */
export type LeaderCreationConfig = typeof GAME_CONFIG.leaderCreation;

/**
 * The four preset archetype keys available during leader creation.
 * @see FR-1202
 */
export type LeaderArchetype = 'Hawk' | 'Dove' | 'Populist' | 'Technocrat';

/**
 * Personal vulnerability options selectable during leader creation.
 * Exactly one must be chosen.
 * @see FR-1202
 */
export type PersonalVulnerabilityType =
  | 'HealthRisk'
  | 'ScandalExposure'
  | 'SuccessionGap'
  | 'IdeologicalRigidity';

/**
 * Player-supplied customization inputs for leader profile creation.
 * All fields except `personalVulnerability` are optional — omitted
 * fields retain the default scenario value.
 * @see FR-1202
 */
export interface LeaderCustomization {
  readonly name?: string;
  readonly title?: string;
  readonly age?: number;
  readonly ideology?: string;
  /** If provided, pre-fills psychology sliders from the archetype preset. */
  readonly archetype?: LeaderArchetype;
  /** Fine-tune individual psychology dimensions after archetype selection. */
  readonly psychologyOverrides?: Partial<LeaderPsychology>;
  readonly primaryGoal?: string;
  readonly ideologicalCore?: string;
  readonly redLines?: string[];
  readonly legacyAmbition?: string;
  /** Exactly one personal vulnerability must be selected. */
  readonly personalVulnerability: PersonalVulnerabilityType;
}

/**
 * Result of validating a leader profile. May contain multiple errors.
 * @see FR-1202
 */
export interface LeaderValidation {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

/**
 * Result of checking whether an action aligns with the leader's
 * psychological profile. Misalignment triggers domestic media headlines.
 * @see FR-1203
 */
export interface ProfileConsistencyCheck {
  /** Whether the action is consistent with the leader's psychology. */
  readonly aligned: boolean;
  /** 0–100 score indicating how far the action deviates from the profile. */
  readonly deviationScore: number;
  /** Psychology dimensions that are misaligned with the action. */
  readonly affectedDimensions: readonly string[];
  /** Popularity penalty applied (0 if aligned). */
  readonly popularityPenalty: number;
}

/**
 * Descriptive info for one archetype preset, including its label,
 * description, and full psychology preset values.
 * @see FR-1202
 */
export interface ArchetypeInfo {
  readonly key: LeaderArchetype;
  readonly label: string;
  readonly description: string;
  readonly psychology: LeaderPsychology;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Clamp a numeric value to the configured slider range [min, max]. */
function clampToRange(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** All numeric keys on LeaderPsychology that should be clamped. */
const PSYCHOLOGY_NUMERIC_KEYS: ReadonlyArray<keyof LeaderPsychology> = [
  'riskTolerance',
  'paranoia',
  'narcissism',
  'pragmatism',
  'patience',
  'vengefulIndex',
] as const;

/** All numeric keys on PowerBase that should be validated. */
const POWER_BASE_KEYS: readonly string[] = [
  'military',
  'oligarchs',
  'party',
  'clergy',
  'public',
  'securityServices',
] as const;

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Leader Creation Engine.
 *
 * Provides archetype presets, profile customization, validation, and
 * psychological consistency assessment for the leader creation flow.
 *
 * @see FR-1202 — Leader Profile creation / customization
 * @see FR-1203 — Psychological Profile influence on advisory / media
 */
export class LeaderCreationEngine {
  private readonly config: LeaderCreationConfig;

  constructor(config: LeaderCreationConfig) {
    this.config = config;
  }

  // -----------------------------------------------------------------------
  // Archetype queries
  // -----------------------------------------------------------------------

  /**
   * Return all four archetype preset info objects.
   * @see FR-1202
   */
  getArchetypePresets(): ArchetypeInfo[] {
    const archetypeKeys: readonly LeaderArchetype[] = [
      'Hawk',
      'Dove',
      'Populist',
      'Technocrat',
    ] as const;

    return archetypeKeys.map((key) => this.getArchetypePreset(key));
  }

  /**
   * Return the info object for a single archetype.
   * @see FR-1202
   */
  getArchetypePreset(archetype: LeaderArchetype): ArchetypeInfo {
    const preset = this.config.archetypes[archetype];

    return {
      key: archetype,
      label: preset.label,
      description: preset.description,
      psychology: { ...preset.psychology },
    };
  }

  // -----------------------------------------------------------------------
  // Customization
  // -----------------------------------------------------------------------

  /**
   * Apply player customizations to a default leader profile.
   *
   * Resolution order:
   * 1. Start from `defaultLeader` (deep-copied).
   * 2. If `archetype` is provided, replace psychology with archetype preset.
   * 3. Apply `psychologyOverrides` on top.
   * 4. Apply identity overrides (name, title, age, ideology).
   * 5. Apply motivation overrides.
   * 6. Clamp all numeric psychology values to [0, 100].
   *
   * @see FR-1202
   */
  applyCustomization(
    defaultLeader: LeaderProfile,
    customization: LeaderCustomization,
  ): LeaderProfile {
    const { min, max } = this.config.sliderRange;

    // Deep-copy the default leader to avoid mutation.
    let psychology: LeaderPsychology = { ...defaultLeader.psychology };

    // Step 2: archetype preset overrides full psychology.
    if (customization.archetype !== undefined) {
      const preset = this.config.archetypes[customization.archetype];
      psychology = { ...preset.psychology };
    }

    // Step 3: apply fine-tune overrides.
    if (customization.psychologyOverrides !== undefined) {
      psychology = { ...psychology, ...customization.psychologyOverrides };
    }

    // Step 6: clamp numeric psychology dimensions.
    for (const key of PSYCHOLOGY_NUMERIC_KEYS) {
      const raw = psychology[key];
      if (typeof raw === 'number') {
        (psychology as unknown as Record<string, unknown>)[key] = clampToRange(raw, min, max);
      }
    }

    // Identity overrides.
    const identity = {
      ...defaultLeader.identity,
      ...(customization.name !== undefined ? { name: customization.name } : {}),
      ...(customization.title !== undefined ? { title: customization.title } : {}),
      ...(customization.age !== undefined ? { age: customization.age } : {}),
      ...(customization.ideology !== undefined ? { ideology: customization.ideology } : {}),
    };

    // Motivation overrides.
    const motivations = {
      ...defaultLeader.motivations,
      ...(customization.primaryGoal !== undefined ? { primaryGoal: customization.primaryGoal } : {}),
      ...(customization.ideologicalCore !== undefined ? { ideologicalCore: customization.ideologicalCore } : {}),
      ...(customization.redLines !== undefined ? { redLines: [...customization.redLines] } : {}),
      ...(customization.legacyAmbition !== undefined ? { legacyAmbition: customization.legacyAmbition } : {}),
    };

    return {
      id: defaultLeader.id,
      identity,
      psychology,
      motivations,
      powerBase: { ...defaultLeader.powerBase },
      vulnerabilities: { ...defaultLeader.vulnerabilities },
      historicalAnalog: defaultLeader.historicalAnalog,
    };
  }

  // -----------------------------------------------------------------------
  // Validation
  // -----------------------------------------------------------------------

  /**
   * Validate a leader profile against all creation constraints.
   *
   * Checks:
   * - All psychology numeric fields are in [0, 100].
   * - `identity.name` is non-empty.
   * - `redLines` count does not exceed `maxCustomRedLines`.
   * - All `powerBase` values are in [0, 100].
   *
   * @see FR-1202
   */
  validateLeaderProfile(profile: LeaderProfile): LeaderValidation {
    const { min, max } = this.config.sliderRange;
    const errors: string[] = [];

    // Psychology range checks.
    for (const key of PSYCHOLOGY_NUMERIC_KEYS) {
      const value = profile.psychology[key];
      if (typeof value === 'number' && (value < min || value > max)) {
        errors.push(
          `Psychology field "${String(key)}" value ${String(value)} is outside range [${String(min)}, ${String(max)}].`,
        );
      }
    }

    // Identity name must be non-empty.
    if (profile.identity.name.trim().length === 0) {
      errors.push('Leader name must not be empty.');
    }

    // Red lines limit.
    if (profile.motivations.redLines.length > this.config.maxCustomRedLines) {
      errors.push(
        `Red lines count (${String(profile.motivations.redLines.length)}) exceeds maximum of ${String(this.config.maxCustomRedLines)}.`,
      );
    }

    // Power base range checks.
    for (const key of POWER_BASE_KEYS) {
      const value = (profile.powerBase as unknown as Record<string, number>)[key];
      if (value !== undefined && (value < min || value > max)) {
        errors.push(
          `PowerBase field "${key}" value ${String(value)} is outside range [${String(min)}, ${String(max)}].`,
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // -----------------------------------------------------------------------
  // Profile Consistency Assessment (FR-1203)
  // -----------------------------------------------------------------------

  /**
   * Assess whether an action category aligns with the leader's
   * psychological profile.
   *
   * Alignment rules by action category:
   * - `military`  — aligned if `riskTolerance > 50` OR `stressResponse === 'Escalate'`
   * - `diplomatic` — aligned if `pragmatism > 50` OR `patience > 50`
   * - `economic`  — always aligned (neutral)
   * - `covert`    — aligned if `paranoia > 40` OR `pragmatism > 60`
   * - `domestic`  — aligned if `narcissism < 50` OR `pragmatism > 50`
   *
   * When misaligned, `popularityPenalty` equals `config.consistency.popularityPenalty`,
   * and `deviationScore` reflects how far relevant dimensions are from alignment.
   *
   * @see FR-1203
   */
  assessProfileConsistency(
    profile: LeaderPsychology,
    actionCategory: string,
  ): ProfileConsistencyCheck {
    switch (actionCategory) {
      case 'military':
        return this.assessMilitary(profile);
      case 'diplomatic':
        return this.assessDiplomatic(profile);
      case 'economic':
        return this.assessEconomic();
      case 'covert':
        return this.assessCovert(profile);
      case 'domestic':
        return this.assessDomestic(profile);
      default:
        // Unknown category — treat as aligned / neutral.
        return {
          aligned: true,
          deviationScore: 0,
          affectedDimensions: [],
          popularityPenalty: 0,
        };
    }
  }

  // -----------------------------------------------------------------------
  // Vulnerability options
  // -----------------------------------------------------------------------

  /**
   * Return all available personal vulnerability options for leader creation.
   * @see FR-1202
   */
  getVulnerabilityOptions(): Array<{
    readonly key: PersonalVulnerabilityType;
    readonly label: string;
    readonly description: string;
  }> {
    const keys: readonly PersonalVulnerabilityType[] = [
      'HealthRisk',
      'ScandalExposure',
      'SuccessionGap',
      'IdeologicalRigidity',
    ] as const;

    return keys.map((key) => {
      const vuln = this.config.vulnerabilities[key];
      return {
        key,
        label: vuln.label,
        description: vuln.description,
      };
    });
  }

  // -----------------------------------------------------------------------
  // Private — per-category consistency assessors
  // -----------------------------------------------------------------------

  /**
   * Military action: aligned if riskTolerance > 50 OR stressResponse === 'Escalate'.
   * Deviation is based on how far riskTolerance is below 50 (when not Escalate).
   */
  private assessMilitary(profile: LeaderPsychology): ProfileConsistencyCheck {
    const escalates = profile.stressResponse === 'Escalate';
    const riskAligned = profile.riskTolerance > 50;
    const aligned = riskAligned || escalates;

    if (aligned) {
      return { aligned: true, deviationScore: 0, affectedDimensions: [], popularityPenalty: 0 };
    }

    // Deviation: how far riskTolerance is from the 50 threshold (clamped 0–100).
    const deviationScore = clampToRange(50 - profile.riskTolerance, 0, 100);
    const affectedDimensions: string[] = [];
    if (!riskAligned) affectedDimensions.push('riskTolerance');
    if (!escalates) affectedDimensions.push('stressResponse');

    return {
      aligned: false,
      deviationScore,
      affectedDimensions,
      popularityPenalty: this.config.consistency.popularityPenalty,
    };
  }

  /**
   * Diplomatic action: aligned if pragmatism > 50 OR patience > 50.
   * Deviation is the average shortfall of both dimensions below 50.
   */
  private assessDiplomatic(profile: LeaderPsychology): ProfileConsistencyCheck {
    const pragAligned = profile.pragmatism > 50;
    const patAligned = profile.patience > 50;
    const aligned = pragAligned || patAligned;

    if (aligned) {
      return { aligned: true, deviationScore: 0, affectedDimensions: [], popularityPenalty: 0 };
    }

    const pragDev = Math.max(0, 50 - profile.pragmatism);
    const patDev = Math.max(0, 50 - profile.patience);
    const deviationScore = clampToRange(Math.round((pragDev + patDev) / 2), 0, 100);
    const affectedDimensions: string[] = [];
    if (!pragAligned) affectedDimensions.push('pragmatism');
    if (!patAligned) affectedDimensions.push('patience');

    return {
      aligned: false,
      deviationScore,
      affectedDimensions,
      popularityPenalty: this.config.consistency.popularityPenalty,
    };
  }

  /**
   * Economic action: always aligned (neutral).
   */
  private assessEconomic(): ProfileConsistencyCheck {
    return {
      aligned: true,
      deviationScore: 0,
      affectedDimensions: [],
      popularityPenalty: 0,
    };
  }

  /**
   * Covert action: aligned if paranoia > 40 OR pragmatism > 60.
   * Deviation is based on how far both dimensions fall short.
   */
  private assessCovert(profile: LeaderPsychology): ProfileConsistencyCheck {
    const paranoiaAligned = profile.paranoia > 40;
    const pragAligned = profile.pragmatism > 60;
    const aligned = paranoiaAligned || pragAligned;

    if (aligned) {
      return { aligned: true, deviationScore: 0, affectedDimensions: [], popularityPenalty: 0 };
    }

    const parDev = Math.max(0, 40 - profile.paranoia);
    const pragDev = Math.max(0, 60 - profile.pragmatism);
    const deviationScore = clampToRange(Math.round((parDev + pragDev) / 2), 0, 100);
    const affectedDimensions: string[] = [];
    if (!paranoiaAligned) affectedDimensions.push('paranoia');
    if (!pragAligned) affectedDimensions.push('pragmatism');

    return {
      aligned: false,
      deviationScore,
      affectedDimensions,
      popularityPenalty: this.config.consistency.popularityPenalty,
    };
  }

  /**
   * Domestic action: aligned if narcissism < 50 OR pragmatism > 50.
   * Deviation is based on how far narcissism exceeds 50 (when pragmatism ≤ 50).
   */
  private assessDomestic(profile: LeaderPsychology): ProfileConsistencyCheck {
    const narcAligned = profile.narcissism < 50;
    const pragAligned = profile.pragmatism > 50;
    const aligned = narcAligned || pragAligned;

    if (aligned) {
      return { aligned: true, deviationScore: 0, affectedDimensions: [], popularityPenalty: 0 };
    }

    const narcDev = Math.max(0, profile.narcissism - 50);
    const pragDev = Math.max(0, 50 - profile.pragmatism);
    const deviationScore = clampToRange(Math.round((narcDev + pragDev) / 2), 0, 100);
    const affectedDimensions: string[] = [];
    if (!narcAligned) affectedDimensions.push('narcissism');
    if (!pragAligned) affectedDimensions.push('pragmatism');

    return {
      aligned: false,
      deviationScore,
      affectedDimensions,
      popularityPenalty: this.config.consistency.popularityPenalty,
    };
  }
}
