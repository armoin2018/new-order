import { describe, it, expect, beforeEach } from 'vitest';
import type { TurnNumber, FactionId, LeaderId, TutorialPhase } from '@/data/types';
import { TutorialPhase as TutorialPhaseEnum } from '@/data/types';
import {
  TutorialModdingEngine,
  type LeaderExportPayload,
} from '@/engine/tutorial-modding-engine';
import { GAME_CONFIG } from '@/engine/config';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const turn = (n: number) => n as TurnNumber;
const faction = (id: string) => id as FactionId;
const leader = (id: string) => id as LeaderId;

function makeValidPayload(overrides: Partial<LeaderExportPayload> = {}): LeaderExportPayload {
  return {
    schemaVersion: '1.0.0',
    leaderId: leader('leader-1'),
    leaderName: 'Test Leader',
    factionId: faction('USA'),
    psychology: { aggression: 70, caution: 30 },
    exportedAt: '2026-03-04T00:00:00.000Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('TutorialModdingEngine', () => {
  let engine: TutorialModdingEngine;

  beforeEach(() => {
    engine = new TutorialModdingEngine({
      tutorial: GAME_CONFIG.tutorial,
      modding: GAME_CONFIG.modding,
    });
  });

  // =========================================================================
  // advanceTutorialPhase
  // =========================================================================

  describe('advanceTutorialPhase', () => {
    it('should auto-skip when gamesPlayed >= autoSkipAfterGames and phase is NotStarted', () => {
      const result = engine.advanceTutorialPhase({
        currentPhase: TutorialPhaseEnum.NotStarted,
        currentTurn: turn(0),
        gamesPlayed: 1,
      });
      expect(result.newPhase).toBe(TutorialPhaseEnum.Skipped);
      expect(result.showOverlay).toBe(false);
      expect(result.overlayContent).toBe('');
      expect(result.reason).toContain('auto-skipped');
    });

    it('should auto-skip when gamesPlayed is well above threshold', () => {
      const result = engine.advanceTutorialPhase({
        currentPhase: TutorialPhaseEnum.NotStarted,
        currentTurn: turn(0),
        gamesPlayed: 10,
      });
      expect(result.newPhase).toBe(TutorialPhaseEnum.Skipped);
      expect(result.showOverlay).toBe(false);
    });

    it('should be a no-op when phase is already Completed', () => {
      const result = engine.advanceTutorialPhase({
        currentPhase: TutorialPhaseEnum.Completed,
        currentTurn: turn(5),
        gamesPlayed: 0,
      });
      expect(result.newPhase).toBe(TutorialPhaseEnum.Completed);
      expect(result.showOverlay).toBe(false);
      expect(result.overlayContent).toBe('');
      expect(result.reason).toContain('already');
    });

    it('should be a no-op when phase is already Skipped', () => {
      const result = engine.advanceTutorialPhase({
        currentPhase: TutorialPhaseEnum.Skipped,
        currentTurn: turn(2),
        gamesPlayed: 0,
      });
      expect(result.newPhase).toBe(TutorialPhaseEnum.Skipped);
      expect(result.showOverlay).toBe(false);
      expect(result.overlayContent).toBe('');
    });

    it('should transition NotStarted → Introduction on turn 0', () => {
      const result = engine.advanceTutorialPhase({
        currentPhase: TutorialPhaseEnum.NotStarted,
        currentTurn: turn(0),
        gamesPlayed: 0,
      });
      expect(result.newPhase).toBe(TutorialPhaseEnum.Introduction);
      expect(result.showOverlay).toBe(true);
      expect(result.overlayContent).toContain('Welcome to New Order');
    });

    it('should transition Introduction → FirstTurn on turn 1', () => {
      const result = engine.advanceTutorialPhase({
        currentPhase: TutorialPhaseEnum.Introduction,
        currentTurn: turn(1),
        gamesPlayed: 0,
      });
      expect(result.newPhase).toBe(TutorialPhaseEnum.FirstTurn);
      expect(result.showOverlay).toBe(true);
      expect(result.overlayContent).toContain('Turn 1');
    });

    it('should transition FirstTurn → SecondTurn on turn 2', () => {
      const result = engine.advanceTutorialPhase({
        currentPhase: TutorialPhaseEnum.FirstTurn,
        currentTurn: turn(2),
        gamesPlayed: 0,
      });
      expect(result.newPhase).toBe(TutorialPhaseEnum.SecondTurn);
      expect(result.showOverlay).toBe(true);
      expect(result.overlayContent).toContain('Turn 2');
    });

    it('should transition SecondTurn → ThirdTurn on turn 3', () => {
      const result = engine.advanceTutorialPhase({
        currentPhase: TutorialPhaseEnum.SecondTurn,
        currentTurn: turn(3),
        gamesPlayed: 0,
      });
      expect(result.newPhase).toBe(TutorialPhaseEnum.ThirdTurn);
      expect(result.showOverlay).toBe(true);
      expect(result.overlayContent).toContain('Turn 3');
    });

    it('should transition ThirdTurn → Completed when turn exceeds advisoryOverlayTurns', () => {
      const result = engine.advanceTutorialPhase({
        currentPhase: TutorialPhaseEnum.ThirdTurn,
        currentTurn: turn(4),
        gamesPlayed: 0,
      });
      expect(result.newPhase).toBe(TutorialPhaseEnum.Completed);
      expect(result.showOverlay).toBe(false);
      expect(result.overlayContent).toBe('');
      expect(result.reason).toContain('completed');
    });

    it('should not transition when turn does not match expected transition', () => {
      const result = engine.advanceTutorialPhase({
        currentPhase: TutorialPhaseEnum.NotStarted,
        currentTurn: turn(5),
        gamesPlayed: 0,
      });
      expect(result.newPhase).toBe(TutorialPhaseEnum.NotStarted);
      expect(result.reason).toContain('No phase transition');
    });

    it('should remain in Introduction when turn is not 1', () => {
      const result = engine.advanceTutorialPhase({
        currentPhase: TutorialPhaseEnum.Introduction,
        currentTurn: turn(0),
        gamesPlayed: 0,
      });
      expect(result.newPhase).toBe(TutorialPhaseEnum.Introduction);
      expect(result.showOverlay).toBe(true);
      expect(result.overlayContent).toContain('Welcome to New Order');
    });

    it('should remain in ThirdTurn when turn equals advisoryOverlayTurns exactly', () => {
      const result = engine.advanceTutorialPhase({
        currentPhase: TutorialPhaseEnum.ThirdTurn,
        currentTurn: turn(3),
        gamesPlayed: 0,
      });
      expect(result.newPhase).toBe(TutorialPhaseEnum.ThirdTurn);
      expect(result.showOverlay).toBe(true);
    });
  });

  // =========================================================================
  // skipTutorial
  // =========================================================================

  describe('skipTutorial', () => {
    it('should skip from NotStarted phase', () => {
      const result = engine.skipTutorial({
        currentPhase: TutorialPhaseEnum.NotStarted,
      });
      expect(result.newPhase).toBe(TutorialPhaseEnum.Skipped);
      expect(result.wasAlreadyComplete).toBe(false);
      expect(result.reason).toContain('skipped');
    });

    it('should skip from Introduction phase', () => {
      const result = engine.skipTutorial({
        currentPhase: TutorialPhaseEnum.Introduction,
      });
      expect(result.newPhase).toBe(TutorialPhaseEnum.Skipped);
      expect(result.wasAlreadyComplete).toBe(false);
    });

    it('should skip from FirstTurn phase', () => {
      const result = engine.skipTutorial({
        currentPhase: TutorialPhaseEnum.FirstTurn,
      });
      expect(result.newPhase).toBe(TutorialPhaseEnum.Skipped);
      expect(result.wasAlreadyComplete).toBe(false);
    });

    it('should report already complete when phase is Completed', () => {
      const result = engine.skipTutorial({
        currentPhase: TutorialPhaseEnum.Completed,
      });
      expect(result.newPhase).toBe(TutorialPhaseEnum.Completed);
      expect(result.wasAlreadyComplete).toBe(true);
      expect(result.reason).toContain('already');
    });

    it('should report already complete when phase is Skipped', () => {
      const result = engine.skipTutorial({
        currentPhase: TutorialPhaseEnum.Skipped,
      });
      expect(result.newPhase).toBe(TutorialPhaseEnum.Skipped);
      expect(result.wasAlreadyComplete).toBe(true);
    });
  });

  // =========================================================================
  // getKeyboardNavigationMap
  // =========================================================================

  describe('getKeyboardNavigationMap', () => {
    it('should return exactly 7 hotkey entries', () => {
      const result = engine.getKeyboardNavigationMap();
      expect(result.hotkeys).toHaveLength(7);
    });

    it('should include strategicDashboard mapped to Tab', () => {
      const result = engine.getKeyboardNavigationMap();
      const entry = result.hotkeys.find(h => h.action === 'strategicDashboard');
      expect(entry).toBeDefined();
      expect(entry!.key).toBe('Tab');
      expect(entry!.description).toContain('Strategic Dashboard');
    });

    it('should include actionMenu mapped to a', () => {
      const result = engine.getKeyboardNavigationMap();
      const entry = result.hotkeys.find(h => h.action === 'actionMenu');
      expect(entry).toBeDefined();
      expect(entry!.key).toBe('a');
    });

    it('should include diplomacyPanel mapped to d', () => {
      const result = engine.getKeyboardNavigationMap();
      const entry = result.hotkeys.find(h => h.action === 'diplomacyPanel');
      expect(entry).toBeDefined();
      expect(entry!.key).toBe('d');
    });

    it('should include endTurn mapped to Enter', () => {
      const result = engine.getKeyboardNavigationMap();
      const entry = result.hotkeys.find(h => h.action === 'endTurn');
      expect(entry).toBeDefined();
      expect(entry!.key).toBe('Enter');
    });

    it('should include saveGame mapped to ctrl+s', () => {
      const result = engine.getKeyboardNavigationMap();
      const entry = result.hotkeys.find(h => h.action === 'saveGame');
      expect(entry).toBeDefined();
      expect(entry!.key).toBe('ctrl+s');
    });

    it('should include loadGame mapped to ctrl+l', () => {
      const result = engine.getKeyboardNavigationMap();
      const entry = result.hotkeys.find(h => h.action === 'loadGame');
      expect(entry).toBeDefined();
      expect(entry!.key).toBe('ctrl+l');
    });

    it('should provide descriptions for all hotkeys', () => {
      const result = engine.getKeyboardNavigationMap();
      for (const hotkey of result.hotkeys) {
        expect(hotkey.description.length).toBeGreaterThan(0);
      }
    });

    it('should include a reason string', () => {
      const result = engine.getKeyboardNavigationMap();
      expect(result.reason).toContain('7');
    });
  });

  // =========================================================================
  // getAccessibilityReport
  // =========================================================================

  describe('getAccessibilityReport', () => {
    it('should be fully compliant when all features present (score 100)', () => {
      const result = engine.getAccessibilityReport({
        hasAriaLabels: true,
        hasAlternativeIndicators: true,
        hasKeyboardNavigation: true,
      });
      expect(result.wcagCompliant).toBe(true);
      expect(result.missingFeatures).toHaveLength(0);
      expect(result.score).toBe(100);
      expect(result.reason).toContain('passed');
    });

    it('should be non-compliant with score 1 when all features missing', () => {
      const result = engine.getAccessibilityReport({
        hasAriaLabels: false,
        hasAlternativeIndicators: false,
        hasKeyboardNavigation: false,
      });
      expect(result.wcagCompliant).toBe(false);
      expect(result.missingFeatures).toHaveLength(3);
      expect(result.score).toBe(1);
    });

    it('should deduct 33 points for missing ARIA labels', () => {
      const result = engine.getAccessibilityReport({
        hasAriaLabels: false,
        hasAlternativeIndicators: true,
        hasKeyboardNavigation: true,
      });
      expect(result.wcagCompliant).toBe(false);
      expect(result.missingFeatures).toHaveLength(1);
      expect(result.score).toBe(67);
      expect(result.missingFeatures[0]).toContain('ARIA');
    });

    it('should deduct 33 points for missing alternative indicators', () => {
      const result = engine.getAccessibilityReport({
        hasAriaLabels: true,
        hasAlternativeIndicators: false,
        hasKeyboardNavigation: true,
      });
      expect(result.wcagCompliant).toBe(false);
      expect(result.missingFeatures).toHaveLength(1);
      expect(result.score).toBe(67);
      expect(result.missingFeatures[0]).toContain('colorblind');
    });

    it('should deduct 33 points for missing keyboard navigation', () => {
      const result = engine.getAccessibilityReport({
        hasAriaLabels: true,
        hasAlternativeIndicators: true,
        hasKeyboardNavigation: false,
      });
      expect(result.wcagCompliant).toBe(false);
      expect(result.missingFeatures).toHaveLength(1);
      expect(result.score).toBe(67);
      expect(result.missingFeatures[0]).toContain('keyboard');
    });

    it('should deduct 66 points when two features are missing', () => {
      const result = engine.getAccessibilityReport({
        hasAriaLabels: false,
        hasAlternativeIndicators: false,
        hasKeyboardNavigation: true,
      });
      expect(result.wcagCompliant).toBe(false);
      expect(result.missingFeatures).toHaveLength(2);
      expect(result.score).toBe(34);
    });
  });

  // =========================================================================
  // exportCustomLeader
  // =========================================================================

  describe('exportCustomLeader', () => {
    it('should export successfully when below the limit', () => {
      const result = engine.exportCustomLeader({
        leaderId: leader('leader-1'),
        leaderName: 'General Kenobi',
        factionId: faction('USA'),
        psychology: { aggression: 60, caution: 40 },
        existingExportCount: 0,
      });
      expect(result.exported).toBe(true);
      expect(result.exportData.schemaVersion).toBe('1.0.0');
      expect(result.exportData.leaderId).toBe('leader-1');
      expect(result.exportData.leaderName).toBe('General Kenobi');
      expect(result.exportData.factionId).toBe('USA');
      expect(result.reason).toContain('successfully');
    });

    it('should export successfully at count 49 (one below limit)', () => {
      const result = engine.exportCustomLeader({
        leaderId: leader('leader-49'),
        leaderName: 'Leader 49',
        factionId: faction('CHN'),
        psychology: { aggression: 50 },
        existingExportCount: 49,
      });
      expect(result.exported).toBe(true);
    });

    it('should fail when existingExportCount equals maxCustomLeaders (50)', () => {
      const result = engine.exportCustomLeader({
        leaderId: leader('leader-51'),
        leaderName: 'Excess Leader',
        factionId: faction('RUS'),
        psychology: { aggression: 80 },
        existingExportCount: 50,
      });
      expect(result.exported).toBe(false);
      expect(result.reason).toContain('limit');
    });

    it('should fail when existingExportCount exceeds maxCustomLeaders', () => {
      const result = engine.exportCustomLeader({
        leaderId: leader('leader-99'),
        leaderName: 'Way Over',
        factionId: faction('EU'),
        psychology: { aggression: 90 },
        existingExportCount: 100,
      });
      expect(result.exported).toBe(false);
    });

    it('should include schemaVersion 1.0.0 in the export payload', () => {
      const result = engine.exportCustomLeader({
        leaderId: leader('leader-sv'),
        leaderName: 'Schema Check',
        factionId: faction('USA'),
        psychology: { caution: 50 },
        existingExportCount: 0,
      });
      expect(result.exportData.schemaVersion).toBe('1.0.0');
    });

    it('should still populate exportData even when export fails', () => {
      const result = engine.exportCustomLeader({
        leaderId: leader('leader-fail'),
        leaderName: 'Fail Export',
        factionId: faction('USA'),
        psychology: { aggression: 55 },
        existingExportCount: 50,
      });
      expect(result.exported).toBe(false);
      expect(result.exportData).toBeDefined();
      expect(result.exportData.leaderId).toBe('leader-fail');
    });
  });

  // =========================================================================
  // validateLeaderImport
  // =========================================================================

  describe('validateLeaderImport', () => {
    it('should validate a correct payload with no errors', () => {
      const result = engine.validateLeaderImport({
        payload: makeValidPayload(),
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.reason).toContain('valid');
    });

    it('should reject a wrong schema version', () => {
      const result = engine.validateLeaderImport({
        payload: makeValidPayload({ schemaVersion: '2.0.0' }),
      });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
      expect(result.errors[0]).toContain('Schema version');
    });

    it('should reject an empty leaderId', () => {
      const result = engine.validateLeaderImport({
        payload: makeValidPayload({ leaderId: '' as LeaderId }),
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('leaderId'))).toBe(true);
    });

    it('should reject an empty leaderName', () => {
      const result = engine.validateLeaderImport({
        payload: makeValidPayload({ leaderName: '' }),
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('leaderName'))).toBe(true);
    });

    it('should reject an empty factionId', () => {
      const result = engine.validateLeaderImport({
        payload: makeValidPayload({ factionId: '' as FactionId }),
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('factionId'))).toBe(true);
    });

    it('should reject empty psychology (no keys)', () => {
      const result = engine.validateLeaderImport({
        payload: makeValidPayload({ psychology: {} }),
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('psychology'))).toBe(true);
    });

    it('should accumulate multiple errors when several fields are invalid', () => {
      const result = engine.validateLeaderImport({
        payload: makeValidPayload({
          schemaVersion: '9.9.9',
          leaderId: '' as LeaderId,
          leaderName: '',
          factionId: '' as FactionId,
          psychology: {},
        }),
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(5);
      expect(result.reason).toContain('5 error');
    });

    it('should pass when psychology has at least one key', () => {
      const result = engine.validateLeaderImport({
        payload: makeValidPayload({ psychology: { charisma: 80 } }),
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  // =========================================================================
  // registerEventHandler
  // =========================================================================

  describe('registerEventHandler', () => {
    it('should register successfully when below the limit', () => {
      const result = engine.registerEventHandler({
        handlerId: 'handler-1',
        eventType: 'turnEnd',
        existingHandlerCount: 0,
      });
      expect(result.registered).toBe(true);
      expect(result.handlerId).toBe('handler-1');
      expect(result.eventType).toBe('turnEnd');
      expect(result.reason).toContain('registered');
    });

    it('should register successfully at count 99 (one below limit)', () => {
      const result = engine.registerEventHandler({
        handlerId: 'handler-99',
        eventType: 'diplomacy',
        existingHandlerCount: 99,
      });
      expect(result.registered).toBe(true);
    });

    it('should fail when existingHandlerCount equals maxEventHandlers (100)', () => {
      const result = engine.registerEventHandler({
        handlerId: 'handler-fail',
        eventType: 'combat',
        existingHandlerCount: 100,
      });
      expect(result.registered).toBe(false);
      expect(result.reason).toContain('limit');
    });

    it('should fail when existingHandlerCount exceeds maxEventHandlers', () => {
      const result = engine.registerEventHandler({
        handlerId: 'handler-over',
        eventType: 'trade',
        existingHandlerCount: 200,
      });
      expect(result.registered).toBe(false);
    });

    it('should echo back the handlerId and eventType even on failure', () => {
      const result = engine.registerEventHandler({
        handlerId: 'echo-check',
        eventType: 'espionage',
        existingHandlerCount: 100,
      });
      expect(result.handlerId).toBe('echo-check');
      expect(result.eventType).toBe('espionage');
    });
  });
});
