import { describe, it, expect, beforeEach } from 'vitest';
import { GrudgeLedgerEngine } from '@/engine/grudge-ledger';
import type {
  AddGrudgeInput,
  DecayGrudgesInput,
  RetaliationUtilityInput,
  ResolveGrudgeInput,
  DossierInput,
} from '@/engine/grudge-ledger';
import { GAME_CONFIG } from '@/engine/config';
import { OffenseType } from '@/data/types';
import type { LeaderId, TurnNumber, Grudge } from '@/data/types';

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

const LEADER_A = 'leader-a' as LeaderId;
const LEADER_B = 'leader-b' as LeaderId;
const TURN = 5 as TurnNumber;

function makeGrudge(overrides: Partial<Grudge> = {}): Grudge {
  return {
    offender: LEADER_B,
    offenseType: OffenseType.Betrayal,
    severity: 5,
    turnCreated: 1 as TurnNumber,
    currentDecayedSeverity: 5,
    resolved: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GrudgeLedgerEngine', () => {
  let engine: GrudgeLedgerEngine;

  beforeEach(() => {
    engine = new GrudgeLedgerEngine(GAME_CONFIG.psychology);
  });

  // =========================================================================
  // addGrudge (FR-1510)
  // =========================================================================
  describe('addGrudge', () => {
    it('creates a grudge with correct offender, offenseType, severity, turnCreated, and resolved=false', () => {
      const input: AddGrudgeInput = {
        leaderId: LEADER_A,
        offender: LEADER_B,
        offenseType: OffenseType.Betrayal,
        severity: 7,
        currentTurn: TURN,
      };

      const result = engine.addGrudge(input);

      expect(result.grudge.offender).toBe(LEADER_B);
      expect(result.grudge.offenseType).toBe(OffenseType.Betrayal);
      expect(result.grudge.severity).toBe(7);
      expect(result.grudge.turnCreated).toBe(TURN);
      expect(result.grudge.resolved).toBe(false);
    });

    it('sets currentDecayedSeverity equal to the clamped severity', () => {
      const result = engine.addGrudge({
        leaderId: LEADER_A,
        offender: LEADER_B,
        offenseType: OffenseType.Aggression,
        severity: 6,
        currentTurn: TURN,
      });

      expect(result.grudge.currentDecayedSeverity).toBe(6);
      expect(result.grudge.currentDecayedSeverity).toBe(result.grudge.severity);
    });

    it('clamps severity to minimum 1 when given 0', () => {
      const result = engine.addGrudge({
        leaderId: LEADER_A,
        offender: LEADER_B,
        offenseType: OffenseType.Insult,
        severity: 0,
        currentTurn: TURN,
      });

      expect(result.grudge.severity).toBe(1);
      expect(result.grudge.currentDecayedSeverity).toBe(1);
    });

    it('clamps severity to maximum 10 when given 15', () => {
      const result = engine.addGrudge({
        leaderId: LEADER_A,
        offender: LEADER_B,
        offenseType: OffenseType.Sanctions,
        severity: 15,
        currentTurn: TURN,
      });

      expect(result.grudge.severity).toBe(10);
      expect(result.grudge.currentDecayedSeverity).toBe(10);
    });

    it('accepts all OffenseType enum values', () => {
      const types = [
        OffenseType.Insult,
        OffenseType.Aggression,
        OffenseType.Betrayal,
        OffenseType.Sanctions,
        OffenseType.EspionageDiscovered,
      ];

      for (const ot of types) {
        const result = engine.addGrudge({
          leaderId: LEADER_A,
          offender: LEADER_B,
          offenseType: ot,
          severity: 5,
          currentTurn: TURN,
        });

        expect(result.grudge.offenseType).toBe(ot);
      }
    });
  });

  // =========================================================================
  // decayGrudges (FR-1510)
  // =========================================================================
  describe('decayGrudges', () => {
    it('applies normal decay when vengefulIndex ≤ 50', () => {
      const input: DecayGrudgesInput = {
        leaderId: LEADER_A,
        grudges: [makeGrudge({ currentDecayedSeverity: 5 })],
        vengefulIndex: 30,
        currentTurn: TURN,
      };

      const result = engine.decayGrudges(input);

      expect(result.updatedGrudges[0].currentDecayedSeverity).toBeCloseTo(4.5);
      expect(result.grudgesDecayed).toBe(1);
    });

    it('applies vengeful decay when vengefulIndex > 50', () => {
      const input: DecayGrudgesInput = {
        leaderId: LEADER_A,
        grudges: [makeGrudge({ currentDecayedSeverity: 5 })],
        vengefulIndex: 60,
        currentTurn: TURN,
      };

      const result = engine.decayGrudges(input);

      expect(result.updatedGrudges[0].currentDecayedSeverity).toBeCloseTo(4.75);
      expect(result.grudgesDecayed).toBe(1);
    });

    it('cannot decay below minimum severity', () => {
      const input: DecayGrudgesInput = {
        leaderId: LEADER_A,
        grudges: [makeGrudge({ currentDecayedSeverity: 1.2 })],
        vengefulIndex: 30,
        currentTurn: TURN,
      };

      const result = engine.decayGrudges(input);

      // max(1.2 - 0.5, 1) = 1
      expect(result.updatedGrudges[0].currentDecayedSeverity).toBeCloseTo(1);
    });

    it('keeps grudges at minimum and counts them correctly', () => {
      const input: DecayGrudgesInput = {
        leaderId: LEADER_A,
        grudges: [makeGrudge({ currentDecayedSeverity: 1 })],
        vengefulIndex: 30,
        currentTurn: TURN,
      };

      const result = engine.decayGrudges(input);

      expect(result.updatedGrudges[0].currentDecayedSeverity).toBe(1);
      expect(result.grudgesAtMinimum).toBe(1);
      expect(result.grudgesDecayed).toBe(0);
    });

    it('leaves resolved grudges unchanged', () => {
      const input: DecayGrudgesInput = {
        leaderId: LEADER_A,
        grudges: [makeGrudge({ resolved: true, currentDecayedSeverity: 5 })],
        vengefulIndex: 30,
        currentTurn: TURN,
      };

      const result = engine.decayGrudges(input);

      expect(result.updatedGrudges[0].currentDecayedSeverity).toBe(5);
      expect(result.grudgesDecayed).toBe(0);
    });

    it('decays multiple grudges, skipping resolved ones', () => {
      const input: DecayGrudgesInput = {
        leaderId: LEADER_A,
        grudges: [
          makeGrudge({ currentDecayedSeverity: 5, resolved: true }),
          makeGrudge({ currentDecayedSeverity: 4 }),
          makeGrudge({ currentDecayedSeverity: 3 }),
        ],
        vengefulIndex: 30,
        currentTurn: TURN,
      };

      const result = engine.decayGrudges(input);

      // Resolved stays unchanged
      expect(result.updatedGrudges[0].currentDecayedSeverity).toBe(5);
      // Two unresolved are decayed
      expect(result.updatedGrudges[1].currentDecayedSeverity).toBeCloseTo(3.5);
      expect(result.updatedGrudges[2].currentDecayedSeverity).toBeCloseTo(2.5);
      expect(result.grudgesDecayed).toBe(2);
    });

    it('uses normal decay at vengefulIndex boundary of exactly 50', () => {
      const input: DecayGrudgesInput = {
        leaderId: LEADER_A,
        grudges: [makeGrudge({ currentDecayedSeverity: 5 })],
        vengefulIndex: 50,
        currentTurn: TURN,
      };

      const result = engine.decayGrudges(input);

      // Exactly 50 is NOT > 50, so normal decay: 5 - 0.5 = 4.5
      expect(result.updatedGrudges[0].currentDecayedSeverity).toBeCloseTo(4.5);
    });

    it('uses vengeful decay at vengefulIndex 51', () => {
      const input: DecayGrudgesInput = {
        leaderId: LEADER_A,
        grudges: [makeGrudge({ currentDecayedSeverity: 5 })],
        vengefulIndex: 51,
        currentTurn: TURN,
      };

      const result = engine.decayGrudges(input);

      // 51 > 50, so vengeful decay: 5 - 0.25 = 4.75
      expect(result.updatedGrudges[0].currentDecayedSeverity).toBeCloseTo(4.75);
    });
  });

  // =========================================================================
  // computeRetaliationUtility (FR-1510)
  // =========================================================================
  describe('computeRetaliationUtility', () => {
    it('computes utility boost for a single unresolved grudge', () => {
      const input: RetaliationUtilityInput = {
        leaderId: LEADER_A,
        targetLeader: LEADER_B,
        grudges: [makeGrudge({ currentDecayedSeverity: 5 })],
        baseUtility: 10,
      };

      const result = engine.computeRetaliationUtility(input);

      expect(result.totalGrudgeSeverity).toBe(5);
      expect(result.utilityBoost).toBe(10);
      expect(result.modifiedUtility).toBe(20);
    });

    it('sums severity across multiple unresolved grudges', () => {
      const input: RetaliationUtilityInput = {
        leaderId: LEADER_A,
        targetLeader: LEADER_B,
        grudges: [
          makeGrudge({ currentDecayedSeverity: 5 }),
          makeGrudge({ currentDecayedSeverity: 3 }),
        ],
        baseUtility: 10,
      };

      const result = engine.computeRetaliationUtility(input);

      expect(result.totalGrudgeSeverity).toBe(8);
      expect(result.utilityBoost).toBe(16);
      expect(result.modifiedUtility).toBe(26);
    });

    it('ignores resolved grudges', () => {
      const input: RetaliationUtilityInput = {
        leaderId: LEADER_A,
        targetLeader: LEADER_B,
        grudges: [
          makeGrudge({ currentDecayedSeverity: 5, resolved: true }),
          makeGrudge({ currentDecayedSeverity: 3, resolved: false }),
        ],
        baseUtility: 10,
      };

      const result = engine.computeRetaliationUtility(input);

      expect(result.totalGrudgeSeverity).toBe(3);
      expect(result.utilityBoost).toBe(6);
      expect(result.modifiedUtility).toBe(16);
    });

    it('ignores grudges against other leaders', () => {
      const LEADER_C = 'leader-c' as LeaderId;
      const input: RetaliationUtilityInput = {
        leaderId: LEADER_A,
        targetLeader: LEADER_B,
        grudges: [
          makeGrudge({ offender: LEADER_B, currentDecayedSeverity: 5 }),
          makeGrudge({ offender: LEADER_C, currentDecayedSeverity: 7 }),
        ],
        baseUtility: 10,
      };

      const result = engine.computeRetaliationUtility(input);

      expect(result.totalGrudgeSeverity).toBe(5);
      expect(result.utilityBoost).toBe(10);
      expect(result.modifiedUtility).toBe(20);
    });

    it('returns zero boost when there are no grudges', () => {
      const input: RetaliationUtilityInput = {
        leaderId: LEADER_A,
        targetLeader: LEADER_B,
        grudges: [],
        baseUtility: 10,
      };

      const result = engine.computeRetaliationUtility(input);

      expect(result.totalGrudgeSeverity).toBe(0);
      expect(result.utilityBoost).toBe(0);
      expect(result.modifiedUtility).toBe(10);
    });

    it('reports correct grudgeCount for matching unresolved grudges', () => {
      const LEADER_C = 'leader-c' as LeaderId;
      const input: RetaliationUtilityInput = {
        leaderId: LEADER_A,
        targetLeader: LEADER_B,
        grudges: [
          makeGrudge({ offender: LEADER_B, currentDecayedSeverity: 2 }),
          makeGrudge({ offender: LEADER_B, currentDecayedSeverity: 3 }),
          makeGrudge({ offender: LEADER_C, currentDecayedSeverity: 4 }),
          makeGrudge({ offender: LEADER_B, currentDecayedSeverity: 1, resolved: true }),
        ],
        baseUtility: 0,
      };

      const result = engine.computeRetaliationUtility(input);

      expect(result.grudgeCount).toBe(2);
    });
  });

  // =========================================================================
  // resolveGrudge (FR-1510)
  // =========================================================================
  describe('resolveGrudge', () => {
    it('resolves all unresolved grudges against offender when offenseType is null', () => {
      const grudges: Grudge[] = [
        makeGrudge({ offenseType: OffenseType.Betrayal }),
        makeGrudge({ offenseType: OffenseType.Insult }),
        makeGrudge({ offenseType: OffenseType.Aggression }),
      ];

      const input: ResolveGrudgeInput = {
        leaderId: LEADER_A,
        offender: LEADER_B,
        offenseType: null,
        grudges,
        currentTurn: TURN,
      };

      const result = engine.resolveGrudge(input);

      expect(result.resolvedCount).toBe(3);
      expect(result.updatedGrudges.every((g) => g.resolved)).toBe(true);
    });

    it('resolves only the first matching grudge when offenseType is specified', () => {
      const grudges: Grudge[] = [
        makeGrudge({ offenseType: OffenseType.Betrayal }),
        makeGrudge({ offenseType: OffenseType.Betrayal }),
      ];

      const input: ResolveGrudgeInput = {
        leaderId: LEADER_A,
        offender: LEADER_B,
        offenseType: OffenseType.Betrayal,
        grudges,
        currentTurn: TURN,
      };

      const result = engine.resolveGrudge(input);

      expect(result.resolvedCount).toBe(1);
      expect(result.updatedGrudges[0].resolved).toBe(true);
      expect(result.updatedGrudges[1].resolved).toBe(false);
    });

    it('returns resolvedCount 0 when no grudges match the offender', () => {
      const LEADER_C = 'leader-c' as LeaderId;
      const grudges: Grudge[] = [makeGrudge({ offender: LEADER_B })];

      const input: ResolveGrudgeInput = {
        leaderId: LEADER_A,
        offender: LEADER_C,
        offenseType: null,
        grudges,
        currentTurn: TURN,
      };

      const result = engine.resolveGrudge(input);

      expect(result.resolvedCount).toBe(0);
    });

    it('does not re-resolve already-resolved grudges', () => {
      const grudges: Grudge[] = [
        makeGrudge({ resolved: true }),
        makeGrudge({ resolved: false }),
      ];

      const input: ResolveGrudgeInput = {
        leaderId: LEADER_A,
        offender: LEADER_B,
        offenseType: null,
        grudges,
        currentTurn: TURN,
      };

      const result = engine.resolveGrudge(input);

      // Only the second (unresolved) grudge counts
      expect(result.resolvedCount).toBe(1);
      expect(result.updatedGrudges[0].resolved).toBe(true);
      expect(result.updatedGrudges[1].resolved).toBe(true);
    });

    it('leaves grudges against other offenders untouched when resolving all', () => {
      const LEADER_C = 'leader-c' as LeaderId;
      const grudges: Grudge[] = [
        makeGrudge({ offender: LEADER_B }),
        makeGrudge({ offender: LEADER_C }),
      ];

      const input: ResolveGrudgeInput = {
        leaderId: LEADER_A,
        offender: LEADER_B,
        offenseType: null,
        grudges,
        currentTurn: TURN,
      };

      const result = engine.resolveGrudge(input);

      expect(result.resolvedCount).toBe(1);
      expect(result.updatedGrudges[0].resolved).toBe(true);
      expect(result.updatedGrudges[1].resolved).toBe(false);
    });

    it('returns a new array without mutating the original', () => {
      const grudges: Grudge[] = [makeGrudge()];

      const input: ResolveGrudgeInput = {
        leaderId: LEADER_A,
        offender: LEADER_B,
        offenseType: null,
        grudges,
        currentTurn: TURN,
      };

      const result = engine.resolveGrudge(input);

      expect(result.updatedGrudges).not.toBe(grudges);
      expect(grudges[0].resolved).toBe(false);
      expect(result.updatedGrudges[0].resolved).toBe(true);
    });
  });

  // =========================================================================
  // buildDossier (FR-1520)
  // =========================================================================
  describe('buildDossier', () => {
    const baseDossierInput: DossierInput = {
      targetLeader: LEADER_B,
      humintClarity: 70,
      knownEmotionalState: {
        stress: 40,
        confidence: 60,
        anger: 20,
        fear: 10,
        resolve: 80,
      },
      knownBiasCount: 3,
      chemistry: 15,
      trust: 50,
      grudgeCount: 2,
      driftMagnitude: 12,
    };

    it('makes all 7 sections available at high HUMINT (70) with overallClarity=high', () => {
      const result = engine.buildDossier(baseDossierInput);

      expect(result.sections).toHaveLength(7);
      expect(result.sections.every((s) => s.available)).toBe(true);
      expect(result.overallClarity).toBe('high');
    });

    it('gates sections correctly at medium HUMINT (45)', () => {
      const input: DossierInput = { ...baseDossierInput, humintClarity: 45 };
      const result = engine.buildDossier(input);

      // Profile(30)✓, Emotional(40)✓, Biases(60)✗, Chemistry(20)✓,
      // Trust(20)✓, Grudge(40)✓, Drift(50)✗
      const available = result.sections.filter((s) => s.available);
      expect(available).toHaveLength(5);
      expect(result.overallClarity).toBe('medium');

      // Verify specific sections
      expect(result.sections.find((s) => s.label === 'Cognitive Biases')!.available).toBe(false);
      expect(result.sections.find((s) => s.label === 'Personality Drift')!.available).toBe(false);
    });

    it('gates sections correctly at low HUMINT (25)', () => {
      const input: DossierInput = { ...baseDossierInput, humintClarity: 25 };
      const result = engine.buildDossier(input);

      // Profile(30)✗, Emotional(40)✗, Biases(60)✗, Chemistry(20)✓,
      // Trust(20)✓, Grudge(40)✗, Drift(50)✗
      const available = result.sections.filter((s) => s.available);
      expect(available).toHaveLength(2);
      expect(result.overallClarity).toBe('low');
    });

    it('marks all sections unavailable at minimal HUMINT (15)', () => {
      const input: DossierInput = { ...baseDossierInput, humintClarity: 15 };
      const result = engine.buildDossier(input);

      const available = result.sections.filter((s) => s.available);
      expect(available).toHaveLength(0);
      expect(result.overallClarity).toBe('minimal');
    });

    it('shows "??" for unavailable sections', () => {
      const input: DossierInput = { ...baseDossierInput, humintClarity: 15 };
      const result = engine.buildDossier(input);

      for (const section of result.sections) {
        expect(section.summary).toBe('??');
      }
    });

    it('shows actual emotional state values when section is available', () => {
      const result = engine.buildDossier(baseDossierInput);

      const emotionalSection = result.sections.find((s) => s.label === 'Emotional State')!;
      expect(emotionalSection.available).toBe(true);
      expect(emotionalSection.summary).toContain('Stress: 40');
      expect(emotionalSection.summary).toContain('Confidence: 60');
      expect(emotionalSection.summary).toContain('Anger: 20');
      expect(emotionalSection.summary).toContain('Fear: 10');
      expect(emotionalSection.summary).toContain('Resolve: 80');
    });

    it('always returns exactly 7 sections', () => {
      const humintLevels = [0, 15, 25, 45, 70, 100];

      for (const humintClarity of humintLevels) {
        const result = engine.buildDossier({ ...baseDossierInput, humintClarity });
        expect(result.sections).toHaveLength(7);
      }
    });

    it('includes sections with correct labels', () => {
      const result = engine.buildDossier(baseDossierInput);

      const labels = result.sections.map((s) => s.label);
      expect(labels).toEqual([
        'Psychological Profile',
        'Emotional State',
        'Cognitive Biases',
        'Chemistry',
        'Trust Score',
        'Grudge Ledger',
        'Personality Drift',
      ]);
    });
  });
});
