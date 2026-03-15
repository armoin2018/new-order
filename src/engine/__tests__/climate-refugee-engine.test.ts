/**
 * ClimateRefugeeEngine – Unit Tests
 *
 * Covers:
 *   FR-1903 — Climate event evaluation and probability computation
 *   FR-1904 — Refugee flow, response, and weaponized migration
 *
 * @see FR-1903
 * @see FR-1904
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ClimateRefugeeEngine } from '@/engine/climate-refugee-engine';
import { GAME_CONFIG } from '@/engine/config';
import { ClimateEventType, RefugeeResponse, RefugeeCause } from '@/data/types';
import type { FactionId, TurnNumber } from '@/data/types';

const US = 'us' as FactionId;
const CHINA = 'china' as FactionId;
const EU = 'eu' as FactionId;
const IRAN = 'iran' as FactionId;
const TURN = 5 as TurnNumber;

describe('ClimateRefugeeEngine', () => {
  let engine: ClimateRefugeeEngine;

  beforeEach(() => {
    engine = new ClimateRefugeeEngine(GAME_CONFIG.resources);
  });

  // ─────────────────────────────────────────────────────
  // 1. evaluateClimateEvent (FR-1903)
  // ─────────────────────────────────────────────────────

  describe('evaluateClimateEvent', () => {
    // --- HeatWave ---
    it('HeatWave severity 5 produces base values (scale 1.0×)', () => {
      const result = engine.evaluateClimateEvent({
        eventType: ClimateEventType.HeatWave,
        severity: 5,
        targetNation: US,
        currentTurn: TURN,
      });
      expect(result.eventType).toBe(ClimateEventType.HeatWave);
      expect(result.targetNation).toBe(US);
      expect(result.effects.foodReduction).toBeCloseTo(-0.3);
      expect(result.effects.civilUnrestIncrease).toBeCloseTo(5);
      expect(result.durationTurns).toBe(2);
      expect(result.strategicOpportunity).toBe(null);
      expect(result.reason).toContain('HeatWave');
    });

    // --- Flooding ---
    it('Flooding severity 5 produces base infrastructure and treasury effects', () => {
      const result = engine.evaluateClimateEvent({
        eventType: ClimateEventType.Flooding,
        severity: 5,
        targetNation: CHINA,
        currentTurn: TURN,
      });
      expect(result.effects.infrastructureDamage).toBeCloseTo(-0.2);
      expect(result.effects.treasuryCost).toBeCloseTo(-10);
      expect(result.durationTurns).toBe(1);
      expect(result.strategicOpportunity).toBe(null);
      expect(result.reason).toContain('Flooding');
    });

    // --- Drought ---
    it('Drought severity 5 produces base water, agri-GDP, and unrest effects', () => {
      const result = engine.evaluateClimateEvent({
        eventType: ClimateEventType.Drought,
        severity: 5,
        targetNation: EU,
        currentTurn: TURN,
      });
      expect(result.effects.waterReduction).toBeCloseTo(-20);
      expect(result.effects.agriculturalGDPReduction).toBeCloseTo(-0.15);
      expect(result.effects.civilUnrestIncrease).toBeCloseTo(10);
      expect(result.durationTurns).toBe(2);
      expect(result.reason).toContain('Drought');
    });

    // --- Typhoon ---
    it('Typhoon severity 5 sets military inoperable turns to 1 (no scaling)', () => {
      const result = engine.evaluateClimateEvent({
        eventType: ClimateEventType.Typhoon,
        severity: 5,
        targetNation: CHINA,
        currentTurn: TURN,
      });
      expect(result.effects.militaryInoperableTurns).toBe(1);
      expect(result.durationTurns).toBe(1);
      expect(result.reason).toContain('Typhoon');
    });

    // --- ArcticCollapse ---
    it('ArcticCollapse severity 5 reduces chokepoint dependency with strategic opportunity', () => {
      const result = engine.evaluateClimateEvent({
        eventType: ClimateEventType.ArcticCollapse,
        severity: 5,
        targetNation: US,
        currentTurn: TURN,
      });
      expect(result.effects.chokepointDependencyReduction).toBeCloseTo(0.25);
      expect(result.effects.infrastructureDamage).toBeCloseTo(-0.2 * 0.5);
      expect(result.durationTurns).toBe(0);
      expect(result.strategicOpportunity).not.toBe(null);
      expect(result.reason).toContain('ArcticCollapse');
      expect(result.reason).toContain('Opportunity');
    });

    // --- Wildfire ---
    it('Wildfire severity 5 halves food reduction relative to HeatWave', () => {
      const result = engine.evaluateClimateEvent({
        eventType: ClimateEventType.Wildfire,
        severity: 5,
        targetNation: IRAN,
        currentTurn: TURN,
      });
      expect(result.effects.foodReduction).toBeCloseTo(-0.3 * 0.5);
      expect(result.effects.civilUnrestIncrease).toBeCloseTo(5);
      expect(result.durationTurns).toBe(1);
      expect(result.reason).toContain('Wildfire');
    });

    // --- Earthquake ---
    it('Earthquake severity 5 applies 1.5× infrastructure and treasury multiplier', () => {
      const result = engine.evaluateClimateEvent({
        eventType: ClimateEventType.Earthquake,
        severity: 5,
        targetNation: EU,
        currentTurn: TURN,
      });
      expect(result.effects.infrastructureDamage).toBeCloseTo(-0.2 * 1.5);
      expect(result.effects.treasuryCost).toBeCloseTo(-10 * 1.5);
      expect(result.durationTurns).toBe(1);
      expect(result.reason).toContain('Earthquake');
    });

    // --- Severity scaling ---
    it('severity 10 doubles all scaled effects (scale 2.0×)', () => {
      const result = engine.evaluateClimateEvent({
        eventType: ClimateEventType.HeatWave,
        severity: 10,
        targetNation: US,
        currentTurn: TURN,
      });
      expect(result.effects.foodReduction).toBeCloseTo(-0.3 * 2);
      expect(result.effects.civilUnrestIncrease).toBeCloseTo(5 * 2);
    });

    it('severity 1 produces 0.2× effects', () => {
      const result = engine.evaluateClimateEvent({
        eventType: ClimateEventType.Drought,
        severity: 1,
        targetNation: CHINA,
        currentTurn: TURN,
      });
      expect(result.effects.waterReduction).toBeCloseTo(-20 * 0.2);
      expect(result.effects.agriculturalGDPReduction).toBeCloseTo(-0.15 * 0.2);
      expect(result.effects.civilUnrestIncrease).toBeCloseTo(10 * 0.2);
    });

    // --- Severity clamping ---
    it('severity 0 is clamped to 1 (scale 0.2×)', () => {
      const result = engine.evaluateClimateEvent({
        eventType: ClimateEventType.Flooding,
        severity: 0,
        targetNation: EU,
        currentTurn: TURN,
      });
      // clamped to 1 → scale = 1/5 = 0.2
      expect(result.effects.infrastructureDamage).toBeCloseTo(-0.2 * 0.2);
      expect(result.effects.treasuryCost).toBeCloseTo(-10 * 0.2);
    });

    it('severity 15 is clamped to 10 (scale 2.0×)', () => {
      const result = engine.evaluateClimateEvent({
        eventType: ClimateEventType.Flooding,
        severity: 15,
        targetNation: US,
        currentTurn: TURN,
      });
      // clamped to 10 → scale = 10/5 = 2.0
      expect(result.effects.infrastructureDamage).toBeCloseTo(-0.2 * 2);
      expect(result.effects.treasuryCost).toBeCloseTo(-10 * 2);
    });

    it('Typhoon military inoperable turns do not scale with severity', () => {
      const s1 = engine.evaluateClimateEvent({
        eventType: ClimateEventType.Typhoon,
        severity: 1,
        targetNation: CHINA,
        currentTurn: TURN,
      });
      const s10 = engine.evaluateClimateEvent({
        eventType: ClimateEventType.Typhoon,
        severity: 10,
        targetNation: CHINA,
        currentTurn: TURN,
      });
      expect(s1.effects.militaryInoperableTurns).toBe(1);
      expect(s10.effects.militaryInoperableTurns).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────
  // 2. computeClimateEventProbability (FR-1903)
  // ─────────────────────────────────────────────────────

  describe('computeClimateEventProbability', () => {
    it('turn 0 returns the base frequency unchanged', () => {
      const result = engine.computeClimateEventProbability({
        currentTurn: 0 as TurnNumber,
        baseFrequency: 0.05,
      });
      expect(result.probability).toBeCloseTo(0.05);
      expect(result.reason).toContain('FR-1903');
    });

    it('turn 20 doubles the base frequency', () => {
      const result = engine.computeClimateEventProbability({
        currentTurn: 20 as TurnNumber,
        baseFrequency: 0.05,
      });
      // 0.05 × (1 + 20/20) = 0.05 × 2 = 0.10
      expect(result.probability).toBeCloseTo(0.1);
    });

    it('turn 40 triples the base frequency', () => {
      const result = engine.computeClimateEventProbability({
        currentTurn: 40 as TurnNumber,
        baseFrequency: 0.05,
      });
      // 0.05 × (1 + 40/20) = 0.05 × 3 = 0.15
      expect(result.probability).toBeCloseTo(0.15);
    });

    it('clamps probability to a maximum of 0.8', () => {
      const result = engine.computeClimateEventProbability({
        currentTurn: 1000 as TurnNumber,
        baseFrequency: 0.5,
      });
      // 0.5 × (1 + 50) = 25.5 → clamped to 0.8
      expect(result.probability).toBe(0.8);
      expect(result.reason).toContain('clamped');
    });

    it('returns 0 for base frequency 0 regardless of turn', () => {
      const result = engine.computeClimateEventProbability({
        currentTurn: 100 as TurnNumber,
        baseFrequency: 0,
      });
      expect(result.probability).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────
  // 3. evaluateRefugeeFlow (FR-1904)
  // ─────────────────────────────────────────────────────

  describe('evaluateRefugeeFlow', () => {
    it('waveSize 100 produces 1.0× source effects', () => {
      const result = engine.evaluateRefugeeFlow({
        sourceNation: IRAN,
        targetNation: EU,
        cause: RefugeeCause.War,
        waveSize: 100,
        currentTurn: TURN,
      });
      expect(result.sourceEffects.laborReduction).toBeCloseTo(-0.05);
      expect(result.sourceEffects.gdpReduction).toBeCloseTo(-0.02);
      expect(result.sourceEffects.legitimacyBoost).toBeCloseTo(5);
      expect(result.reason).toContain('FR-1904');
    });

    it('waveSize 200 produces 2.0× source effects', () => {
      const result = engine.evaluateRefugeeFlow({
        sourceNation: IRAN,
        targetNation: EU,
        cause: RefugeeCause.War,
        waveSize: 200,
        currentTurn: TURN,
      });
      expect(result.sourceEffects.laborReduction).toBeCloseTo(-0.1);
      expect(result.sourceEffects.gdpReduction).toBeCloseTo(-0.04);
      expect(result.sourceEffects.legitimacyBoost).toBeCloseTo(10);
    });

    it('waveSize 0 produces zero source effects', () => {
      const result = engine.evaluateRefugeeFlow({
        sourceNation: CHINA,
        targetNation: US,
        cause: RefugeeCause.Famine,
        waveSize: 0,
        currentTurn: TURN,
      });
      expect(result.sourceEffects.laborReduction).toBeCloseTo(0);
      expect(result.sourceEffects.gdpReduction).toBeCloseTo(0);
      expect(result.sourceEffects.legitimacyBoost).toBeCloseTo(0);
    });

    it('target base effects are constant per-wave values', () => {
      const result = engine.evaluateRefugeeFlow({
        sourceNation: IRAN,
        targetNation: EU,
        cause: RefugeeCause.Climate,
        waveSize: 100,
        currentTurn: TURN,
      });
      expect(result.targetBaseEffects.civilUnrestPerWave).toBe(5);
      expect(result.targetBaseEffects.treasuryPerWave).toBe(-3);
    });

    it('target base effects remain constant regardless of wave size', () => {
      const small = engine.evaluateRefugeeFlow({
        sourceNation: IRAN,
        targetNation: EU,
        cause: RefugeeCause.War,
        waveSize: 50,
        currentTurn: TURN,
      });
      const large = engine.evaluateRefugeeFlow({
        sourceNation: IRAN,
        targetNation: EU,
        cause: RefugeeCause.War,
        waveSize: 500,
        currentTurn: TURN,
      });
      expect(small.targetBaseEffects.civilUnrestPerWave).toBe(large.targetBaseEffects.civilUnrestPerWave);
      expect(small.targetBaseEffects.treasuryPerWave).toBe(large.targetBaseEffects.treasuryPerWave);
    });

    it('cause War appears in the reason string', () => {
      const result = engine.evaluateRefugeeFlow({
        sourceNation: IRAN,
        targetNation: EU,
        cause: RefugeeCause.War,
        waveSize: 100,
        currentTurn: TURN,
      });
      expect(result.reason).toContain('war');
    });

    it('cause Famine appears in the reason string', () => {
      const result = engine.evaluateRefugeeFlow({
        sourceNation: CHINA,
        targetNation: US,
        cause: RefugeeCause.Famine,
        waveSize: 100,
        currentTurn: TURN,
      });
      expect(result.reason).toContain('famine');
    });

    it('cause Climate appears in the reason string', () => {
      const result = engine.evaluateRefugeeFlow({
        sourceNation: IRAN,
        targetNation: EU,
        cause: RefugeeCause.Climate,
        waveSize: 100,
        currentTurn: TURN,
      });
      expect(result.reason).toContain('climate');
    });

    it('cause Unrest appears in the reason string', () => {
      const result = engine.evaluateRefugeeFlow({
        sourceNation: CHINA,
        targetNation: EU,
        cause: RefugeeCause.Unrest,
        waveSize: 100,
        currentTurn: TURN,
      });
      expect(result.reason).toContain('unrest');
    });
  });

  // ─────────────────────────────────────────────────────
  // 4. evaluateRefugeeResponse (FR-1904)
  // ─────────────────────────────────────────────────────

  describe('evaluateRefugeeResponse', () => {
    it('Accept grants +5 legitimacy, +3 civil unrest, 0 border tension', () => {
      const result = engine.evaluateRefugeeResponse({
        factionId: EU,
        response: RefugeeResponse.Accept,
        currentTurn: TURN,
      });
      expect(result.response).toBe(RefugeeResponse.Accept);
      expect(result.legitimacyChange).toBe(5);
      expect(result.civilUnrestChange).toBe(3);
      expect(result.borderTensionChange).toBe(0);
      expect(result.reason).toContain('Accept');
    });

    it('Reject imposes -10 legitimacy, 0 civil unrest, +10 border tension', () => {
      const result = engine.evaluateRefugeeResponse({
        factionId: US,
        response: RefugeeResponse.Reject,
        currentTurn: TURN,
      });
      expect(result.response).toBe(RefugeeResponse.Reject);
      expect(result.legitimacyChange).toBe(-10);
      expect(result.civilUnrestChange).toBe(0);
      expect(result.borderTensionChange).toBe(10);
      expect(result.reason).toContain('Reject');
    });

    it('Weaponized returns all zeros (handled separately)', () => {
      const result = engine.evaluateRefugeeResponse({
        factionId: IRAN,
        response: RefugeeResponse.Weaponized,
        currentTurn: TURN,
      });
      expect(result.response).toBe(RefugeeResponse.Weaponized);
      expect(result.legitimacyChange).toBe(0);
      expect(result.civilUnrestChange).toBe(0);
      expect(result.borderTensionChange).toBe(0);
      expect(result.reason).toContain('Weaponized');
    });
  });

  // ─────────────────────────────────────────────────────
  // 5. evaluateWeaponizedMigration (FR-1904)
  // ─────────────────────────────────────────────────────

  describe('evaluateWeaponizedMigration', () => {
    it('eligible when pragmatism > 70 (high pragmatism)', () => {
      const result = engine.evaluateWeaponizedMigration({
        factionId: IRAN,
        leaderPragmatism: 80,
        factionStability: 50,
        currentTurn: TURN,
      });
      expect(result.eligible).toBe(true);
      expect(result.reason).toContain('pragmatism');
    });

    it('eligible when stability < 25 (low stability)', () => {
      const result = engine.evaluateWeaponizedMigration({
        factionId: IRAN,
        leaderPragmatism: 40,
        factionStability: 15,
        currentTurn: TURN,
      });
      expect(result.eligible).toBe(true);
      expect(result.reason).toContain('stability');
    });

    it('eligible when both conditions are met', () => {
      const result = engine.evaluateWeaponizedMigration({
        factionId: CHINA,
        leaderPragmatism: 80,
        factionStability: 15,
        currentTurn: TURN,
      });
      expect(result.eligible).toBe(true);
      expect(result.reason).toContain('pragmatism');
      expect(result.reason).toContain('stability');
    });

    it('NOT eligible when pragmatism=70 and stability=25 (boundary)', () => {
      const result = engine.evaluateWeaponizedMigration({
        factionId: US,
        leaderPragmatism: 70,
        factionStability: 25,
        currentTurn: TURN,
      });
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('Not eligible');
    });

    it('eligible when pragmatism=71 (just above threshold)', () => {
      const result = engine.evaluateWeaponizedMigration({
        factionId: EU,
        leaderPragmatism: 71,
        factionStability: 25,
        currentTurn: TURN,
      });
      expect(result.eligible).toBe(true);
    });

    it('eligible when stability=24 (just below threshold)', () => {
      const result = engine.evaluateWeaponizedMigration({
        factionId: EU,
        leaderPragmatism: 70,
        factionStability: 24,
        currentTurn: TURN,
      });
      expect(result.eligible).toBe(true);
    });

    it('NOT eligible when pragmatism=50 and stability=50', () => {
      const result = engine.evaluateWeaponizedMigration({
        factionId: US,
        leaderPragmatism: 50,
        factionStability: 50,
        currentTurn: TURN,
      });
      expect(result.eligible).toBe(false);
      expect(result.reason).toContain('Not eligible');
    });
  });
});
