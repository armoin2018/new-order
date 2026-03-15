/**
 * New Order — Military Configuration
 *
 * @see NFR-204 — All game formulas configurable via constants
 */


  // ─────────────────────────────────────────────────────────
  // 3. NUCLEAR ESCALATION
  // ─────────────────────────────────────────────────────────

export const nuclearConfig = {
  /** Escalation band boundaries. @see FR-501 */
  escalationBands: {
    /** Deterrence band upper bound: 0-30. @see FR-501 */
    deterrenceMax: 30,
    /** Tactical Readiness band lower bound: 31-70. @see FR-501 */
    tacticalReadinessMin: 31,
    /** Tactical Readiness band upper bound. @see FR-501 */
    tacticalReadinessMax: 70,
    /** Threshold Breach band lower bound: 71-100. @see FR-501 */
    thresholdBreachMin: 71,
    /** Threshold Breach band upper bound. @see FR-501 */
    thresholdBreachMax: 100,
  },

  /** Per-turn threshold modifiers for each band. @see FR-501 */
  bandModifiers: {
    /** Deterrence (0–30): passive drift per turn towards stability. */
    deterrence: {
      /** Passive threshold decay per turn (negative = cooling). @see FR-502 */
      passiveDecayPerTurn: -1,
      /** Maximum threshold increase from signal tests. @see FR-502 */
      maxSignalTestIncrease: 5,
    },
    /** Tactical Readiness (31–70): escalation-prone zone. @see FR-503 */
    tacticalReadiness: {
      /** Threshold increase when existential threat detected. @see FR-503 */
      existentialThreatIncrease: 10,
      /** Threshold increase for mobile launcher repositioning. @see FR-503 */
      mobileLauncherIncrease: 5,
      /** Passive drift per turn (slight increase from arms race). */
      passiveDriftPerTurn: 1,
    },
    /** Threshold Breach (71–100): active danger zone. @see FR-504 */
    thresholdBreach: {
      /** Passive drift per turn (strong increase from crisis momentum). */
      passiveDriftPerTurn: 2,
      /** Threshold reduction from successful diplomacy. */
      diplomacyReductionMax: 15,
    },
  },

  /** Demonstration strike parameters. @see FR-504 */
  demonstrationStrike: {
    /** Stability below this triggers AI consideration of demonstration strike. @see FR-504 */
    stabilityThreshold: 15,
    /** Capital threatened — threshold boost. @see FR-504 */
    capitalThreatThresholdBoost: 20,
    /** Diplomatic Influence penalty for the striking nation. @see FR-504 */
    diPenalty: -30,
    /** Global tension increase to all rivals. @see FR-504 */
    globalTensionIncrease: 25,
    /** Target stability penalty. @see FR-504 */
    targetStabilityPenalty: -15,
    /** Threshold increase for the striking nation. @see FR-504 */
    thresholdIncrease: 15,
  },

  /** Second-strike automated response. @see FR-505 */
  secondStrike: {
    /** Probability of counter-strike (0.0–1.0). @see FR-505 */
    counterStrikeProbability: 0.9,
    /** Factions with second-strike capability. @see FR-505 */
    capableFactions: ['us', 'china', 'russia'] as readonly string[],
    /** Stability collapse for both attacker and target after exchange. @see FR-505 */
    exchangeStabilityCollapse: -50,
    /** Nuclear threshold set to max for both parties after exchange. */
    exchangeThresholdMax: 100,
  },

  /** Red Telephone de-escalation. @see FR-507 */
  redTelephone: {
    /** Diplomatic Influence cost to initiate. @see FR-507 */
    diCost: 10,
    /** Threshold reduction for both nations. @see FR-507 */
    thresholdReduction: 15,
    /** Minimum trust required between leaders (from ChemistryTrustEngine). */
    minimumTrust: 20,
    /** Cost discount at high trust (>60). @see FR-1509 */
    highTrustDiscount: 0.5,
    /** Cooldown turns before reuse between same pair. */
    cooldownTurns: 3,
  },

  /** Iran-specific nuclear mechanics. @see FR-506 */
  iran: {
    /** Iran uses decentralized command post-March 1. @see FR-506 */
    decentralizedCommand: true,
    /** Dirty bomb stability penalty to Israel. @see FR-506 */
    dirtyBombIsraelStabilityPenalty: -25,
    /** Dirty bomb global DI penalty to Iran. @see FR-506 */
    dirtyBombIranDiPenalty: -40,
    /** Dirty bomb triggers immediate US strategic retaliation. @see FR-506 */
    dirtyBombTriggersUSRetaliation: true,
    /** US retaliation stability penalty to Iran. @see FR-506 */
    usRetaliationIranStabilityPenalty: -30,
    /** US retaliation military readiness penalty to Iran. @see FR-506 */
    usRetaliationIranMilitaryPenalty: -40,
    /** Threshold increase for Iran after dirty bomb. */
    dirtyBombThresholdIncrease: 30,
    /** Global tension increase from dirty bomb. */
    dirtyBombGlobalTensionIncrease: 30,
  },

  /** Demonstration strike trigger: stability below this value. @see FR-505 */
  demonstrationStrikeStabilityThreshold: 15,

  /** Diplomatic Influence cost for Red Telephone de-escalation. @see FR-507 */
  redTelephoneDICost: 10,
} as const;


  // ─────────────────────────────────────────────────────────
  // 5. COMBAT
  // ─────────────────────────────────────────────────────────

export const combatConfig = {
  /** Terrain modifier table. @see FR-804 */
  terrainModifiers: {
    /** Mountain terrain. @see FR-804 */
    mountain: {
      /** Defense bonus in mountains. @see FR-804 */
      defenseBonus: 0.3,
    },
    /** Urban terrain. @see FR-804 */
    urban: {
      /** Defense bonus in urban terrain. @see FR-804 */
      defenseBonus: 0.2,
      /** Urban combat causes civilian casualties. @see FR-804 */
      causesCivilianCasualties: true,
    },
    /** Desert terrain. @see FR-804 */
    desert: {
      /** Attacker logistics penalty in desert. @see FR-804 */
      attackerLogisticsPenalty: -0.1,
    },
    /** Island terrain. @see FR-804 */
    island: {
      /** Attacking an island requires naval supremacy. @see FR-804 */
      requiresNavalSupremacy: true,
    },
    /** Forest terrain. @see FR-804 */
    forest: {
      /** Defense bonus in forests. @see FR-804 */
      defenseBonus: 0.15,
    },
    /** Plains terrain. @see FR-804 */
    plains: {
      /** Attack bonus on plains. @see FR-804 */
      attackBonus: 0.1,
    },
    /** Coastal terrain. @see FR-804 */
    coastal: {
      /** Naval bombardment bonus at coast. @see FR-804 */
      navalBombardmentBonus: 0.15,
    },
    /** Arctic terrain. @see FR-804 */
    arctic: {
      /** Attacker logistics penalty in arctic. @see FR-804 */
      attackerLogisticsPenalty: -0.15,
      /** Attrition rate per turn in arctic. @see FR-804 */
      attritionPerTurn: -0.05,
    },
  },

  /** Readiness decay rates. @see FR-1004 */
  readinessDecay: {
    /** Readiness decay per turn during active operations. @see FR-1004 */
    activeOperationsDecayPerTurn: -2,
    /** Readiness decay per turn when treasury is low. @see FR-1004 */
    lowTreasuryDecayPerTurn: -1,
  },

  /** Low readiness combat penalty. @see FR-1004 */
  lowReadiness: {
    /** Readiness below this threshold incurs combat penalties. @see FR-1004 */
    threshold: 30,
    /** Combat effectiveness penalty when below readiness threshold. @see FR-1004 */
    combatEffectivenessPenalty: -0.25,
  },

  /** Supply line combat modifier. @see FR-1105 */
  supplyLine: {
    /** Bonus when supply lines are intact. @see FR-1105 */
    intactBonus: 0.1,
    /** Penalty when supply lines are severed. @see FR-1105 */
    severedPenalty: -0.2,
  },

  /** Morale combat modifier. @see FR-1105 */
  morale: {
    /** Morale threshold below which penalty applies. @see FR-1105 */
    lowThreshold: 30,
    /** Combat penalty from low morale. @see FR-1105 */
    lowMoralePenalty: -0.15,
    /** Morale threshold above which bonus applies. @see FR-1105 */
    highThreshold: 70,
    /** Combat bonus from high morale. @see FR-1105 */
    highMoraleBonus: 0.1,
  },

  /** Tech level differential combat modifier. @see FR-1105 */
  techDifferential: {
    /** Combat bonus per tech-level advantage. @see FR-1105 */
    bonusPerLevel: 0.05,
    /** Maximum tech-level combat modifier. @see FR-1105 */
    maxBonus: 0.25,
  },
} as const;


  // ─────────────────────────────────────────────────────────
  // 15. MILITARY CAPABILITIES
  // ─────────────────────────────────────────────────────────

export const militaryConfig = {
  /** Readiness decay rates. @see FR-1004 */
  readinessDecay: {
    /** Readiness loss per turn during active combat. @see FR-1004 */
    activeCombatPerTurn: -2,
    /** Readiness loss per turn when treasury is low. @see FR-1004 */
    lowTreasuryPerTurn: -1,
  },

  /** Low readiness penalty. @see FR-1004 */
  lowReadinessPenalty: {
    /** Readiness threshold for combat penalty. @see FR-1004 */
    threshold: 30,
    /** Combat effectiveness penalty below threshold. @see FR-1004 */
    penalty: -0.25,
  },

  /** Force projection configuration. @see FR-1002 */
  forceProjection: {
    /** Nations with ForceProjection below this are limited to border-adjacent hexes. @see FR-1002 */
    borderOnlyThreshold: 30,
    /** Default hex range = floor(ForceProjection / this divisor). @see FR-1002 */
    hexRangeDivisor: 10,
    /** Additional hex range per overseas base. @see FR-1002 */
    overseasBaseBonus: 2,
    /** Additional hex range per deployed carrier group. @see FR-1002 */
    carrierDeploymentBonus: 3,
    /** Minimum projection range (always at least border-adjacent). @see FR-1002 */
    minRange: 1,
    /** Maximum projection range cap. @see FR-1002 */
    maxRange: 15,
  },

  /** National military doctrine passive bonuses. @see FR-1003 */
  doctrines: {
    /** China A2/AD: defense bonus within first island chain. @see FR-1003 */
    a2ad: {
      factionId: 'China' as const,
      label: 'A2/AD',
      defenseBonus: 0.3,
      qualifier: 'islandChain',
      description: 'Anti-Access/Area Denial: +30% defense within first island chain.',
    },
    /** Iran Asymmetric Swarm: bonus vs naval in littoral hexes. @see FR-1003 */
    asymmetricSwarm: {
      factionId: 'Iran' as const,
      label: 'Asymmetric Swarm',
      antiNavalBonus: 0.2,
      qualifier: 'littoralHex',
      description: 'Asymmetric Swarm: +20% vs naval units in littoral hexes.',
    },
    /** DPRK Fortress Korea: defense on home territory. @see FR-1003 */
    fortressKorea: {
      factionId: 'DPRK' as const,
      label: 'Fortress Korea',
      defenseBonus: 0.4,
      qualifier: 'homeTerritory',
      description: 'Fortress Korea: +40% defense on home territory.',
    },
    /** US Global Reach: extended force projection and coalition bonus. @see FR-1003 */
    globalReach: {
      factionId: 'US' as const,
      label: 'Global Reach',
      projectionBonus: 3,
      coalitionAttackBonus: 0.1,
      description: 'Global Reach: +3 hex range, +10% attack with allied units.',
    },
    /** Russia Escalation Dominance: nuclear threshold pressure. @see FR-1003 */
    escalationDominance: {
      factionId: 'Russia' as const,
      label: 'Escalation Dominance',
      nuclearThresholdPressure: 5,
      defenseBonus: 0.15,
      qualifier: 'homeTerritory',
      description: 'Escalation Dominance: +5 nuclear threshold pressure, +15% home defense.',
    },
    /** EU Collective Defense: bonus when defending allied territory. @see FR-1003 */
    collectiveDefense: {
      factionId: 'EU' as const,
      label: 'Collective Defense',
      alliedDefenseBonus: 0.2,
      readinessDecayReduction: 0.5,
      description: 'Collective Defense: +20% when defending allied territory, 50% slower readiness decay.',
    },
    /** Japan Maritime Shield: naval defense bonus. @see FR-1003 */
    maritimeShield: {
      factionId: 'Japan' as const,
      label: 'Maritime Shield',
      navalDefenseBonus: 0.25,
      qualifier: 'coastalHex',
      description: 'Maritime Shield: +25% naval defense in coastal hexes.',
    },
    /** India Strategic Patience: attrition advantage. @see FR-1003 */
    strategicPatience: {
      factionId: 'India' as const,
      label: 'Strategic Patience',
      attritionReduction: 0.2,
      prolongedCombatBonus: 0.1,
      prolongedCombatTurnThreshold: 3,
      description: 'Strategic Patience: 20% less attrition, +10% combat bonus after 3 turns.',
    },
  },

  /** Special capability actions per nation. @see FR-1005 */
  specialCapabilities: {
    /** Iran Drone Swarm: area denial, low cost, high attrition. @see FR-1005 */
    droneSwarm: {
      factionId: 'Iran' as const,
      label: 'Drone Swarm',
      areaDenialRadius: 2,
      attritionPerTurn: 0.08,
      treasuryCost: 5,
      readinessCost: 3,
      duration: 3,
      description: 'Area denial via low-cost drone swarm; targets suffer 8% attrition per turn.',
    },
    /** DPRK Artillery Barrage Seoul. @see FR-1005 */
    artilleryBarragSeoul: {
      factionId: 'DPRK' as const,
      label: 'Artillery Barrage Seoul',
      targetFaction: 'SouthKorea' as const,
      stabilityDamage: -20,
      civilianCasualties: true,
      requiresDeclarationOfWar: false,
      treasuryCost: 8,
      readinessCost: 5,
      tensionIncrease: 25,
      description: 'Instant stability damage to South Korea without declaration of war.',
    },
    /** China Carrier Killer Salvo (DF-21D). @see FR-1005 */
    carrierKillerSalvo: {
      factionId: 'China' as const,
      label: 'Carrier Killer Salvo',
      bypassesSurfaceEscorts: true,
      navalDamageMultiplier: 2.0,
      range: 8,
      treasuryCost: 12,
      readinessCost: 4,
      cooldownTurns: 3,
      description: 'DF-21D targeting: bypasses surface escorts, 2× naval damage.',
    },
  },

  /** Military modernization investment. @see FR-1006 */
  modernization: {
    /** Treasury investment per turn to advance TechLevel. @see FR-1006 */
    investmentPerTurn: 15,
    /** TechLevel points gained per successful investment. @see FR-1006 */
    techLevelGainPerInvestment: 2,
    /** TechLevel milestones that unlock capabilities. @see FR-1006 */
    milestones: [
      { threshold: 40, unlock: 'advancedMissiles', description: 'Advanced precision munitions' },
      { threshold: 55, unlock: 'stealthAircraft', description: 'Stealth fighter/bomber operations' },
      { threshold: 70, unlock: 'cyberWarfare', description: 'Offensive cyber operations' },
      { threshold: 85, unlock: 'hypersonicWeapons', description: 'Hypersonic strike capability' },
      { threshold: 95, unlock: 'aiAutonomous', description: 'AI-directed autonomous weapons' },
    ] as const,
  },

  /** Japan latent nuclear capability. @see FR-1007 */
  japanLatentNuclear: {
    /** R&D turns required to acquire nuclear weapons. @see FR-1007 */
    rdTurns: 6,
    /** Stability penalty from nuclear development. @see FR-1007 */
    stabilityPenalty: -25,
    /** Diplomatic Influence penalty from nuclear development. @see FR-1007 */
    diPenalty: -30,
    /** Nuclear threshold increase in China from Japan's nuclearization. @see FR-1007 */
    chinaNuclearThresholdIncrease: 15,
    /** Nuclear threshold increase in DPRK from Japan's nuclearization. @see FR-1007 */
    dprkNuclearThresholdIncrease: 20,
    /** Minimum stability to pass constitutional amendment. @see FR-1007 */
    amendmentStabilityThreshold: 40,
  },

  /** Foreign propaganda effectiveness. @see FR-1007 */
  foreignPropaganda: {
    /** Propaganda effect: COVERT * this multiplier per turn. @see FR-1007 */
    covertMultiplierPerTurn: 0.1,
  },
} as const;

