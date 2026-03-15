/**
 * Technology Module Factory — FR-3500, CNFL-4300
 *
 * Auto-generates reusable technology module models when technologies are
 * researched, manages a cross-scenario technology discovery log, supports
 * batch export/import of tech modules, and provides leaderboard queries.
 *
 * All public methods are **pure functions** — no mutation, no side effects.
 *
 * @module engine/tech-module-factory
 * @see FR-3500 — Technology Module Generation
 * @see CNFL-4300 — Reusable Tech Module System
 */

import type { FactionId, NationState } from '@/data/types';
import type {
  TechnologyModel,
  TechDomainKey,
  SchemaVersion,
} from '@/data/types/model.types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Clamps a numeric value to the inclusive range [min, max].
 *
 * @param value - The value to clamp.
 * @param min   - Lower bound (inclusive).
 * @param max   - Upper bound (inclusive).
 * @returns The clamped value.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default schema version for generated modules. */
const MODULE_SCHEMA_VERSION: SchemaVersion = '1.0.0';

/** Maximum entries returned by leaderboard queries. */
const LEADERBOARD_MAX_ENTRIES = 10;

// ---------------------------------------------------------------------------
// Exported Interfaces
// ---------------------------------------------------------------------------

/**
 * Context snapshot of the nation at the time of technology discovery.
 *
 * @see FR-3500
 */
export interface DiscoveryContext {
  readonly factionId: FactionId;
  readonly turn: number;
  readonly scenarioId: string;
  readonly nationTechLevels: Partial<Record<TechDomainKey, number>>;
  readonly nationDomainLevels: Partial<Record<TechDomainKey, number>>;
  readonly gdp: number;
  readonly stability: number;
  readonly researchEfficiency: number;
}

/**
 * Computed fields added to the generated module that aren't in the base tech.
 *
 * @see FR-3500
 */
export interface ComputedResearchFields {
  readonly actualCostPaid: number;
  readonly effectiveDurationTurns: number;
  readonly synergyBonusesApplied: readonly string[];
  readonly educationBonusPercent: number;
  readonly efficiencyAtCompletion: number;
}

/**
 * A generated technology module model (extends TechnologyModel with metadata).
 *
 * Merges the base technology fields with discovery context and computed
 * research outcomes so the module can be re-imported into other scenarios.
 *
 * @see FR-3500
 * @see CNFL-4300
 */
export interface GeneratedTechModule {
  readonly schemaVersion: SchemaVersion;
  readonly techId: string;
  readonly name: string;
  readonly domain: TechDomainKey;
  readonly secondaryDomains?: readonly TechDomainKey[];
  readonly description: string;
  readonly tier?: number;
  readonly researchCost: number;
  readonly researchDurationTurns: number;
  readonly impactLevel:
    | 'incremental'
    | 'significant'
    | 'breakthrough'
    | 'paradigm-shift';
  readonly prerequisites?: readonly {
    readonly techId: string;
    readonly minimumLevel?: number;
  }[];
  readonly domainLevelRequirement?: Partial<Record<TechDomainKey, number>>;
  readonly effects?: TechnologyModel['effects'];
  readonly knowledgeTransfer?: TechnologyModel['knowledgeTransfer'];
  readonly combinationBonuses?: TechnologyModel['combinationBonuses'];
  readonly tags?: readonly string[];
  // --- Generated module metadata ---
  readonly generatedBy: FactionId;
  readonly generatedOnTurn: number;
  readonly scenarioId: string;
  readonly computedFields: ComputedResearchFields;
  readonly discoveryContext: DiscoveryContext;
  readonly exportable: boolean;
}

/**
 * Entry in the cross-scenario technology discovery log.
 *
 * @see DR-176 — Technology Discovery Log
 */
export interface TechDiscoveryLogEntry {
  readonly techId: string;
  readonly scenarioId: string;
  readonly factionId: FactionId;
  readonly turnDiscovered: number;
  readonly actualCost: number;
  readonly actualDuration: number;
  readonly synergyBonuses: readonly string[];
  readonly discoveryContext: DiscoveryContext;
  readonly generatedModulePath: string;
}

/**
 * Result of generating a tech module.
 *
 * @see FR-3500
 */
export interface GenerateModuleResult {
  readonly success: boolean;
  readonly module?: GeneratedTechModule;
  readonly logEntry?: TechDiscoveryLogEntry;
  readonly error?: string;
}

/**
 * Result of importing a tech module into a scenario.
 *
 * @see CNFL-4300
 */
export interface ImportModuleResult {
  readonly success: boolean;
  readonly techId?: string;
  readonly error?: string;
}

/**
 * A technology package for batch export.
 *
 * @see FR-3500
 */
export interface TechPackage {
  readonly packageId: string;
  readonly packageName: string;
  readonly scenarioId: string;
  readonly factionId: FactionId;
  readonly exportedAt: string;
  readonly modules: readonly GeneratedTechModule[];
  readonly totalCostPaid: number;
  readonly totalResearchTurns: number;
}

/**
 * Leaderboard query result for a specific technology.
 *
 * @see FR-3500
 */
export interface TechLeaderboardEntry {
  readonly techId: string;
  readonly techName: string;
  readonly factionId: FactionId;
  readonly scenarioId: string;
  readonly turnDiscovered: number;
  readonly actualCost: number;
  readonly actualDuration: number;
}

// ---------------------------------------------------------------------------
// Engine Class
// ---------------------------------------------------------------------------

/**
 * Technology Module Factory
 *
 * Generates reusable technology module models when technologies are
 * researched, maintains a cross-scenario discovery log, supports
 * single and batch export/import of modules, and provides leaderboard
 * queries for comparing technology achievements across factions.
 *
 * All methods are pure functions that do not mutate input state.
 *
 * @see FR-3500 — Technology Module Generation
 * @see CNFL-4300 — Reusable Tech Module System
 */
export class TechModuleFactory {
  // -----------------------------------------------------------------------
  // Method 1 — generateModule
  // -----------------------------------------------------------------------

  /**
   * Generates a {@link GeneratedTechModule} by merging a base
   * {@link TechnologyModel} with discovery context and computed research
   * fields. Also produces a {@link TechDiscoveryLogEntry} for the
   * cross-scenario discovery log.
   *
   * @param tech             - The base technology model that was researched.
   * @param discoveryContext - Snapshot of the nation at discovery time.
   * @param computedFields   - Computed research outcomes (actual cost, duration, etc.).
   * @returns A {@link GenerateModuleResult} containing the module and log entry.
   *
   * @see FR-3500 — Technology Module Generation
   */
  generateModule(
    tech: TechnologyModel,
    discoveryContext: DiscoveryContext,
    computedFields: ComputedResearchFields,
  ): GenerateModuleResult {
    if (!tech.techId || !discoveryContext.factionId) {
      return {
        success: false,
        error: 'Missing required techId or factionId',
      };
    }

    const generatedModule: GeneratedTechModule = {
      schemaVersion: MODULE_SCHEMA_VERSION,
      techId: tech.techId,
      name: tech.name,
      domain: tech.domain,
      secondaryDomains: tech.secondaryDomains,
      description: tech.description,
      tier: tech.tier,
      researchCost: tech.researchCost,
      researchDurationTurns: tech.researchDurationTurns,
      impactLevel: tech.impactLevel,
      prerequisites: tech.prerequisites,
      domainLevelRequirement: tech.domainLevelRequirement,
      effects: tech.effects,
      knowledgeTransfer: tech.knowledgeTransfer,
      combinationBonuses: tech.combinationBonuses,
      tags: tech.tags,
      generatedBy: discoveryContext.factionId,
      generatedOnTurn: discoveryContext.turn,
      scenarioId: discoveryContext.scenarioId,
      computedFields,
      discoveryContext,
      exportable: true,
    };

    const modulePath =
      `models/technology/generated/${tech.techId}-${discoveryContext.factionId}.json`;

    const logEntry: TechDiscoveryLogEntry = {
      techId: tech.techId,
      scenarioId: discoveryContext.scenarioId,
      factionId: discoveryContext.factionId,
      turnDiscovered: discoveryContext.turn,
      actualCost: computedFields.actualCostPaid,
      actualDuration: computedFields.effectiveDurationTurns,
      synergyBonuses: computedFields.synergyBonusesApplied,
      discoveryContext,
      generatedModulePath: modulePath,
    };

    return {
      success: true,
      module: generatedModule,
      logEntry,
    };
  }

  // -----------------------------------------------------------------------
  // Method 2 — enrichWithComputedFields
  // -----------------------------------------------------------------------

  /**
   * Creates a {@link ComputedResearchFields} object from raw research
   * outcome data. Pure mapping function.
   *
   * @param _tech            - The base technology (unused but provided for context).
   * @param actualCost       - The actual resource cost paid for research.
   * @param actualDuration   - The actual number of turns research took.
   * @param synergyBonuses   - Names of synergy bonuses that were applied.
   * @param educationBonus   - Education bonus percentage (0-100).
   * @param efficiency       - Research efficiency at completion (0-1).
   * @returns A new {@link ComputedResearchFields} object.
   *
   * @see FR-3500
   */
  enrichWithComputedFields(
    _tech: TechnologyModel,
    actualCost: number,
    actualDuration: number,
    synergyBonuses: readonly string[],
    educationBonus: number,
    efficiency: number,
  ): ComputedResearchFields {
    return {
      actualCostPaid: Math.max(0, actualCost),
      effectiveDurationTurns: Math.max(1, actualDuration),
      synergyBonusesApplied: [...synergyBonuses],
      educationBonusPercent: clamp(educationBonus, 0, 100),
      efficiencyAtCompletion: clamp(efficiency, 0, 1),
    };
  }

  // -----------------------------------------------------------------------
  // Method 3 — createDiscoveryContext
  // -----------------------------------------------------------------------

  /**
   * Creates a {@link DiscoveryContext} snapshot from the current nation
   * state, capturing tech levels, GDP, stability, and research efficiency.
   *
   * @param nation       - The current nation state.
   * @param turn         - The current game turn.
   * @param scenarioId   - The active scenario identifier.
   * @param domainLevels - Current tech domain levels for the nation.
   * @param efficiency   - Current research efficiency multiplier (0-1).
   * @returns A new {@link DiscoveryContext} snapshot.
   *
   * @see FR-3500
   */
  createDiscoveryContext(
    nation: NationState,
    turn: number,
    scenarioId: string,
    domainLevels: Partial<Record<TechDomainKey, number>>,
    efficiency: number,
  ): DiscoveryContext {
    /* Build a tech-level snapshot from the domain levels */
    const nationTechLevels: Partial<Record<TechDomainKey, number>> = { ...domainLevels };

    return {
      factionId: nation.factionId,
      turn,
      scenarioId,
      nationTechLevels,
      nationDomainLevels: { ...domainLevels },
      gdp: nation.gdp,
      stability: nation.stability,
      researchEfficiency: clamp(efficiency, 0, 1),
    };
  }

  // -----------------------------------------------------------------------
  // Method 4 — exportSingleModule
  // -----------------------------------------------------------------------

  /**
   * Serialises a {@link GeneratedTechModule} to a formatted JSON string
   * suitable for file export or cross-scenario transfer.
   *
   * @param module - The generated tech module to serialise.
   * @returns A formatted JSON string representation of the module.
   *
   * @see CNFL-4300
   */
  exportSingleModule(module: GeneratedTechModule): string {
    return JSON.stringify(module, null, 2);
  }

  // -----------------------------------------------------------------------
  // Method 5 — importModule
  // -----------------------------------------------------------------------

  /**
   * Parses a JSON string representing a {@link GeneratedTechModule},
   * validates that it contains the required fields, and checks that the
   * technology has not already been researched in the target scenario.
   *
   * @param moduleJson           - The JSON string to parse.
   * @param existingResearchedTechs - Set or array of already-researched tech IDs.
   * @returns An {@link ImportModuleResult} indicating success or failure.
   *
   * @see CNFL-4300
   */
  importModule(
    moduleJson: string,
    existingResearchedTechs: readonly string[],
  ): ImportModuleResult {
    let parsed: Record<string, unknown>;

    try {
      parsed = JSON.parse(moduleJson) as Record<string, unknown>;
    } catch {
      return { success: false, error: 'Invalid JSON format' };
    }

    /* Validate required fields */
    if (typeof parsed['techId'] !== 'string' || parsed['techId'] === '') {
      return { success: false, error: 'Missing or invalid techId' };
    }

    if (typeof parsed['name'] !== 'string' || parsed['name'] === '') {
      return { success: false, error: 'Missing or invalid name' };
    }

    if (typeof parsed['domain'] !== 'string') {
      return { success: false, error: 'Missing or invalid domain' };
    }

    if (typeof parsed['researchCost'] !== 'number') {
      return { success: false, error: 'Missing or invalid researchCost' };
    }

    const techId = parsed['techId'] as string;

    /* Check for duplicates */
    if (existingResearchedTechs.includes(techId)) {
      return {
        success: false,
        error: `Technology "${techId}" has already been researched`,
      };
    }

    return { success: true, techId };
  }

  // -----------------------------------------------------------------------
  // Method 6 — batchExport
  // -----------------------------------------------------------------------

  /**
   * Creates a {@link TechPackage} containing multiple generated tech
   * modules for batch export. Computes aggregate cost and duration totals.
   *
   * @param modules      - The generated tech modules to package.
   * @param scenarioId   - The source scenario identifier.
   * @param factionId    - The exporting faction.
   * @param packageName  - Human-readable package name.
   * @returns A new {@link TechPackage} containing all modules.
   *
   * @see FR-3500
   */
  batchExport(
    modules: readonly GeneratedTechModule[],
    scenarioId: string,
    factionId: FactionId,
    packageName: string,
  ): TechPackage {
    const totalCostPaid = modules.reduce(
      (sum, m) => sum + m.computedFields.actualCostPaid,
      0,
    );
    const totalResearchTurns = modules.reduce(
      (sum, m) => sum + m.computedFields.effectiveDurationTurns,
      0,
    );

    const now = new Date().toISOString();
    const packageId = `pkg-${factionId}-${now.replace(/[^0-9]/g, '').slice(0, 14)}`;

    return {
      packageId,
      packageName,
      scenarioId,
      factionId,
      exportedAt: now,
      modules: [...modules],
      totalCostPaid,
      totalResearchTurns,
    };
  }

  // -----------------------------------------------------------------------
  // Method 7 — recordDiscovery
  // -----------------------------------------------------------------------

  /**
   * Appends a new {@link TechDiscoveryLogEntry} to the cross-scenario
   * discovery log. Returns a new array (immutable append).
   *
   * @param module - The generated tech module to create a log entry from.
   * @param log    - The existing discovery log entries.
   * @returns A new log array with the appended entry.
   *
   * @see DR-176 — Technology Discovery Log
   */
  recordDiscovery(
    module: GeneratedTechModule,
    log: readonly TechDiscoveryLogEntry[],
  ): readonly TechDiscoveryLogEntry[] {
    const modulePath =
      `models/technology/generated/${module.techId}-${module.generatedBy}.json`;

    const entry: TechDiscoveryLogEntry = {
      techId: module.techId,
      scenarioId: module.scenarioId,
      factionId: module.generatedBy,
      turnDiscovered: module.generatedOnTurn,
      actualCost: module.computedFields.actualCostPaid,
      actualDuration: module.computedFields.effectiveDurationTurns,
      synergyBonuses: module.computedFields.synergyBonusesApplied,
      discoveryContext: module.discoveryContext,
      generatedModulePath: modulePath,
    };

    return [...log, entry];
  }

  // -----------------------------------------------------------------------
  // Method 8 — queryByTech
  // -----------------------------------------------------------------------

  /**
   * Filters discovery log entries by technology identifier.
   *
   * @param log    - The discovery log to query.
   * @param techId - The technology identifier to filter by.
   * @returns Log entries matching the given techId.
   *
   * @see DR-176
   */
  queryByTech(
    log: readonly TechDiscoveryLogEntry[],
    techId: string,
  ): readonly TechDiscoveryLogEntry[] {
    return log.filter((entry) => entry.techId === techId);
  }

  // -----------------------------------------------------------------------
  // Method 9 — queryByFaction
  // -----------------------------------------------------------------------

  /**
   * Filters discovery log entries by faction identifier.
   *
   * @param log       - The discovery log to query.
   * @param factionId - The faction identifier to filter by.
   * @returns Log entries matching the given factionId.
   *
   * @see DR-176
   */
  queryByFaction(
    log: readonly TechDiscoveryLogEntry[],
    factionId: FactionId,
  ): readonly TechDiscoveryLogEntry[] {
    return log.filter((entry) => entry.factionId === factionId);
  }

  // -----------------------------------------------------------------------
  // Method 10 — getLeaderboard
  // -----------------------------------------------------------------------

  /**
   * Queries the discovery log for all completions of a given technology,
   * ranks them by the specified metric, and returns the top entries.
   *
   * @param log    - The discovery log to query.
   * @param techId - The technology identifier to rank.
   * @param metric - Ranking metric: `'fastest'` (lowest turn) or `'cheapest'` (lowest cost).
   * @returns Top {@link LEADERBOARD_MAX_ENTRIES} entries sorted by the chosen metric.
   *
   * @see FR-3500
   */
  getLeaderboard(
    log: readonly TechDiscoveryLogEntry[],
    techId: string,
    metric: 'fastest' | 'cheapest',
  ): readonly TechLeaderboardEntry[] {
    const matching = log.filter((entry) => entry.techId === techId);

    const entries: TechLeaderboardEntry[] = matching.map((entry) => ({
      techId: entry.techId,
      techName: entry.techId, // Name derived from techId as log doesn't store names
      factionId: entry.factionId,
      scenarioId: entry.scenarioId,
      turnDiscovered: entry.turnDiscovered,
      actualCost: entry.actualCost,
      actualDuration: entry.actualDuration,
    }));

    const sorted = entries.sort((a, b) => {
      if (metric === 'fastest') {
        return a.turnDiscovered - b.turnDiscovered;
      }
      return a.actualCost - b.actualCost;
    });

    return sorted.slice(0, LEADERBOARD_MAX_ENTRIES);
  }
}
