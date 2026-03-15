import { describe, it, expect, beforeEach } from 'vitest';
import { TechDecouplingEngine } from '@/engine/tech-decoupling-engine';
import type {
  DecouplingInput,
  BlocMembershipInput,
  QuantumThreatInput,
  DualUseDilemmaInput,
} from '@/engine/tech-decoupling-engine';
import { GAME_CONFIG } from '@/engine/config';
import { DecouplingStatus, TechBlocAlignment, DualUseChoice } from '@/data/types';
import type { FactionId, TurnNumber } from '@/data/types';

const US = 'us' as FactionId;
const CHINA = 'china' as FactionId;
const IRAN = 'iran' as FactionId;
const TURN = 5 as TurnNumber;

describe('TechDecouplingEngine', () => {
  let engine: TechDecouplingEngine;

  beforeEach(() => {
    engine = new TechDecouplingEngine(GAME_CONFIG.technology);
  });

  // ─────────────────────────────────────────────────────────
  // FR-1806 — evaluateDecoupling
  // ─────────────────────────────────────────────────────────

  describe('evaluateDecoupling', () => {
    it('triggers when both factions ≥ 60 with mutual export controls', () => {
      const input: DecouplingInput = {
        factionA: US,
        factionB: CHINA,
        factionATechLevel: 70,
        factionBTechLevel: 75,
        mutualExportControls: true,
        currentTurn: TURN,
      };
      const result = engine.evaluateDecoupling(input);
      expect(result.triggered).toBe(true);
      expect(result.decouplingStatus).toBe(DecouplingStatus.Bifurcated);
      expect(result.globalGDPPenalty).toBe(-0.01);
    });

    it('does NOT trigger when both ≥ 60 but no mutual export controls', () => {
      const input: DecouplingInput = {
        factionA: US,
        factionB: CHINA,
        factionATechLevel: 70,
        factionBTechLevel: 75,
        mutualExportControls: false,
        currentTurn: TURN,
      };
      const result = engine.evaluateDecoupling(input);
      expect(result.triggered).toBe(false);
      expect(result.decouplingStatus).toBe(DecouplingStatus.Unified);
      expect(result.globalGDPPenalty).toBe(0);
    });

    it('does NOT trigger when factionA = 60 but factionB = 59 with mutual controls', () => {
      const input: DecouplingInput = {
        factionA: US,
        factionB: CHINA,
        factionATechLevel: 60,
        factionBTechLevel: 59,
        mutualExportControls: true,
        currentTurn: TURN,
      };
      const result = engine.evaluateDecoupling(input);
      expect(result.triggered).toBe(false);
    });

    it('does NOT trigger when factionA = 59 but factionB = 60 with mutual controls', () => {
      const input: DecouplingInput = {
        factionA: US,
        factionB: CHINA,
        factionATechLevel: 59,
        factionBTechLevel: 60,
        mutualExportControls: true,
        currentTurn: TURN,
      };
      const result = engine.evaluateDecoupling(input);
      expect(result.triggered).toBe(false);
    });

    it('triggers at exact threshold (both = 60) with mutual controls', () => {
      const input: DecouplingInput = {
        factionA: US,
        factionB: CHINA,
        factionATechLevel: 60,
        factionBTechLevel: 60,
        mutualExportControls: true,
        currentTurn: TURN,
      };
      const result = engine.evaluateDecoupling(input);
      expect(result.triggered).toBe(true);
      expect(result.decouplingStatus).toBe(DecouplingStatus.Bifurcated);
      expect(result.globalGDPPenalty).toBe(-0.01);
    });

    it('triggers when both factions at maximum (100) with mutual controls', () => {
      const input: DecouplingInput = {
        factionA: US,
        factionB: CHINA,
        factionATechLevel: 100,
        factionBTechLevel: 100,
        mutualExportControls: true,
        currentTurn: TURN,
      };
      const result = engine.evaluateDecoupling(input);
      expect(result.triggered).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────
  // FR-1806 — evaluateBlocMembership
  // ─────────────────────────────────────────────────────────

  describe('evaluateBlocMembership', () => {
    it('returns normal cost and no bonuses when decoupling is not active', () => {
      const input: BlocMembershipInput = {
        factionId: US,
        currentAlignment: TechBlocAlignment.USLed,
        decouplingActive: false,
        currentTurn: TURN,
      };
      const result = engine.evaluateBlocMembership(input);
      expect(result.costMultiplier).toBe(1.0);
      expect(result.intraBlocIntelBonus).toBe(0);
      expect(result.crossBlocCyberBonus).toBe(0);
    });

    it('grants bonuses to USLed-aligned faction during active decoupling', () => {
      const input: BlocMembershipInput = {
        factionId: US,
        currentAlignment: TechBlocAlignment.USLed,
        decouplingActive: true,
        currentTurn: TURN,
      };
      const result = engine.evaluateBlocMembership(input);
      expect(result.costMultiplier).toBe(1.0);
      expect(result.intraBlocIntelBonus).toBe(0.1);
      expect(result.crossBlocCyberBonus).toBe(0.15);
    });

    it('grants bonuses to ChinaLed-aligned faction during active decoupling', () => {
      const input: BlocMembershipInput = {
        factionId: CHINA,
        currentAlignment: TechBlocAlignment.ChinaLed,
        decouplingActive: true,
        currentTurn: TURN,
      };
      const result = engine.evaluateBlocMembership(input);
      expect(result.costMultiplier).toBe(1.0);
      expect(result.intraBlocIntelBonus).toBe(0.1);
      expect(result.crossBlocCyberBonus).toBe(0.15);
    });

    it('applies cost premium and no bonuses to NonAligned faction during decoupling', () => {
      const input: BlocMembershipInput = {
        factionId: IRAN,
        currentAlignment: TechBlocAlignment.NonAligned,
        decouplingActive: true,
        currentTurn: TURN,
      };
      const result = engine.evaluateBlocMembership(input);
      expect(result.costMultiplier).toBe(1.5);
      expect(result.intraBlocIntelBonus).toBe(0);
      expect(result.crossBlocCyberBonus).toBe(0);
    });

    it('applies cost premium and no bonuses when alignment is null during decoupling', () => {
      const input: BlocMembershipInput = {
        factionId: IRAN,
        currentAlignment: null,
        decouplingActive: true,
        currentTurn: TURN,
      };
      const result = engine.evaluateBlocMembership(input);
      expect(result.costMultiplier).toBe(1.5);
      expect(result.intraBlocIntelBonus).toBe(0);
      expect(result.crossBlocCyberBonus).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────
  // FR-1807 — evaluateQuantumThreat
  // ─────────────────────────────────────────────────────────

  describe('evaluateQuantumThreat', () => {
    it('activates threat with full bonuses when q=70, c=60, target=30', () => {
      const input: QuantumThreatInput = {
        factionId: US,
        factionQuantumLevel: 70,
        factionCyberLevel: 60,
        targetFaction: CHINA,
        targetQuantumLevel: 30,
        currentTurn: TURN,
      };
      const result = engine.evaluateQuantumThreat(input);
      expect(result.threatActive).toBe(true);
      expect(result.hasQRE).toBe(true);
      expect(result.targetVulnerable).toBe(true);
      expect(result.targetCommsInterceptable).toBe(true);
      expect(result.intelBonusVsTarget).toBe(0.3);
      expect(result.financialWarfareBonus).toBe(0.2);
    });

    it('does NOT activate threat when quantum = 69', () => {
      const input: QuantumThreatInput = {
        factionId: US,
        factionQuantumLevel: 69,
        factionCyberLevel: 60,
        targetFaction: CHINA,
        targetQuantumLevel: 30,
        currentTurn: TURN,
      };
      const result = engine.evaluateQuantumThreat(input);
      expect(result.threatActive).toBe(false);
      expect(result.intelBonusVsTarget).toBe(0);
      expect(result.financialWarfareBonus).toBe(0);
    });

    it('activates threat but no QRE when cyber = 59', () => {
      const input: QuantumThreatInput = {
        factionId: US,
        factionQuantumLevel: 70,
        factionCyberLevel: 59,
        targetFaction: CHINA,
        targetQuantumLevel: 30,
        currentTurn: TURN,
      };
      const result = engine.evaluateQuantumThreat(input);
      expect(result.threatActive).toBe(true);
      expect(result.hasQRE).toBe(false);
      expect(result.targetVulnerable).toBe(true);
      expect(result.targetCommsInterceptable).toBe(true);
      expect(result.intelBonusVsTarget).toBe(0.3);
      expect(result.financialWarfareBonus).toBe(0.2);
    });

    it('target is NOT vulnerable and NOT interceptable when target quantum = 50', () => {
      const input: QuantumThreatInput = {
        factionId: US,
        factionQuantumLevel: 70,
        factionCyberLevel: 60,
        targetFaction: CHINA,
        targetQuantumLevel: 50,
        currentTurn: TURN,
      };
      const result = engine.evaluateQuantumThreat(input);
      expect(result.threatActive).toBe(true);
      expect(result.hasQRE).toBe(true);
      expect(result.targetVulnerable).toBe(false);
      expect(result.targetCommsInterceptable).toBe(false);
      expect(result.intelBonusVsTarget).toBe(0);
      expect(result.financialWarfareBonus).toBe(0);
    });

    it('target IS vulnerable when target quantum = 49 (just below QRE requirement)', () => {
      const input: QuantumThreatInput = {
        factionId: US,
        factionQuantumLevel: 70,
        factionCyberLevel: 60,
        targetFaction: CHINA,
        targetQuantumLevel: 49,
        currentTurn: TURN,
      };
      const result = engine.evaluateQuantumThreat(input);
      expect(result.threatActive).toBe(true);
      expect(result.hasQRE).toBe(true);
      expect(result.targetVulnerable).toBe(true);
      expect(result.targetCommsInterceptable).toBe(true);
      expect(result.intelBonusVsTarget).toBe(0.3);
      expect(result.financialWarfareBonus).toBe(0.2);
    });

    it('has QRE but NO threat when quantum = 50 (below threat threshold)', () => {
      const input: QuantumThreatInput = {
        factionId: US,
        factionQuantumLevel: 50,
        factionCyberLevel: 60,
        targetFaction: CHINA,
        targetQuantumLevel: 30,
        currentTurn: TURN,
      };
      const result = engine.evaluateQuantumThreat(input);
      expect(result.threatActive).toBe(false);
      expect(result.hasQRE).toBe(true);
      expect(result.intelBonusVsTarget).toBe(0);
      expect(result.financialWarfareBonus).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────
  // FR-1808 — evaluateDualUseDilemma
  // ─────────────────────────────────────────────────────────

  describe('evaluateDualUseDilemma', () => {
    it('is NOT triggered when both AI and Biotech are below thresholds', () => {
      const input: DualUseDilemmaInput = {
        factionId: US,
        factionAILevel: 59,
        factionBiotechLevel: 59,
        choice: DualUseChoice.Sign,
        discoveredByEspionage: false,
        currentTurn: TURN,
      };
      const result = engine.evaluateDualUseDilemma(input);
      expect(result.triggered).toBe(false);
      expect(result.legitimacyChange).toBe(0);
      expect(result.militaryApplicationsRestricted).toBe(false);
      expect(result.allTechAgreementsVoided).toBe(false);
      expect(result.coalitionSanctionsRisk).toBe(false);
    });

    it('triggers when AI ≥ 60 (Biotech = 0) and choice is Sign', () => {
      const input: DualUseDilemmaInput = {
        factionId: US,
        factionAILevel: 60,
        factionBiotechLevel: 0,
        choice: DualUseChoice.Sign,
        discoveredByEspionage: false,
        currentTurn: TURN,
      };
      const result = engine.evaluateDualUseDilemma(input);
      expect(result.triggered).toBe(true);
      expect(result.legitimacyChange).toBe(10);
      expect(result.militaryApplicationsRestricted).toBe(true);
    });

    it('triggers when Biotech ≥ 60 (AI = 0) and choice is Sign', () => {
      const input: DualUseDilemmaInput = {
        factionId: US,
        factionAILevel: 0,
        factionBiotechLevel: 60,
        choice: DualUseChoice.Sign,
        discoveredByEspionage: false,
        currentTurn: TURN,
      };
      const result = engine.evaluateDualUseDilemma(input);
      expect(result.triggered).toBe(true);
      expect(result.legitimacyChange).toBe(10);
      expect(result.militaryApplicationsRestricted).toBe(true);
    });

    it('applies legitimacy penalty when triggered and choice is Refuse', () => {
      const input: DualUseDilemmaInput = {
        factionId: US,
        factionAILevel: 80,
        factionBiotechLevel: 80,
        choice: DualUseChoice.Refuse,
        discoveredByEspionage: false,
        currentTurn: TURN,
      };
      const result = engine.evaluateDualUseDilemma(input);
      expect(result.triggered).toBe(true);
      expect(result.legitimacyChange).toBe(-5);
      expect(result.militaryApplicationsRestricted).toBe(false);
    });

    it('applies catastrophic penalties when SecretViolate is discovered', () => {
      const input: DualUseDilemmaInput = {
        factionId: US,
        factionAILevel: 80,
        factionBiotechLevel: 80,
        choice: DualUseChoice.SecretViolate,
        discoveredByEspionage: true,
        currentTurn: TURN,
      };
      const result = engine.evaluateDualUseDilemma(input);
      expect(result.triggered).toBe(true);
      expect(result.legitimacyChange).toBe(-25);
      expect(result.allTechAgreementsVoided).toBe(true);
      expect(result.coalitionSanctionsRisk).toBe(true);
    });

    it('has no immediate effect when SecretViolate is NOT discovered', () => {
      const input: DualUseDilemmaInput = {
        factionId: US,
        factionAILevel: 80,
        factionBiotechLevel: 80,
        choice: DualUseChoice.SecretViolate,
        discoveredByEspionage: false,
        currentTurn: TURN,
      };
      const result = engine.evaluateDualUseDilemma(input);
      expect(result.triggered).toBe(true);
      expect(result.legitimacyChange).toBe(0);
      expect(result.allTechAgreementsVoided).toBe(false);
      expect(result.coalitionSanctionsRisk).toBe(false);
    });

    it('triggers when both AI and Biotech are at maximum (100) with Sign', () => {
      const input: DualUseDilemmaInput = {
        factionId: US,
        factionAILevel: 100,
        factionBiotechLevel: 100,
        choice: DualUseChoice.Sign,
        discoveredByEspionage: false,
        currentTurn: TURN,
      };
      const result = engine.evaluateDualUseDilemma(input);
      expect(result.triggered).toBe(true);
    });
  });
});
