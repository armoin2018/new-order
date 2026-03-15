/**
 * Tutorial & Modding Engine — NFR-301, NFR-302, NFR-303, NFR-202, NFR-203
 *
 * Manages the tutorial / onboarding flow with a Strategic Advisory overlay
 * for the first 3 turns, keyboard navigation helpers, WCAG 2.1 AA
 * accessibility validation, custom leader export/import, and pluggable
 * event handler registration.
 *
 * All methods are pure — they return results without mutating inputs.
 *
 * @see NFR-301 — WCAG 2.1 AA: screen-reader support
 * @see NFR-302 — WCAG 2.1 AA: colorblind-safe indicators
 * @see NFR-303 — WCAG 2.1 AA: full keyboard navigation
 * @see NFR-202 — Data-driven AI profiles (JSON, not hard-coded)
 * @see NFR-203 — Pluggable event handlers registered at runtime
 */

import type {
  TurnNumber,
  FactionId,
  LeaderId,
} from '@/data/types';

import {
  TutorialPhase as TutorialPhaseEnum,
} from '@/data/types';

import type { TutorialPhase } from '@/data/types';

import { GAME_CONFIG } from './config';

// ---------------------------------------------------------------------------
// Exported Config Type
// ---------------------------------------------------------------------------

/**
 * Configuration sourced from the tutorial & modding game constants.
 * @see NFR-301, NFR-202
 */
export type TutorialModdingConfig = {
  tutorial: typeof GAME_CONFIG.tutorial;
  modding: typeof GAME_CONFIG.modding;
};

// ---------------------------------------------------------------------------
// Result & Payload Interfaces
// ---------------------------------------------------------------------------

/**
 * Result of advancing through a tutorial phase.
 * @see NFR-301
 */
export interface TutorialPhaseResult {
  /** The phase after advancement. */
  readonly newPhase: TutorialPhase;
  /** Whether the Strategic Advisory overlay should be displayed. */
  readonly showOverlay: boolean;
  /** Descriptive content for the overlay panel. */
  readonly overlayContent: string;
  /** Human-readable explanation of the transition. */
  readonly reason: string;
}

/**
 * Result of explicitly skipping the tutorial.
 * @see NFR-301
 */
export interface TutorialSkipResult {
  /** The phase after skipping. */
  readonly newPhase: TutorialPhase;
  /** True when the tutorial was already Completed or Skipped. */
  readonly wasAlreadyComplete: boolean;
  /** Human-readable explanation. */
  readonly reason: string;
}

/**
 * A single keyboard hotkey entry for the navigation map.
 * @see NFR-303
 */
export interface HotkeyEntry {
  /** Logical action name (e.g. "strategicDashboard"). */
  readonly action: string;
  /** Key or key-combo string (e.g. "Tab", "ctrl+s"). */
  readonly key: string;
  /** Human-readable description of the hotkey's effect. */
  readonly description: string;
}

/**
 * Full keyboard navigation map result.
 * @see NFR-303
 */
export interface KeyboardNavigationResult {
  /** All configured hotkeys with descriptions. */
  readonly hotkeys: HotkeyEntry[];
  /** Human-readable explanation. */
  readonly reason: string;
}

/**
 * WCAG 2.1 AA accessibility compliance report.
 * @see NFR-301, NFR-302, NFR-303
 */
export interface AccessibilityReportResult {
  /** True when all three WCAG checks pass. */
  readonly wcagCompliant: boolean;
  /** Names of missing accessibility features. */
  readonly missingFeatures: string[];
  /** Compliance score: 0–100. Each missing feature deducts 33 points. */
  readonly score: number;
  /** Human-readable explanation. */
  readonly reason: string;
}

/**
 * Serialisable payload used when exporting / importing a custom leader.
 * @see NFR-202
 */
export interface LeaderExportPayload {
  /** Schema version for forward/backward compatibility. */
  readonly schemaVersion: string;
  /** Unique leader identifier. */
  readonly leaderId: LeaderId;
  /** Display name of the leader. */
  readonly leaderName: string;
  /** Faction the leader belongs to. */
  readonly factionId: FactionId;
  /** Numeric psychology dimension values. */
  readonly psychology: Record<string, number>;
  /** ISO-8601 timestamp of when the export was created. */
  readonly exportedAt: string;
}

/**
 * Result of exporting a custom leader profile.
 * @see NFR-202
 */
export interface ExportLeaderResult {
  /** Whether the export succeeded. */
  readonly exported: boolean;
  /** The serialised export payload (always populated for inspection). */
  readonly exportData: LeaderExportPayload;
  /** Human-readable explanation. */
  readonly reason: string;
}

/**
 * Result of validating an imported leader payload.
 * @see NFR-202
 */
export interface ImportValidationResult {
  /** Whether the payload passed all checks. */
  readonly valid: boolean;
  /** Validation error messages (empty when valid). */
  readonly errors: string[];
  /** Human-readable explanation. */
  readonly reason: string;
}

/**
 * Result of registering a pluggable event handler.
 * @see NFR-203
 */
export interface EventHandlerResult {
  /** Whether the handler was registered successfully. */
  readonly registered: boolean;
  /** Unique identifier of the handler. */
  readonly handlerId: string;
  /** Event type the handler listens for. */
  readonly eventType: string;
  /** Human-readable explanation. */
  readonly reason: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Clamp a numeric value between `min` and `max` (inclusive). */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Human-readable descriptions for each configured hotkey action. */
const HOTKEY_DESCRIPTIONS: Readonly<Record<string, string>> = {
  strategicDashboard: 'Open the Strategic Dashboard overview',
  actionMenu: 'Open the Action Menu',
  diplomacyPanel: 'Open the Diplomacy Panel',
  intelligencePanel: 'Open the Intelligence Panel',
  endTurn: 'End the current turn',
  saveGame: 'Save the current game',
  loadGame: 'Load a saved game',
} as const;

/** Overlay content strings for each active tutorial phase. */
const OVERLAY_CONTENT: Readonly<Record<string, string>> = {
  [TutorialPhaseEnum.Introduction]:
    'Welcome to New Order! This Strategic Advisory overlay will guide you through the basics of geopolitical decision-making.',
  [TutorialPhaseEnum.FirstTurn]:
    'Turn 1: Review your nation\'s dashboard, check diplomatic relationships, and issue your first strategic directive.',
  [TutorialPhaseEnum.SecondTurn]:
    'Turn 2: Explore intelligence reports, manage economic levers, and respond to emerging crises.',
  [TutorialPhaseEnum.ThirdTurn]:
    'Turn 3: Assess alliance dynamics, deploy covert operations, and finalise your grand strategy. The advisory overlay will end after this turn.',
} as const;

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/**
 * Tutorial & Modding Engine.
 *
 * Manages onboarding tutorial phase progression, accessibility compliance
 * checks, custom leader export/import, and pluggable event handler
 * registration. Designed for the "New Order" turn-based simulation.
 *
 * @see NFR-301 — Screen-reader support
 * @see NFR-302 — Colorblind-safe indicators
 * @see NFR-303 — Full keyboard navigation
 * @see NFR-202 — Data-driven AI profiles
 * @see NFR-203 — Pluggable event handlers
 */
export class TutorialModdingEngine {
  private readonly config: TutorialModdingConfig;

  constructor(config: TutorialModdingConfig) {
    this.config = config;
  }

  // -----------------------------------------------------------------------
  // Tutorial Flow
  // -----------------------------------------------------------------------

  /**
   * Advance the tutorial to the next phase based on the current turn and
   * the number of games the player has completed. If the player has already
   * played enough games the tutorial is auto-skipped.
   *
   * @see NFR-301
   * @see CNFL-2805
   */
  advanceTutorialPhase(input: {
    readonly currentPhase: TutorialPhase;
    readonly currentTurn: TurnNumber;
    readonly gamesPlayed: number;
  }): TutorialPhaseResult {
    const { currentPhase, currentTurn, gamesPlayed } = input;
    const turn = currentTurn as number;

    // Auto-skip for experienced players
    if (
      gamesPlayed >= this.config.tutorial.autoSkipAfterGames &&
      currentPhase === TutorialPhaseEnum.NotStarted
    ) {
      return {
        newPhase: TutorialPhaseEnum.Skipped,
        showOverlay: false,
        overlayContent: '',
        reason: `Player has completed ${gamesPlayed} game(s); tutorial auto-skipped.`,
      };
    }

    // Already finished — no-op
    if (
      currentPhase === TutorialPhaseEnum.Completed ||
      currentPhase === TutorialPhaseEnum.Skipped
    ) {
      return {
        newPhase: currentPhase,
        showOverlay: false,
        overlayContent: '',
        reason: 'Tutorial already completed or skipped.',
      };
    }

    // Phase-specific transitions
    if (currentPhase === TutorialPhaseEnum.NotStarted && turn === 0) {
      return this.buildOverlayResult(
        TutorialPhaseEnum.Introduction,
        'Tutorial started — Introduction phase.',
      );
    }

    if (currentPhase === TutorialPhaseEnum.Introduction && turn === 1) {
      return this.buildOverlayResult(
        TutorialPhaseEnum.FirstTurn,
        'Advanced to FirstTurn phase.',
      );
    }

    if (currentPhase === TutorialPhaseEnum.FirstTurn && turn === 2) {
      return this.buildOverlayResult(
        TutorialPhaseEnum.SecondTurn,
        'Advanced to SecondTurn phase.',
      );
    }

    if (currentPhase === TutorialPhaseEnum.SecondTurn && turn === 3) {
      return this.buildOverlayResult(
        TutorialPhaseEnum.ThirdTurn,
        'Advanced to ThirdTurn phase.',
      );
    }

    if (
      currentPhase === TutorialPhaseEnum.ThirdTurn &&
      turn > this.config.tutorial.advisoryOverlayTurns
    ) {
      return {
        newPhase: TutorialPhaseEnum.Completed,
        showOverlay: false,
        overlayContent: '',
        reason: 'Advisory overlay turns exceeded — tutorial completed.',
      };
    }

    // No transition applicable — remain in current phase
    return {
      newPhase: currentPhase,
      showOverlay: this.isOverlayPhase(currentPhase),
      overlayContent: OVERLAY_CONTENT[currentPhase] ?? '',
      reason: 'No phase transition applicable for the current turn.',
    };
  }

  /**
   * Explicitly skip the tutorial regardless of the current phase.
   *
   * @see NFR-301
   */
  skipTutorial(input: {
    readonly currentPhase: TutorialPhase;
  }): TutorialSkipResult {
    const { currentPhase } = input;

    if (
      currentPhase === TutorialPhaseEnum.Completed ||
      currentPhase === TutorialPhaseEnum.Skipped
    ) {
      return {
        newPhase: currentPhase,
        wasAlreadyComplete: true,
        reason: 'Tutorial was already completed or skipped.',
      };
    }

    return {
      newPhase: TutorialPhaseEnum.Skipped,
      wasAlreadyComplete: false,
      reason: `Tutorial skipped from ${currentPhase} phase.`,
    };
  }

  // -----------------------------------------------------------------------
  // Keyboard Navigation (NFR-303)
  // -----------------------------------------------------------------------

  /**
   * Return the full keyboard navigation map derived from the tutorial
   * hotkey configuration.
   *
   * @see NFR-303
   */
  getKeyboardNavigationMap(): KeyboardNavigationResult {
    const hotkeys: HotkeyEntry[] = Object.entries(
      this.config.tutorial.hotkeys,
    ).map(([action, key]) => ({
      action,
      key,
      description: HOTKEY_DESCRIPTIONS[action] ?? action,
    }));

    return {
      hotkeys,
      reason: `Returned ${hotkeys.length} configured hotkey(s).`,
    };
  }

  // -----------------------------------------------------------------------
  // Accessibility (NFR-301, NFR-302, NFR-303)
  // -----------------------------------------------------------------------

  /**
   * Evaluate the current UI against WCAG 2.1 AA requirements and produce
   * a compliance report with an overall score.
   *
   * @see NFR-301
   * @see NFR-302
   * @see NFR-303
   */
  getAccessibilityReport(input: {
    readonly hasAriaLabels: boolean;
    readonly hasAlternativeIndicators: boolean;
    readonly hasKeyboardNavigation: boolean;
  }): AccessibilityReportResult {
    const { hasAriaLabels, hasAlternativeIndicators, hasKeyboardNavigation } =
      input;

    const missingFeatures: string[] = [];

    if (!hasAriaLabels) {
      missingFeatures.push('ARIA labels for screen-reader support (NFR-301)');
    }
    if (!hasAlternativeIndicators) {
      missingFeatures.push(
        'Alternative visual indicators for colorblind users (NFR-302)',
      );
    }
    if (!hasKeyboardNavigation) {
      missingFeatures.push('Full keyboard navigation support (NFR-303)');
    }

    const rawScore = 100 - missingFeatures.length * 33;
    const score = clamp(rawScore, 0, 100);
    const wcagCompliant = missingFeatures.length === 0;

    return {
      wcagCompliant,
      missingFeatures,
      score,
      reason: wcagCompliant
        ? 'All WCAG 2.1 AA checks passed.'
        : `WCAG non-compliant — missing: ${missingFeatures.join('; ')}.`,
    };
  }

  // -----------------------------------------------------------------------
  // Custom Leader Export / Import (NFR-202)
  // -----------------------------------------------------------------------

  /**
   * Export a custom leader profile as a serialisable payload. Enforces the
   * maximum custom leader limit from the modding configuration.
   *
   * @see NFR-202
   */
  exportCustomLeader(input: {
    readonly leaderId: LeaderId;
    readonly leaderName: string;
    readonly factionId: FactionId;
    readonly psychology: Record<string, number>;
    readonly existingExportCount: number;
  }): ExportLeaderResult {
    const { leaderId, leaderName, factionId, psychology, existingExportCount } =
      input;

    const exportData: LeaderExportPayload = {
      schemaVersion: this.config.modding.exportSchemaVersion,
      leaderId,
      leaderName,
      factionId,
      psychology,
      exportedAt: '2026-03-04T00:00:00.000Z',
    };

    if (existingExportCount >= this.config.modding.maxCustomLeaders) {
      return {
        exported: false,
        exportData,
        reason: `Export limit reached (${this.config.modding.maxCustomLeaders} custom leaders maximum).`,
      };
    }

    return {
      exported: true,
      exportData,
      reason: 'Leader exported successfully.',
    };
  }

  /**
   * Validate an imported leader payload for schema compatibility and
   * required field presence.
   *
   * @see NFR-202
   */
  validateLeaderImport(input: {
    readonly payload: LeaderExportPayload;
  }): ImportValidationResult {
    const { payload } = input;
    const errors: string[] = [];

    if (payload.schemaVersion !== this.config.modding.exportSchemaVersion) {
      errors.push(
        `Schema version mismatch: expected '${this.config.modding.exportSchemaVersion}', got '${payload.schemaVersion}'.`,
      );
    }

    if (!payload.leaderId || (payload.leaderId as string).length === 0) {
      errors.push('leaderId must be a non-empty string.');
    }

    if (!payload.leaderName || payload.leaderName.length === 0) {
      errors.push('leaderName must be a non-empty string.');
    }

    if (!payload.factionId || (payload.factionId as string).length === 0) {
      errors.push('factionId must be a non-empty string.');
    }

    if (
      !payload.psychology ||
      Object.keys(payload.psychology).length === 0
    ) {
      errors.push('psychology must contain at least one key.');
    }

    return {
      valid: errors.length === 0,
      errors,
      reason:
        errors.length === 0
          ? 'Import payload is valid.'
          : `Import validation failed with ${errors.length} error(s).`,
    };
  }

  // -----------------------------------------------------------------------
  // Pluggable Event Handlers (NFR-203)
  // -----------------------------------------------------------------------

  /**
   * Register a new pluggable event handler. Enforces the maximum handler
   * count from the modding configuration.
   *
   * @see NFR-203
   */
  registerEventHandler(input: {
    readonly handlerId: string;
    readonly eventType: string;
    readonly existingHandlerCount: number;
  }): EventHandlerResult {
    const { handlerId, eventType, existingHandlerCount } = input;

    if (existingHandlerCount >= this.config.modding.maxEventHandlers) {
      return {
        registered: false,
        handlerId,
        eventType,
        reason: `Handler limit reached (${this.config.modding.maxEventHandlers} maximum).`,
      };
    }

    return {
      registered: true,
      handlerId,
      eventType,
      reason: `Handler '${handlerId}' registered for '${eventType}' events.`,
    };
  }

  // -----------------------------------------------------------------------
  // Private Helpers
  // -----------------------------------------------------------------------

  /**
   * Build a TutorialPhaseResult for phases that display the overlay.
   */
  private buildOverlayResult(
    phase: TutorialPhase,
    reason: string,
  ): TutorialPhaseResult {
    return {
      newPhase: phase,
      showOverlay: true,
      overlayContent: OVERLAY_CONTENT[phase] ?? '',
      reason,
    };
  }

  /**
   * Determine whether a given phase should display the advisory overlay.
   */
  private isOverlayPhase(phase: TutorialPhase): boolean {
    return (
      phase === TutorialPhaseEnum.Introduction ||
      phase === TutorialPhaseEnum.FirstTurn ||
      phase === TutorialPhaseEnum.SecondTurn ||
      phase === TutorialPhaseEnum.ThirdTurn
    );
  }
}
