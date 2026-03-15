/**
 * Tech–Research Integration — CNFL-4303
 *
 * Bridges the {@link ResearchSystem} and {@link TechModuleFactory} so that
 * every time a technology is completed, a reusable technology module is
 * auto-generated and registered in the {@link TechModuleRegistryState}.
 *
 * Also wires the {@link IndexCrossFeed} research-speed modifier into the
 * research pipeline so that tech-index performance accelerates or
 * decelerates R&D.
 *
 * All public methods are **pure functions** — no mutation, no side effects.
 *
 * @module engine/tech-research-integration
 * @see FR-3500  — Technology Module Generation
 * @see CNFL-4303 — Tech Factory → Research System Integration
 */

import type { FactionId, NationState, TechnologyModel } from '@/data/types';
import type { TechDomainKey } from '@/data/types/model.types';
import type {
  TechModuleRegistryState,
  TechModuleRecord,
  TechModuleDiscoveryEntry,
} from '@/data/types/model.types';
import type { ResearchTurnResult, NationRnDState } from './research-system';
import {
  TechModuleFactory,
  type GeneratedTechModule,
  type TechDiscoveryLogEntry,
} from './tech-module-factory';

// ---------------------------------------------------------------------------
// Exported Types
// ---------------------------------------------------------------------------

/**
 * Input for processing research completions through the tech module factory.
 *
 * @see CNFL-4303
 */
export interface TechResearchIntegrationInput {
  /** Research turn result containing completed tech IDs. */
  readonly researchResult: ResearchTurnResult;
  /** Current nation state at time of completion. */
  readonly nation: NationState;
  /** Current turn number. */
  readonly turn: number;
  /** Active scenario identifier. */
  readonly scenarioId: string;
  /** Per-domain research levels for the faction. */
  readonly domainLevels: Partial<Record<TechDomainKey, number>>;
  /** Current research efficiency multiplier. */
  readonly researchEfficiency: number;
  /** Full technology catalog for lookup. */
  readonly techCatalog: readonly TechnologyModel[];
  /** Current R&D state for looking up project details. */
  readonly rndState: NationRnDState;
  /** Existing tech module registry (null if first discovery). */
  readonly currentRegistry: TechModuleRegistryState | null;
}

/**
 * Result of processing research completions through the tech module factory.
 *
 * @see CNFL-4303
 */
export interface TechResearchIntegrationResult {
  /** Updated tech module registry. */
  readonly updatedRegistry: TechModuleRegistryState;
  /** Newly generated module records. */
  readonly newModules: readonly TechModuleRecord[];
  /** Discovery log entries created. */
  readonly newDiscoveries: readonly TechModuleDiscoveryEntry[];
  /** Human-readable events for the turn log. */
  readonly events: readonly string[];
}

/**
 * Input for applying a research speed modifier from index cross-feeds.
 *
 * @see CNFL-4303
 */
export interface ResearchSpeedInput {
  /** Base research speed multiplier for the faction. */
  readonly baseSpeed: number;
  /** Tech index research speed multiplier from IndexCrossFeed. */
  readonly indexSpeedMultiplier: number;
  /** Optional education bonus percentage (0–100). */
  readonly educationBonusPercent?: number;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Stateless integration layer that connects the research system to the
 * tech module factory and index cross-feed system.
 *
 * @see CNFL-4303
 */
export class TechResearchIntegration {
  private readonly factory: TechModuleFactory;

  constructor() {
    this.factory = new TechModuleFactory();
  }

  // ── Research Completion → Module Generation ───────────────────────────

  /**
   * Process completed technologies from a research turn result and
   * generate tech modules for each.
   *
   * For each completed tech ID:
   * 1. Look up the TechnologyModel from the catalog.
   * 2. Create a DiscoveryContext from the current nation state.
   * 3. Build ComputedResearchFields from the R&D state.
   * 4. Generate the module via TechModuleFactory.
   * 5. Convert to a TechModuleRecord for GameState storage.
   *
   * @param input Complete integration input.
   * @returns Integration result with updated registry and events.
   *
   * @see CNFL-4303
   * @see FR-3500
   */
  processCompletions(
    input: TechResearchIntegrationInput,
  ): TechResearchIntegrationResult {
    const {
      researchResult,
      nation,
      turn,
      scenarioId,
      domainLevels,
      researchEfficiency,
      techCatalog,
      rndState,
      currentRegistry,
    } = input;

    const catalogMap = new Map(techCatalog.map((t) => [t.techId, t]));

    const newModules: TechModuleRecord[] = [];
    const newDiscoveries: TechModuleDiscoveryEntry[] = [];
    const events: string[] = [];

    // Start from existing registry or create empty
    let modules: Record<string, TechModuleRecord> = currentRegistry
      ? { ...currentRegistry.modules }
      : {};
    let discoveryLog: TechModuleDiscoveryEntry[] = currentRegistry
      ? [...currentRegistry.discoveryLog]
      : [];

    for (const techId of researchResult.completedTechs) {
      const tech = catalogMap.get(techId);
      if (!tech) {
        events.push(`Tech module skipped: ${techId} not found in catalog.`);
        continue;
      }

      // Build discovery context
      const discoveryContext = this.factory.createDiscoveryContext(
        nation,
        turn,
        scenarioId,
        domainLevels,
        researchEfficiency,
      );

      // Find the project to extract actual cost/duration
      const project = rndState.activeResearch.find(
        (p) => p.techId === techId,
      );
      const actualCost = project?.investedSoFar ?? tech.researchCost;
      const actualDuration = project?.turnsSpent ?? tech.researchDurationTurns;

      // Build computed fields
      const computedFields = this.factory.enrichWithComputedFields(
        tech,
        actualCost,
        actualDuration,
        [], // synergy bonuses (can be enriched later)
        0, // education bonus (can be enriched later)
        researchEfficiency,
      );

      // Generate the module
      const result = this.factory.generateModule(
        tech,
        discoveryContext,
        computedFields,
      );

      if (!result.success || !result.module || !result.logEntry) {
        events.push(`Tech module generation failed for: ${techId}`);
        continue;
      }

      // Convert to lean TechModuleRecord for GameState storage
      const record = this.toModuleRecord(result.module);
      const key = `${techId}-${nation.factionId}`;

      modules = { ...modules, [key]: record };
      newModules.push(record);

      // Convert to lean discovery entry
      const discovery = this.toDiscoveryEntry(result.logEntry);
      discoveryLog = [...discoveryLog, discovery];
      newDiscoveries.push(discovery);

      events.push(
        `Tech module generated: ${tech.name} (${tech.domain}) for ${String(nation.factionId)}`,
      );
    }

    return {
      updatedRegistry: {
        modules,
        discoveryLog,
      },
      newModules,
      newDiscoveries,
      events,
    };
  }

  // ── Research Speed Modification ───────────────────────────────────────

  /**
   * Compute the effective research speed multiplier by combining the
   * base faction speed, tech-index modifier, and optional education bonus.
   *
   * @param input Research speed inputs.
   * @returns Effective speed multiplier (≥ 0.5).
   *
   * @see CNFL-4303
   */
  computeEffectiveResearchSpeed(input: ResearchSpeedInput): number {
    const { baseSpeed, indexSpeedMultiplier, educationBonusPercent } = input;

    // Education bonus: 0–100% → 0.0–0.3 additive boost
    const educationBoost = educationBonusPercent
      ? (educationBonusPercent / 100) * 0.3
      : 0;

    const effective = baseSpeed * indexSpeedMultiplier + educationBoost;

    // Floor at 0.5 to prevent research from stalling completely
    return Math.max(0.5, Math.round(effective * 1000) / 1000);
  }

  // ── Registry Queries ──────────────────────────────────────────────────

  /**
   * Get all modules generated by a specific faction.
   *
   * @param registry Current tech module registry.
   * @param factionId Faction to query.
   * @returns Array of module records for the faction.
   */
  getModulesForFaction(
    registry: TechModuleRegistryState,
    factionId: FactionId,
  ): readonly TechModuleRecord[] {
    return Object.values(registry.modules).filter(
      (m) => m.generatedBy === (factionId as string),
    );
  }

  /**
   * Get the number of modules generated per faction.
   *
   * @param registry Current tech module registry.
   * @returns Map of faction ID → module count.
   */
  getModuleCountsByFaction(
    registry: TechModuleRegistryState,
  ): Readonly<Record<string, number>> {
    const counts: Record<string, number> = {};
    for (const module of Object.values(registry.modules)) {
      counts[module.generatedBy] = (counts[module.generatedBy] ?? 0) + 1;
    }
    return counts;
  }

  /**
   * Check if a specific technology has been modularised for a faction.
   *
   * @param registry Current tech module registry.
   * @param techId Technology ID.
   * @param factionId Faction ID.
   * @returns True if the module exists.
   */
  hasModule(
    registry: TechModuleRegistryState,
    techId: string,
    factionId: string,
  ): boolean {
    const key = `${techId}-${factionId}`;
    return key in registry.modules;
  }

  // ── Private Helpers ───────────────────────────────────────────────────

  /**
   * Convert a GeneratedTechModule to a lean TechModuleRecord for
   * GameState serialisation.
   */
  private toModuleRecord(module: GeneratedTechModule): TechModuleRecord {
    return {
      techId: module.techId,
      name: module.name,
      domain: module.domain,
      tier: module.tier,
      generatedBy: module.generatedBy as string,
      generatedOnTurn: module.generatedOnTurn,
      scenarioId: module.scenarioId,
      actualCostPaid: module.computedFields.actualCostPaid,
      effectiveDurationTurns: module.computedFields.effectiveDurationTurns,
      synergyBonuses: [...module.computedFields.synergyBonusesApplied],
      exportable: module.exportable,
    };
  }

  /**
   * Convert a TechDiscoveryLogEntry to a lean TechModuleDiscoveryEntry
   * for GameState serialisation.
   */
  private toDiscoveryEntry(
    logEntry: TechDiscoveryLogEntry,
  ): TechModuleDiscoveryEntry {
    return {
      techId: logEntry.techId,
      factionId: logEntry.factionId as string,
      turnDiscovered: logEntry.turnDiscovered,
      actualCost: logEntry.actualCost,
      actualDuration: logEntry.actualDuration,
    };
  }
}
