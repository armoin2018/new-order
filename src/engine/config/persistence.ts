/**
 * Simulation Persistence Configuration — FR-4200 (DR-188, DR-189)
 *
 * Default directory layout, auto-save settings, file names, and limits
 * for the simulation persistence engine.
 *
 * All persistence tuning is centralised here — no code changes required.
 *
 * @see NFR-204 — All game formulas shall be configurable via constants.
 * @see FR-4201 — Auto-save to disk
 * @see FR-4202 — Running context document
 * @see FR-4203 — Simulation browser
 * @see FR-4205 — Auto-save cadence
 * @see DR-188  — Save directory structure
 * @see DR-189  — Running context document format
 */

export const persistenceConfig = {
  /**
   * Root directory under the user's home for all simulation saves.
   * Each simulation lives in a sub-folder named by its SimulationId.
   * @see DR-188
   */
  baseDirectory: '~/.newOrder/simulations',

  /**
   * Auto-save default settings.
   * @see FR-4205
   */
  autoSave: {
    /** Whether auto-save is enabled by default. */
    enabled: true,
    /** Number of turns between automatic saves. */
    intervalTurns: 3,
    /** Maximum auto-save slots before the oldest is pruned. */
    maxAutoSaves: 10,
  },

  /**
   * Canonical file names within each simulation save directory.
   * @see DR-188
   */
  fileNames: {
    gameState: 'gameState.json',
    turnHistory: 'turnHistory.json',
    marketData: 'marketData.json',
    aiDecisionLog: 'aiDecisions.json',
    budgetHistory: 'budgetHistory.json',
    currencyRecords: 'currencyRecords.json',
    contextDocument: 'currentContext.md',
    manifest: 'manifest.json',
  },

  /**
   * Ordered list of sections that appear in the running context document.
   * @see DR-189
   */
  contextSections: [
    'executiveSummary',
    'recentEvents',
    'keyMetrics',
    'aiAnalysis',
    'recommendations',
  ] as const,

  /**
   * Maximum number of simulations the browser will track.
   * Beyond this count the oldest completed simulations are pruned.
   * @see FR-4203
   */
  maxSimulations: 100,
} as const;
