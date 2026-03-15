/**
 * Future Innovations & Discovery System Configuration — FR-5100
 *
 * Tier multipliers, research parameters, discovery probabilities,
 * multi-order impact settings, category metadata, and web-gathering
 * tunables for the innovation engine.
 *
 * All innovation formulas are tunable here without code changes.
 *
 * @see NFR-204 — All game formulas shall be configurable via constants.
 * @see FR-5100 — Future Innovations & Discovery System
 * @see DR-212  — Innovation model shape
 */

import type { InnovationCategory } from '@/data/types/innovation.types';

export const innovationConfig = {
  /**
   * Tier scaling — cost and duration multipliers indexed by tier (0-based).
   * Tier 1 = index 0, Tier 5 = index 4.
   * @see FR-5100
   */
  tiers: {
    /** Maximum innovation tier. */
    maxTier: 5,
    /** Cost multiplier applied per tier level. */
    tierCostMultipliers: [1, 2.5, 5, 10, 25] as readonly number[],
    /** Duration multiplier applied per tier level. */
    tierDurationMultipliers: [1, 2, 4, 8, 16] as readonly number[],
  },

  /**
   * Base research parameters.
   * @see FR-5100
   */
  research: {
    /** Base cost in resource points (before tier multiplier). */
    baseCost: 100,
    /** Base duration in turns at full funding (before tier multiplier). */
    baseDuration: 4,
    /** Progress percentage gained per funded turn. */
    progressPerTurnFunded: 10,
    /** Progress decay rate per unfunded turn (percentage points). */
    unfundedDecayRate: 0.5,
    /** Maximum innovations a single nation may research simultaneously. */
    maxSimultaneousResearch: 3,
  },

  /**
   * Discovery probability tunables.
   * @see FR-5100
   */
  discovery: {
    /** Base % chance of discovery per turn when funded. */
    baseChancePerTurn: 5,
    /** Hard ceiling on per-turn discovery probability. */
    maxChancePerTurn: 50,
    /** Multiplier applied when funding is at 100%. */
    fundingBonusMultiplier: 1.5,
    /** Weight given to real-world data when adjusting probability (0–1). */
    realWorldDataWeight: 0.2,
  },

  /**
   * Multi-order impact generation settings.
   * @see FR-5100
   */
  impacts: {
    /** Number of cascading impact orders to generate per discovery. */
    ordersToGenerate: 5,
    /** Allowed magnitude range for each impact dimension. */
    magnitudeRange: { min: -50, max: 50 },
  },

  /**
   * Category metadata for UI rendering and reporting.
   * @see FR-5100
   */
  categories: {
    space:             { label: 'Space',              icon: '🚀', color: '#1E3A5F' },
    quantum:           { label: 'Quantum',            icon: '⚛️',  color: '#6A0DAD' },
    biotech:           { label: 'Biotech',            icon: '🧬', color: '#2E7D32' },
    ai_computing:      { label: 'AI & Computing',     icon: '🤖', color: '#0D47A1' },
    materials:         { label: 'Materials',           icon: '🔩', color: '#795548' },
    energy:            { label: 'Energy',              icon: '⚡', color: '#F57F17' },
    military:          { label: 'Military',            icon: '🛡️',  color: '#B71C1C' },
    human_enhancement: { label: 'Human Enhancement',  icon: '🧠', color: '#00838F' },
    virtual_digital:   { label: 'Virtual & Digital',   icon: '🌐', color: '#4A148C' },
  } as Readonly<Record<InnovationCategory, { label: string; icon: string; color: string }>>,

  /**
   * Web-gathering / real-world intelligence tunables.
   * @see FR-5100
   */
  webGathering: {
    /** Number of search queries issued per innovation during a briefing cycle. */
    queriesPerInnovation: 3,
    /** Maximum source URLs retained per briefing report. */
    maxSourcesPerBriefing: 10,
    /** Bounds on how much real-world data can shift the base probability. */
    probabilityAdjustmentRange: { min: -15, max: 15 },
  },
} as const;
