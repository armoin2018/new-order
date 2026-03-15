import { describe, it, expect } from 'vitest';
import {
  SpecialCapabilitiesEngine,
  type CapabilityExecutionInput,
  type ModernizationInput,
} from '@/engine/special-capabilities';
import { FactionId, SpecialCapabilityType } from '@/data/types';
import type { TurnNumber } from '@/data/types';

const SCT = SpecialCapabilityType;
const FID = FactionId;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeExecInput(
  overrides?: Partial<CapabilityExecutionInput>,
): CapabilityExecutionInput {
  return {
    capabilityType: SCT.DroneSwarm,
    executingFaction: FID.Iran,
    currentTreasury: 100,
    currentReadiness: 80,
    currentTurn: 5 as TurnNumber,
    lastUsedTurn: null,
    ...overrides,
  };
}

function makeModInput(
  overrides?: Partial<ModernizationInput>,
): ModernizationInput {
  return {
    factionId: FID.US,
    currentTechLevel: 50,
    currentTreasury: 100,
    currentTurn: 5 as TurnNumber,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('SpecialCapabilitiesEngine', () => {
  const engine = new SpecialCapabilitiesEngine();

  // -----------------------------------------------------------------------
  // getCapabilityConfig
  // -----------------------------------------------------------------------
  describe('getCapabilityConfig', () => {
    it('returns DroneSwarm config with treasuryCost 5', () => {
      const cfg = engine.getCapabilityConfig(SCT.DroneSwarm);
      expect(cfg.treasuryCost).toBe(5);
    });

    it('returns ArtilleryBarrageSeoul config with stabilityDamage -20', () => {
      const cfg = engine.getCapabilityConfig(SCT.ArtilleryBarrageSeoul);
      expect((cfg as { stabilityDamage: number }).stabilityDamage).toBe(-20);
    });

    it('returns CarrierKillerSalvo config with navalDamageMultiplier 2.0', () => {
      const cfg = engine.getCapabilityConfig(SCT.CarrierKillerSalvo);
      expect((cfg as { navalDamageMultiplier: number }).navalDamageMultiplier).toBe(2.0);
    });
  });

  // -----------------------------------------------------------------------
  // getAvailableCapabilities
  // -----------------------------------------------------------------------
  describe('getAvailableCapabilities', () => {
    it('returns DroneSwarm for Iran', () => {
      const caps = engine.getAvailableCapabilities(FID.Iran);
      expect(caps).toEqual([SCT.DroneSwarm]);
    });

    it('returns ArtilleryBarrageSeoul for DPRK', () => {
      const caps = engine.getAvailableCapabilities(FID.DPRK);
      expect(caps).toEqual([SCT.ArtilleryBarrageSeoul]);
    });

    it('returns CarrierKillerSalvo for China', () => {
      const caps = engine.getAvailableCapabilities(FID.China);
      expect(caps).toEqual([SCT.CarrierKillerSalvo]);
    });

    it('returns empty array for US', () => {
      expect(engine.getAvailableCapabilities(FID.US)).toEqual([]);
    });

    it('returns empty array for Japan', () => {
      expect(engine.getAvailableCapabilities(FID.Japan)).toEqual([]);
    });

    it('returns empty array for EU', () => {
      expect(engine.getAvailableCapabilities(FID.EU)).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // validateExecution
  // -----------------------------------------------------------------------
  describe('validateExecution', () => {
    it('validates DroneSwarm for Iran with sufficient resources', () => {
      const result = engine.validateExecution(makeExecInput());
      expect(result.valid).toBe(true);
    });

    it('rejects wrong faction (US attempting DroneSwarm)', () => {
      const result = engine.validateExecution(
        makeExecInput({ executingFaction: FID.US }),
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('does not have access');
    });

    it('rejects insufficient treasury for DroneSwarm (need 5)', () => {
      const result = engine.validateExecution(
        makeExecInput({ currentTreasury: 4 }),
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('treasury');
    });

    it('rejects insufficient readiness for DroneSwarm (need 3)', () => {
      const result = engine.validateExecution(
        makeExecInput({ currentReadiness: 2 }),
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('readiness');
    });

    it('validates ArtilleryBarrageSeoul for DPRK', () => {
      const result = engine.validateExecution(
        makeExecInput({
          capabilityType: SCT.ArtilleryBarrageSeoul,
          executingFaction: FID.DPRK,
        }),
      );
      expect(result.valid).toBe(true);
    });

    it('rejects CarrierKillerSalvo on cooldown', () => {
      const result = engine.validateExecution(
        makeExecInput({
          capabilityType: SCT.CarrierKillerSalvo,
          executingFaction: FID.China,
          currentTurn: 5 as TurnNumber,
          lastUsedTurn: 3 as TurnNumber, // diff = 2 < 3
        }),
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('cooldown');
    });

    it('validates CarrierKillerSalvo off cooldown', () => {
      const result = engine.validateExecution(
        makeExecInput({
          capabilityType: SCT.CarrierKillerSalvo,
          executingFaction: FID.China,
          currentTurn: 6 as TurnNumber,
          lastUsedTurn: 3 as TurnNumber, // diff = 3 >= 3
        }),
      );
      expect(result.valid).toBe(true);
    });

    it('validates CarrierKillerSalvo never used', () => {
      const result = engine.validateExecution(
        makeExecInput({
          capabilityType: SCT.CarrierKillerSalvo,
          executingFaction: FID.China,
          lastUsedTurn: null,
        }),
      );
      expect(result.valid).toBe(true);
    });

    it('rejects insufficient treasury for ArtilleryBarrageSeoul (need 8)', () => {
      const result = engine.validateExecution(
        makeExecInput({
          capabilityType: SCT.ArtilleryBarrageSeoul,
          executingFaction: FID.DPRK,
          currentTreasury: 7,
        }),
      );
      expect(result.valid).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // executeCapability
  // -----------------------------------------------------------------------
  describe('executeCapability', () => {
    it('returns failure with zero costs when invalid', () => {
      const result = engine.executeCapability(
        makeExecInput({ executingFaction: FID.US }),
      );
      expect(result.success).toBe(false);
      expect(result.treasuryCost).toBe(0);
      expect(result.readinessCost).toBe(0);
    });

    it('executes DroneSwarm with correct effects', () => {
      const result = engine.executeCapability(makeExecInput());
      expect(result.success).toBe(true);
      expect(result.effects.attritionPerTurn).toBeCloseTo(0.08, 5);
      expect(result.effects.areaDenialRadius).toBe(2);
      expect(result.effects.duration).toBe(3);
    });

    it('executes DroneSwarm with correct costs', () => {
      const result = engine.executeCapability(makeExecInput());
      expect(result.treasuryCost).toBe(5);
      expect(result.readinessCost).toBe(3);
    });

    it('executes ArtilleryBarrageSeoul with correct effects', () => {
      const result = engine.executeCapability(
        makeExecInput({
          capabilityType: SCT.ArtilleryBarrageSeoul,
          executingFaction: FID.DPRK,
        }),
      );
      expect(result.success).toBe(true);
      expect(result.effects.stabilityDamage).toBe(-20);
      expect(result.effects.tensionIncrease).toBe(25);
      expect(result.effects.civilianCasualties).toBe(true);
    });

    it('executes ArtilleryBarrageSeoul with correct costs', () => {
      const result = engine.executeCapability(
        makeExecInput({
          capabilityType: SCT.ArtilleryBarrageSeoul,
          executingFaction: FID.DPRK,
        }),
      );
      expect(result.treasuryCost).toBe(8);
      expect(result.readinessCost).toBe(5);
    });

    it('executes ArtilleryBarrageSeoul with target faction', () => {
      const result = engine.executeCapability(
        makeExecInput({
          capabilityType: SCT.ArtilleryBarrageSeoul,
          executingFaction: FID.DPRK,
        }),
      );
      expect(result.effects.targetFaction).not.toBeNull();
    });

    it('executes CarrierKillerSalvo with correct effects', () => {
      const result = engine.executeCapability(
        makeExecInput({
          capabilityType: SCT.CarrierKillerSalvo,
          executingFaction: FID.China,
        }),
      );
      expect(result.success).toBe(true);
      expect(result.effects.navalDamageMultiplier).toBe(2.0);
      expect(result.effects.bypassesSurfaceEscorts).toBe(true);
    });

    it('executes CarrierKillerSalvo with correct costs', () => {
      const result = engine.executeCapability(
        makeExecInput({
          capabilityType: SCT.CarrierKillerSalvo,
          executingFaction: FID.China,
        }),
      );
      expect(result.treasuryCost).toBe(12);
      expect(result.readinessCost).toBe(4);
    });

    it('successful execution has non-empty reason', () => {
      const result = engine.executeCapability(makeExecInput());
      expect(result.reason.length).toBeGreaterThan(0);
    });

    it('failure produces neutral effect values', () => {
      const result = engine.executeCapability(
        makeExecInput({ executingFaction: FID.US }),
      );
      expect(result.effects.stabilityDamage).toBe(0);
      expect(result.effects.tensionIncrease).toBe(0);
      expect(result.effects.attritionPerTurn).toBe(0);
      expect(result.effects.navalDamageMultiplier).toBe(1);
      expect(result.effects.bypassesSurfaceEscorts).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // isCooldownActive
  // -----------------------------------------------------------------------
  describe('isCooldownActive', () => {
    it('DroneSwarm is never on cooldown', () => {
      expect(
        engine.isCooldownActive(SCT.DroneSwarm, 3 as TurnNumber, 4 as TurnNumber),
      ).toBe(false);
    });

    it('ArtilleryBarrageSeoul is never on cooldown', () => {
      expect(
        engine.isCooldownActive(SCT.ArtilleryBarrageSeoul, 3 as TurnNumber, 4 as TurnNumber),
      ).toBe(false);
    });

    it('CarrierKillerSalvo with null lastUsed is not on cooldown', () => {
      expect(
        engine.isCooldownActive(SCT.CarrierKillerSalvo, null, 5 as TurnNumber),
      ).toBe(false);
    });

    it('CarrierKillerSalvo used 1 turn ago is on cooldown', () => {
      expect(
        engine.isCooldownActive(SCT.CarrierKillerSalvo, 4 as TurnNumber, 5 as TurnNumber),
      ).toBe(true);
    });

    it('CarrierKillerSalvo used 2 turns ago is on cooldown', () => {
      expect(
        engine.isCooldownActive(SCT.CarrierKillerSalvo, 3 as TurnNumber, 5 as TurnNumber),
      ).toBe(true);
    });

    it('CarrierKillerSalvo used 3 turns ago is off cooldown', () => {
      expect(
        engine.isCooldownActive(SCT.CarrierKillerSalvo, 2 as TurnNumber, 5 as TurnNumber),
      ).toBe(false);
    });

    it('CarrierKillerSalvo used many turns ago is off cooldown', () => {
      expect(
        engine.isCooldownActive(SCT.CarrierKillerSalvo, 1 as TurnNumber, 10 as TurnNumber),
      ).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // computeModernization
  // -----------------------------------------------------------------------
  describe('computeModernization', () => {
    it('invests when treasury is sufficient', () => {
      const result = engine.computeModernization(makeModInput());
      expect(result.invested).toBe(true);
      expect(result.treasuryCost).toBe(15);
      expect(result.techLevelGain).toBe(2);
    });

    it('does not invest when treasury is insufficient', () => {
      const result = engine.computeModernization(
        makeModInput({ currentTreasury: 14 }),
      );
      expect(result.invested).toBe(false);
      expect(result.treasuryCost).toBe(0);
      expect(result.techLevelGain).toBe(0);
    });

    it('advances tech level from 50 to 52', () => {
      const result = engine.computeModernization(makeModInput());
      expect(result.previousTechLevel).toBe(50);
      expect(result.newTechLevel).toBe(52);
    });

    it('unlocks advancedMissiles when crossing threshold 40', () => {
      const result = engine.computeModernization(
        makeModInput({ currentTechLevel: 39 }),
      );
      expect(result.newTechLevel).toBe(41);
      expect(result.milestonesUnlocked).toHaveLength(1);
      expect(result.milestonesUnlocked[0]!.unlock).toBe('advancedMissiles');
    });

    it('does not unlock milestones when not crossing any threshold', () => {
      const result = engine.computeModernization(
        makeModInput({ currentTechLevel: 41 }),
      );
      expect(result.newTechLevel).toBe(43);
      expect(result.milestonesUnlocked).toHaveLength(0);
    });

    it('unlocks stealthAircraft when crossing threshold 55', () => {
      const result = engine.computeModernization(
        makeModInput({ currentTechLevel: 54 }),
      );
      expect(result.newTechLevel).toBe(56);
      expect(result.milestonesUnlocked).toHaveLength(1);
      expect(result.milestonesUnlocked[0]!.unlock).toBe('stealthAircraft');
    });

    it('clamps tech level to 100', () => {
      const result = engine.computeModernization(
        makeModInput({ currentTechLevel: 99 }),
      );
      expect(result.newTechLevel).toBe(100);
      expect(result.techLevelGain).toBe(1);
    });

    it('returns correct factionId', () => {
      const result = engine.computeModernization(
        makeModInput({ factionId: FID.China }),
      );
      expect(result.factionId).toBe(FID.China);
    });

    it('reason mentions tech level change on success', () => {
      const result = engine.computeModernization(makeModInput());
      expect(result.reason).toContain('50');
      expect(result.reason).toContain('52');
    });
  });

  // -----------------------------------------------------------------------
  // getUnlockedMilestones
  // -----------------------------------------------------------------------
  describe('getUnlockedMilestones', () => {
    it('returns empty at tech level 0', () => {
      expect(engine.getUnlockedMilestones(0)).toHaveLength(0);
    });

    it('returns advancedMissiles at tech level 40', () => {
      const milestones = engine.getUnlockedMilestones(40);
      expect(milestones).toHaveLength(1);
      expect(milestones[0]!.unlock).toBe('advancedMissiles');
    });

    it('returns 3 milestones at tech level 70', () => {
      const milestones = engine.getUnlockedMilestones(70);
      expect(milestones).toHaveLength(3);
      const unlocks = milestones.map((m) => m.unlock);
      expect(unlocks).toContain('advancedMissiles');
      expect(unlocks).toContain('stealthAircraft');
      expect(unlocks).toContain('cyberWarfare');
    });

    it('returns all 5 milestones at tech level 100', () => {
      expect(engine.getUnlockedMilestones(100)).toHaveLength(5);
    });

    it('returns empty at tech level 39 (below first threshold)', () => {
      expect(engine.getUnlockedMilestones(39)).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // getNextMilestone
  // -----------------------------------------------------------------------
  describe('getNextMilestone', () => {
    it('returns advancedMissiles at tech level 0', () => {
      const next = engine.getNextMilestone(0);
      expect(next).not.toBeNull();
      expect(next!.threshold).toBe(40);
      expect(next!.unlock).toBe('advancedMissiles');
    });

    it('returns stealthAircraft at tech level 40', () => {
      const next = engine.getNextMilestone(40);
      expect(next).not.toBeNull();
      expect(next!.threshold).toBe(55);
    });

    it('returns hypersonicWeapons at tech level 84', () => {
      const next = engine.getNextMilestone(84);
      expect(next).not.toBeNull();
      expect(next!.threshold).toBe(85);
      expect(next!.unlock).toBe('hypersonicWeapons');
    });

    it('returns null when all milestones unlocked', () => {
      expect(engine.getNextMilestone(95)).toBeNull();
    });

    it('returns null at tech level 100', () => {
      expect(engine.getNextMilestone(100)).toBeNull();
    });
  });
});
