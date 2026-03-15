/**
 * Game Controller — orchestrates actions, turn processing, and AI.
 *
 * This module bridges the pure-function engine with the Zustand store,
 * providing the interactive game loop: player actions → end turn → AI → headlines.
 *
 * v8.0.0: Integrates stock market, market indexes, scenario history recording,
 * and scenario scoring into the turn pipeline.
 *
 * v11.0.0 (FR-5400): Multi-Vector Decision Pipeline Integration —
 * replaces legacy single-heuristic AI with full UtilityEvaluator pipeline,
 * adds innovation discovery & policy aggregate feedback loops, carries
 * per-faction AI evaluation metadata in TurnProcessingResult.
 */

import type { GameState, FactionId, NationState, LeaderId, LeaderProfile, EmotionalStateSnapshot } from '@/data/types';
import type { RuntimeMarketState, ScenarioScore } from '@/data/types/model.types';
import { ALL_FACTIONS, FactionId as FID } from '@/data/types';
import { GAME_CONFIG } from './config';
import { MarketTurnIntegration, type MarketSignals } from './market-turn-integration';
import { ScenarioTurnIntegration, type RecordTurnInput, type CompleteScenarioInput } from './scenario-turn-integration';
import type { ScenarioHistoryArchive } from './scenario-history-recorder';
import {
  advanceResearch,
  rollForDiscovery,
  processDiscovery,
  getResearchSummary,
} from './innovation-engine';
import type { InnovationState, InnovationResearchState } from '@/data/types/innovation.types';
import {
  advancePolicyEffects,
  computeAggregateImpact,
} from './policy-engine';
import type { NationalPolicyState } from '@/data/types/policy.types';
import {
  checkCivilWarTrigger,
  trackConsecutiveUnrest,
  escalateMovement,
  advanceCivilWar,
  checkResolution,
  resolveCivilWar,
  getAIUnrestResponse,
  applyUnrestReaction,
} from './civil-war-engine';
import type { NationCivilWarState } from '@/data/types/civil-war.types';
import { evaluateFactionTurn } from './ai-profiles';
import type { AIEvaluationResult, ScoredAction } from './ai-evaluator';
import { actionSlateConfig } from './config/action-slate';
import { SeededRandom } from './rng';
import type { NationEconomicState, ChaoticEventState } from '@/data/types/economic-state.types';
import type { CurrencyState, CurrencyEvent } from '@/data/types/currency.types';
import {
  initializeCurrencyState,
  processEndOfTurnCurrency,
  getCurrencyTopMovers,
} from './currency-engine';
import {
  EXCHANGE_MODELS,
  TICKER_SET_MODELS,
  INDEX_MODELS,
} from '@/data/model-loader';
import {
  initNationEconomicState,
  processCommodityTurn,
  avgCommodityIndex,
} from './commodity-engine';
import { initNationalDebt, processDebtTurn } from './national-debt-engine';
import {
  initChaoticEventState,
  generateChaoticEvents,
  processChaoticEvents,
  getActiveSeverityForFaction,
} from './chaotic-events-engine';
import type { EmergentTechState } from '@/data/types/emergent-tech.types';
import {
  initEmergentTechState,
  processEmergentTechTurn,
} from './emergent-tech-engine';

// ─────────────────────────────────────────────────────────
// Action Types
// ─────────────────────────────────────────────────────────

export type GameActionType =
  | 'diplomatic_summit'
  | 'impose_sanctions'
  | 'foreign_aid'
  | 'deploy_forces'
  | 'raise_readiness'
  | 'cyber_operation'
  | 'economic_stimulus'
  | 'trade_agreement'
  | 'covert_operation'
  | 'surveillance_sweep'
  | 'nuclear_posture'
  | 'propaganda_campaign'
  | 'improve_relations'
  | 'issue_warning'
  | 'demand_concessions'
  | 'raise_tariffs'
  | 'lower_tariffs'
  | 'disaster_response'
  | 'debt_repayment'
  | 'protect_shipping'
  | 'commodity_stockpile'
  | 'consumer_stimulus'
  | 'export_promotion';

export interface GameAction {
  readonly id: string;
  readonly type: GameActionType;
  readonly label: string;
  readonly category: 'Diplomacy' | 'Military' | 'Economy' | 'Intelligence' | 'Information';
  readonly cost: number;
  readonly description: string;
  readonly targetRequired: boolean;
}

export interface ActionResult {
  readonly success: boolean;
  readonly headline: string;
  readonly effects: string[];
}

export interface TurnHeadline {
  readonly text: string;
  readonly perspective: 'western' | 'state' | 'intel';
  readonly severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Per-faction AI evaluation metadata produced during multi-vector processing.
 * @see FR-5406
 */
export interface AIFactionSummary {
  readonly factionId: FactionId;
  /** @deprecated Use {@link selectedActions} — kept for backward compat. */
  readonly selectedAction: string | null;
  /** All actions chosen this turn (up to 5). */
  readonly selectedActions: string[];
  readonly actionCategory: string | null;
  readonly finalScore: number | null;
  readonly desperationMode: boolean;
  readonly candidateCount: number;
}

export interface TurnProcessingResult {
  readonly headlines: TurnHeadline[];
  readonly aiActions: string[];
  readonly stateChanges: string[];
  readonly gameOver: boolean;
  readonly gameOverReason: string | null;
  /** Updated market state after processing turn events. */
  readonly marketState: RuntimeMarketState | null;
  /** Updated scenario history archive (append-only). */
  readonly scenarioArchive: ScenarioHistoryArchive | null;
  /** Composite score computed at game end (null during gameplay). */
  readonly scenarioScore: ScenarioScore | null;
  /** Updated innovation state after per-turn research/discovery processing. */
  readonly innovationState: InnovationState | null;
  /** Updated per-nation policy states after per-turn effects. */
  readonly nationalPolicies: Record<string, NationalPolicyState> | null;
  /** Updated per-nation civil war / protest states after per-turn processing. */
  readonly civilWarStates: Record<string, NationCivilWarState> | null;
  /** Updated per-nation economic states (commodities, trade, debt, shipping, consumer). */
  readonly economicStates: Record<FactionId, NationEconomicState> | null;
  /** Updated chaotic event state (natural disasters, pandemics). */
  readonly chaoticEventState: ChaoticEventState | null;
  /** Updated currency / forex state (exchange rates, reserves, history). */
  readonly currencyState: CurrencyState | null;
  /** Per-AI-faction evaluation metadata from the multi-vector pipeline. @see FR-5406 */
  readonly multiVectorSummary: AIFactionSummary[] | null;
  /** Updated emergent tech state (per-nation profiles, AI-generated techs, cross-industry). @see FR-6100 */
  readonly emergentTechState: EmergentTechState | null;
  /** Updated nation states after all AI actions, feedback loops, and natural changes. */
  readonly nationStates: Record<FactionId, NationState>;
  /** Updated relationship matrix after all AI diplomatic actions. */
  readonly relationshipMatrix: GameState['relationshipMatrix'];
}

// ─────────────────────────────────────────────────────────
// Available Actions
// ─────────────────────────────────────────────────────────

export const AVAILABLE_ACTIONS: GameAction[] = [
  { id: 'diplo-summit', type: 'diplomatic_summit', label: 'Call Summit', category: 'Diplomacy', cost: 2, description: 'Organize a diplomatic summit to reduce tensions', targetRequired: true },
  { id: 'diplo-sanction', type: 'impose_sanctions', label: 'Impose Sanctions', category: 'Diplomacy', cost: 0, description: 'Apply economic sanctions against a target nation', targetRequired: true },
  { id: 'diplo-aid', type: 'foreign_aid', label: 'Foreign Aid Package', category: 'Diplomacy', cost: 5, description: 'Send foreign aid to improve relations', targetRequired: true },
  { id: 'diplo-improve', type: 'improve_relations', label: 'Diplomatic Outreach', category: 'Diplomacy', cost: 1, description: 'Improve bilateral relations through diplomatic channels', targetRequired: true },
  { id: 'diplo-warn', type: 'issue_warning', label: 'Issue Warning', category: 'Diplomacy', cost: 0, description: 'Issue a formal warning to a rival nation', targetRequired: true },
  { id: 'diplo-demand', type: 'demand_concessions', label: 'Demand Concessions', category: 'Diplomacy', cost: 0, description: 'Demand concessions from a target nation', targetRequired: true },
  { id: 'mil-deploy', type: 'deploy_forces', label: 'Deploy Forces', category: 'Military', cost: 8, description: 'Deploy military forces toward a target region', targetRequired: true },
  { id: 'mil-readiness', type: 'raise_readiness', label: 'Raise Readiness', category: 'Military', cost: 3, description: 'Raise military alert level against a specific threat', targetRequired: true },
  { id: 'mil-cyber', type: 'cyber_operation', label: 'Cyber Operation', category: 'Military', cost: 1, description: 'Launch a cyber operation against target infrastructure', targetRequired: true },
  { id: 'mil-nuclear', type: 'nuclear_posture', label: 'Adjust Nuclear Posture', category: 'Military', cost: 0, description: 'Shift nuclear posture (increases deterrence but raises global tension)', targetRequired: false },
  { id: 'econ-stimulus', type: 'economic_stimulus', label: 'Economic Stimulus', category: 'Economy', cost: 10, description: 'Inject stimulus to boost GDP and popularity', targetRequired: false },
  { id: 'econ-trade', type: 'trade_agreement', label: 'Trade Agreement', category: 'Economy', cost: 0, description: 'Negotiate a trade agreement with a partner nation', targetRequired: true },
  { id: 'intel-covert', type: 'covert_operation', label: 'Covert Operation', category: 'Intelligence', cost: 4, description: 'Launch covert intelligence operation against a target', targetRequired: true },
  { id: 'intel-surveil', type: 'surveillance_sweep', label: 'Surveillance Sweep', category: 'Intelligence', cost: 1, description: 'Conduct surveillance to improve intel clarity', targetRequired: true },
  { id: 'info-propaganda', type: 'propaganda_campaign', label: 'Propaganda Campaign', category: 'Information', cost: 2, description: 'Launch an information warfare campaign', targetRequired: true },
  { id: 'econ-raise-tariffs', type: 'raise_tariffs', label: 'Raise Tariffs', category: 'Economy', cost: 0, description: 'Raise import tariffs to protect domestic industry (increases inflation)', targetRequired: false },
  { id: 'econ-lower-tariffs', type: 'lower_tariffs', label: 'Lower Tariffs', category: 'Economy', cost: 0, description: 'Lower import tariffs to reduce consumer prices and boost trade', targetRequired: false },
  { id: 'econ-disaster-response', type: 'disaster_response', label: 'Disaster Response', category: 'Economy', cost: 15, description: 'Activate emergency disaster response to mitigate ongoing damage', targetRequired: false },
  { id: 'econ-debt-repayment', type: 'debt_repayment', label: 'Debt Repayment', category: 'Economy', cost: 20, description: 'Allocate treasury funds toward reducing national debt', targetRequired: false },
  { id: 'econ-protect-shipping', type: 'protect_shipping', label: 'Protect Shipping', category: 'Economy', cost: 5, description: 'Deploy naval assets to secure international trade routes', targetRequired: false },
  { id: 'econ-stockpile', type: 'commodity_stockpile', label: 'Stockpile Commodities', category: 'Economy', cost: 10, description: 'Build strategic commodity reserves to buffer price shocks', targetRequired: false },
  { id: 'econ-consumer-stim', type: 'consumer_stimulus', label: 'Consumer Stimulus', category: 'Economy', cost: 8, description: 'Subsidies and tax breaks to boost consumer confidence and spending', targetRequired: false },
  { id: 'econ-export-promo', type: 'export_promotion', label: 'Export Promotion', category: 'Economy', cost: 5, description: 'Subsidize exports to improve trade balance', targetRequired: false },
];

// ─────────────────────────────────────────────────────────
// Faction Display Info
// ─────────────────────────────────────────────────────────

export const FACTION_INFO: Record<FactionId, {
  name: string;
  flag: string;
  color: string;
  description: string;
}> = {
  us: { name: 'United States', flag: '🇺🇸', color: '#3b82f6', description: 'Economic powerhouse with global military reach. High tech, high debt, polarized politics.' },
  china: { name: 'China', flag: '🇨🇳', color: '#ef4444', description: 'Rising superpower with massive treasury. Strong economy but dependent on energy imports.' },
  russia: { name: 'Russia', flag: '🇷🇺', color: '#8b5cf6', description: 'Nuclear power with vast territory. Weakened economy but strong military tradition.' },
  japan: { name: 'Japan', flag: '🇯🇵', color: '#ec4899', description: 'Technological leader under US security umbrella. High stability, no nuclear weapons.' },
  iran: { name: 'Iran', flag: '🇮🇷', color: '#22c55e', description: 'Regional power in turmoil. Low stability, high inflation, proxy network leverage.' },
  dprk: { name: 'North Korea', flag: '🇰🇵', color: '#f59e0b', description: 'Isolated nuclear state. Tiny economy but high military readiness and nuclear capability.' },
  eu: { name: 'European Union', flag: '🇪🇺', color: '#06b6d4', description: 'Economic bloc with collective diplomacy. Strong GDP but fragmented military.' },
  syria: { name: 'Syria', flag: '🇸🇾', color: '#84cc16', description: 'War-torn nation rebuilding. Minimal resources but strategic geographic position.' },
};

// ─────────────────────────────────────────────────────────
// Action Execution
// ─────────────────────────────────────────────────────────

/** Execute a player action and return modified nation states + result. */
export function executeAction(
  action: GameAction,
  targetFaction: FactionId | null,
  state: GameState,
): { nationStates: GameState['nationStates']; relations: GameState['relationshipMatrix']; result: ActionResult } {
  const player = state.playerFaction;
  const ns = structuredClone(state.nationStates);
  const rel = structuredClone(state.relationshipMatrix);
  const pn = ns[player];
  if (!pn) return { nationStates: ns, relations: rel, result: { success: false, headline: 'Invalid state', effects: [] } };

  // Deduct cost
  pn.treasury = Math.max(0, pn.treasury - action.cost);

  const effects: string[] = [];
  let headline = '';

  switch (action.type) {
    case 'diplomatic_summit': {
      if (targetFaction && rel[player]?.[targetFaction] !== undefined) {
        rel[player]![targetFaction]! = Math.max(-100, rel[player]![targetFaction]! - 15);
        rel[targetFaction]![player]! = Math.max(-100, rel[targetFaction]![player]! - 15);
        pn.diplomaticInfluence = Math.min(100, pn.diplomaticInfluence + 5);
        effects.push(`Tension with ${FACTION_INFO[targetFaction]?.name} reduced by 15`);
        effects.push('Diplomatic influence +5');
        headline = `${FACTION_INFO[player]?.name} hosts diplomatic summit with ${FACTION_INFO[targetFaction]?.name}`;
      }
      break;
    }
    case 'impose_sanctions': {
      if (targetFaction) {
        const tn = ns[targetFaction];
        if (tn) {
          tn.treasury = Math.max(0, tn.treasury - 20);
          tn.stability = Math.max(0, tn.stability - 5);
          rel[player]![targetFaction]! = Math.min(100, rel[player]![targetFaction]! + 20);
          rel[targetFaction]![player]! = Math.min(100, rel[targetFaction]![player]! + 20);
          effects.push(`${FACTION_INFO[targetFaction]?.name} treasury -$20B, stability -5`);
          effects.push('Bilateral tension +20');
          headline = `${FACTION_INFO[player]?.name} imposes sweeping sanctions on ${FACTION_INFO[targetFaction]?.name}`;
        }
      }
      break;
    }
    case 'foreign_aid': {
      if (targetFaction) {
        const tn = ns[targetFaction];
        if (tn) {
          tn.stability = Math.min(100, tn.stability + 5);
          tn.treasury = tn.treasury + 3;
          rel[player]![targetFaction]! = Math.max(-100, rel[player]![targetFaction]! - 10);
          rel[targetFaction]![player]! = Math.max(-100, rel[targetFaction]![player]! - 10);
          pn.popularity = Math.min(100, pn.popularity + 2);
          effects.push(`${FACTION_INFO[targetFaction]?.name} stability +5, treasury +$3B`);
          effects.push('Tension reduced by 10, popularity +2');
          headline = `${FACTION_INFO[player]?.name} sends $5B aid package to ${FACTION_INFO[targetFaction]?.name}`;
        }
      }
      break;
    }
    case 'improve_relations': {
      if (targetFaction) {
        rel[player]![targetFaction]! = Math.max(-100, rel[player]![targetFaction]! - 8);
        rel[targetFaction]![player]! = Math.max(-100, rel[targetFaction]![player]! - 8);
        effects.push(`Relations with ${FACTION_INFO[targetFaction]?.name} improved`);
        headline = `${FACTION_INFO[player]?.name} extends olive branch to ${FACTION_INFO[targetFaction]?.name}`;
      }
      break;
    }
    case 'issue_warning': {
      if (targetFaction) {
        rel[player]![targetFaction]! = Math.min(100, rel[player]![targetFaction]! + 10);
        rel[targetFaction]![player]! = Math.min(100, rel[targetFaction]![player]! + 10);
        const tn = ns[targetFaction];
        if (tn) tn.militaryReadiness = Math.min(100, tn.militaryReadiness + 3);
        pn.diplomaticInfluence = Math.min(100, pn.diplomaticInfluence + 3);
        effects.push(`Warning issued — tension +10, ${FACTION_INFO[targetFaction]?.name} raises readiness`);
        headline = `${FACTION_INFO[player]?.name} issues stern warning to ${FACTION_INFO[targetFaction]?.name}`;
      }
      break;
    }
    case 'demand_concessions': {
      if (targetFaction) {
        rel[player]![targetFaction]! = Math.min(100, rel[player]![targetFaction]! + 15);
        rel[targetFaction]![player]! = Math.min(100, rel[targetFaction]![player]! + 15);
        // 50% chance of success based on diplomatic influence differential
        const success = pn.diplomaticInfluence > (ns[targetFaction]?.diplomaticInfluence ?? 50);
        if (success) {
          pn.treasury += 10;
          effects.push('Concessions gained — treasury +$10B');
          headline = `${FACTION_INFO[targetFaction]?.name} capitulates to ${FACTION_INFO[player]?.name} demands`;
        } else {
          effects.push('Demands rejected — tension increased');
          headline = `${FACTION_INFO[targetFaction]?.name} defiantly rejects ${FACTION_INFO[player]?.name} demands`;
        }
      }
      break;
    }
    case 'deploy_forces': {
      pn.militaryReadiness = Math.min(100, pn.militaryReadiness + 10);
      if (targetFaction) {
        // Directed deployment — high tension with target, slight with others
        rel[player]![targetFaction]! = Math.min(100, rel[player]![targetFaction]! + 15);
        rel[targetFaction]![player]! = Math.min(100, rel[targetFaction]![player]! + 15);
        for (const fid of ALL_FACTIONS) {
          if (fid !== player && fid !== targetFaction && rel[fid]?.[player] !== undefined) {
            rel[fid]![player]! = Math.min(100, rel[fid]![player]! + 3);
          }
        }
        effects.push(`Forces deployed near ${FACTION_INFO[targetFaction]?.name}: readiness +10, tension +15`);
        headline = `${FACTION_INFO[player]?.name} deploys forces near ${FACTION_INFO[targetFaction]?.name} border`;
      } else {
        effects.push('Military readiness +10');
        headline = `${FACTION_INFO[player]?.name} deploys additional military forces`;
      }
      break;
    }
    case 'raise_readiness': {
      pn.militaryReadiness = Math.min(100, pn.militaryReadiness + 5);
      if (targetFaction) {
        rel[player]![targetFaction]! = Math.min(100, rel[player]![targetFaction]! + 8);
        rel[targetFaction]![player]! = Math.min(100, rel[targetFaction]![player]! + 8);
        effects.push(`Alert level raised against ${FACTION_INFO[targetFaction]?.name}: readiness +5, tension +8`);
        headline = `${FACTION_INFO[player]?.name} raises alert level citing ${FACTION_INFO[targetFaction]?.name} threat`;
      } else {
        effects.push('Military readiness +5');
        headline = `${FACTION_INFO[player]?.name} raises military alert level`;
      }
      break;
    }
    case 'cyber_operation': {
      if (targetFaction) {
        const tn = ns[targetFaction];
        if (tn) {
          tn.techLevel = Math.max(0, tn.techLevel - 3);
          tn.stability = Math.max(0, tn.stability - 2);
          rel[player]![targetFaction]! = Math.min(100, rel[player]![targetFaction]! + 8);
          effects.push(`Cyber attack: ${FACTION_INFO[targetFaction]?.name} tech -3, stability -2`);
          headline = `Major cyberattack disrupts ${FACTION_INFO[targetFaction]?.name} infrastructure`;
        }
      }
      break;
    }
    case 'nuclear_posture': {
      pn.nuclearThreshold = Math.min(100, pn.nuclearThreshold + 10);
      for (const fid of ALL_FACTIONS) {
        if (fid !== player && rel[fid]?.[player] !== undefined) {
          rel[fid]![player]! = Math.min(100, rel[fid]![player]! + 8);
        }
      }
      effects.push('Nuclear posture escalated — global alarm');
      headline = `${FACTION_INFO[player]?.name} escalates nuclear posture — world holds its breath`;
      break;
    }
    case 'economic_stimulus': {
      // Cost already deducted above; scale effects by the cost spent
      const spent = action.cost;
      const stabilityGain = Math.round(spent * 0.3);
      const popularityGain = Math.round(spent * 0.5);
      const inflationGain = Math.round(spent * 0.2);
      pn.stability = Math.min(100, pn.stability + stabilityGain);
      pn.popularity = Math.min(100, pn.popularity + popularityGain);
      pn.inflation = pn.inflation + inflationGain;
      effects.push(`Stability +${stabilityGain}, popularity +${popularityGain}, inflation +${inflationGain}%`);
      headline = `${FACTION_INFO[player]?.name} announces $${spent}B economic stimulus package`;
      break;
    }
    case 'trade_agreement': {
      if (targetFaction) {
        const tn = ns[targetFaction];
        if (tn) {
          pn.treasury += 5;
          tn.treasury += 3;
          rel[player]![targetFaction]! = Math.max(-100, rel[player]![targetFaction]! - 5);
          rel[targetFaction]![player]! = Math.max(-100, rel[targetFaction]![player]! - 5);
          effects.push(`Trade deal: both nations profit, tension -5`);
          headline = `${FACTION_INFO[player]?.name} and ${FACTION_INFO[targetFaction]?.name} sign trade agreement`;
        }
      }
      break;
    }
    case 'covert_operation': {
      if (targetFaction) {
        const tn = ns[targetFaction];
        if (tn) {
          tn.stability = Math.max(0, tn.stability - 5);
          // Risk of exposure
          const exposed = Math.random() < 0.3;
          if (exposed) {
            rel[player]![targetFaction]! = Math.min(100, rel[player]![targetFaction]! + 25);
            rel[targetFaction]![player]! = Math.min(100, rel[targetFaction]![player]! + 25);
            effects.push(`Operation exposed! Massive diplomatic fallout`);
            headline = `Covert operation by ${FACTION_INFO[player]?.name} exposed in ${FACTION_INFO[targetFaction]?.name} — outrage ensues`;
          } else {
            effects.push(`Covert op successful: ${FACTION_INFO[targetFaction]?.name} stability -5`);
            headline = `Mysterious disruptions reported in ${FACTION_INFO[targetFaction]?.name}`;
          }
        }
      }
      break;
    }
    case 'surveillance_sweep': {
      if (targetFaction) {
        effects.push(`Intelligence on ${FACTION_INFO[targetFaction]?.name} improved`);
        headline = `Intelligence agencies report enhanced clarity on ${FACTION_INFO[targetFaction]?.name} activities`;
      }
      break;
    }
    case 'propaganda_campaign': {
      if (targetFaction) {
        const tn = ns[targetFaction];
        if (tn) {
          tn.popularity = Math.max(0, tn.popularity - 5);
          tn.stability = Math.max(0, tn.stability - 2);
          effects.push(`Propaganda: ${FACTION_INFO[targetFaction]?.name} popularity -5, stability -2`);
          headline = `${FACTION_INFO[player]?.name} launches information campaign targeting ${FACTION_INFO[targetFaction]?.name}`;
        }
      }
      break;
    }
  }

  return {
    nationStates: ns,
    relations: rel,
    result: {
      success: true,
      headline: headline || `${FACTION_INFO[player]?.name} takes action`,
      effects,
    },
  };
}

// ─────────────────────────────────────────────────────────
// AI Turn Processing
// ─────────────────────────────────────────────────────────

/** AI decision-making for a single AI faction — applies up to 5 actions per turn (FR-5001). */
function processAIFaction(
  factionId: FactionId,
  state: GameState,
): { nationStates: GameState['nationStates']; relations: GameState['relationshipMatrix']; action: string; actions: string[]; evaluationResult: AIEvaluationResult | null } {
  const ns = structuredClone(state.nationStates);
  const rel = structuredClone(state.relationshipMatrix);
  const fn = ns[factionId];
  if (!fn) return { nationStates: ns, relations: rel, action: '', actions: [], evaluationResult: null };
  const info = FACTION_INFO[factionId];

  // ── FR-5401: Multi-vector AI via UtilityEvaluator ──────────────────────
  // Find the faction's leader profile and emotional state
  let leaderProfile: LeaderProfile | undefined;
  let emotionalState: EmotionalStateSnapshot | undefined;
  let leaderId: LeaderId | undefined;

  for (const [lid, lp] of Object.entries(state.leaderProfiles)) {
    if (lp.identity.nation === factionId) {
      leaderProfile = lp;
      leaderId = lid as LeaderId;
      emotionalState = state.emotionalStates[leaderId];
      break;
    }
  }

  let evaluationResult: AIEvaluationResult | null = null;
  let action = '';
  let topRankedActions: ScoredAction[] = [];

  if (leaderProfile && emotionalState) {
    // Build per-faction tension map from relationship matrix
    const tensions: Record<string, number> = {};
    for (const otherId of ALL_FACTIONS) {
      if (otherId === factionId) continue;
      tensions[otherId] = rel[factionId]?.[otherId] ?? 0;
    }

    // Deterministic seed: game seed XOR faction hash XOR turn
    const factionHash = Array.from(factionId).reduce(
      (h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0,
      0,
    );
    const turnSeed =
      (state.randomSeed ^ factionHash ^ ((state.currentTurn as number) * 7919)) >>> 0;
    const rng = new SeededRandom(turnSeed);

    evaluationResult = evaluateFactionTurn({
      factionId,
      nationState: fn,
      leaderProfile,
      emotionalState,
      difficulty: 'balanced',
      rng,
      tensions: tensions as Record<FactionId, number>,
    });

    const selected = evaluationResult.selectedAction;
    action = `${info?.name} ${selected.name}`;

    // FR-5001: Apply up to maxActionsPerAINation top-ranked actions
    const maxActions = actionSlateConfig.ai.maxActionsPerAINation;
    topRankedActions = evaluationResult.rankedActions
      .slice(0, maxActions)
      .filter((sa) => sa.finalScore > 0);

    for (const scored of topRankedActions) {
      const act = scored.action;

      // Apply the action's estimated impact to nation state
      if (act.estimatedImpact) {
        const impact = act.estimatedImpact;
        if (impact.stability !== undefined) {
          fn.stability = Math.max(0, Math.min(100, fn.stability + impact.stability));
        }
        if (impact.treasury !== undefined) {
          fn.treasury = Math.max(0, fn.treasury + impact.treasury);
        }
        if (impact.diplomaticInfluence !== undefined) {
          fn.diplomaticInfluence = Math.max(
            0,
            Math.min(100, fn.diplomaticInfluence + impact.diplomaticInfluence),
          );
        }
        if (impact.militaryReadiness !== undefined) {
          fn.militaryReadiness = Math.max(
            0,
            Math.min(100, fn.militaryReadiness + impact.militaryReadiness),
          );
        }
        if (impact.nuclearThreshold !== undefined) {
          fn.nuclearThreshold = Math.max(
            0,
            Math.min(100, fn.nuclearThreshold + impact.nuclearThreshold),
          );
        }
        if (impact.popularity !== undefined) {
          fn.popularity = Math.max(0, Math.min(100, fn.popularity + impact.popularity));
        }
        if (impact.allianceCredibility !== undefined) {
          fn.allianceCredibility = Math.max(
            0,
            Math.min(100, fn.allianceCredibility + impact.allianceCredibility),
          );
        }
      }

      // Apply relation changes for targeted actions
      if (act.targetFaction) {
        const target = act.targetFaction;
        if (act.category === 'diplomatic') {
          rel[factionId]![target]! = Math.max(-100, (rel[factionId]?.[target] ?? 0) - 5);
          rel[target]![factionId]! = Math.max(-100, (rel[target]?.[factionId] ?? 0) - 3);
        } else if (act.category === 'military' || act.category === 'nuclear') {
          rel[factionId]![target]! = Math.min(100, (rel[factionId]?.[target] ?? 0) + 5);
          rel[target]![factionId]! = Math.min(100, (rel[target]?.[factionId] ?? 0) + 3);
        }
      }
    }
  } else {
    // Fallback: no leader data available — minimal default
    fn.treasury += 2;
    fn.techLevel = Math.min(100, fn.techLevel + 1);
    action = `${info?.name} invests in technology and infrastructure`;
  }

  // Natural economic changes
  fn.gdp = Math.round(fn.gdp * (1 + (Math.random() * 0.02 - 0.005)));
  fn.inflation = Math.max(0, fn.inflation + (Math.random() * 2 - 1));
  fn.stability = Math.max(0, Math.min(100, fn.stability + (Math.random() * 4 - 2)));

  // Collect all action labels (fallback: single action label)
  const allActions = topRankedActions.length > 0
    ? topRankedActions.map((sa) => `${info?.name} ${sa.action.name}`)
    : action ? [action] : [];

  return { nationStates: ns, relations: rel, action, actions: allActions, evaluationResult };
}

/** Process end-of-turn for all AI factions and generate headlines. */
export function processTurn(
  state: GameState,
  scenarioArchive?: ScenarioHistoryArchive | null,
): TurnProcessingResult {
  let currentNS = structuredClone(state.nationStates);
  let currentRel = structuredClone(state.relationshipMatrix);
  const aiActions: string[] = [];
  const headlines: TurnHeadline[] = [];
  const stateChanges: string[] = [];

  // ── Track signals for market integration ──────────────────────────────
  const sanctionsChangedFactions: FactionId[] = [];
  const tradeDealFactions: FactionId[] = [];
  const activeCombatFactions: FactionId[] = [];
  const techBreakthroughFactions: FactionId[] = [];

  // ── FR-5406: Collect per-faction AI evaluation metadata ───────────────
  const multiVectorSummary: AIFactionSummary[] = [];

  // Process each AI faction
  for (const fid of ALL_FACTIONS) {
    if (fid === state.playerFaction) continue;
    const result = processAIFaction(fid, {
      ...state,
      nationStates: currentNS,
      relationshipMatrix: currentRel,
    });
    currentNS = result.nationStates;
    currentRel = result.relations;

    // Collect multi-vector evaluation metadata (FR-5406)
    const evalResult = result.evaluationResult;
    multiVectorSummary.push({
      factionId: fid,
      selectedAction: evalResult?.selectedAction.name ?? null,
      selectedActions: result.actions.length > 0
        ? result.actions
        : evalResult ? [evalResult.selectedAction.name] : [],
      actionCategory: evalResult?.selectedAction.category ?? null,
      finalScore: evalResult
        ? evalResult.rankedActions[0]?.finalScore ?? null
        : null,
      desperationMode: evalResult?.desperationMode ?? false,
      candidateCount: evalResult?.rankedActions.length ?? 0,
    });

    if (result.actions.length > 0) {
      aiActions.push(...result.actions);
      for (const actionText of result.actions) {
        headlines.push({
          text: actionText,
          perspective: 'western',
          severity: 'medium',
        });
        if (actionText.includes('military') || actionText.includes('pressure')) {
          activeCombatFactions.push(fid);
        }
      }
    } else if (result.action) {
      aiActions.push(result.action);
      headlines.push({
        text: result.action,
        perspective: 'western',
        severity: 'medium',
      });
      if (result.action.includes('military') || result.action.includes('pressure')) {
        activeCombatFactions.push(fid);
      }
    }
  }

  // Player nation natural changes
  const pn = currentNS[state.playerFaction];
  if (pn) {
    const oldStability = pn.stability;
    pn.gdp = Math.round(pn.gdp * (1 + (Math.random() * 0.02 - 0.005)));
    pn.inflation = Math.max(0, pn.inflation + (Math.random() * 1.5 - 0.5));
    pn.stability = Math.max(0, Math.min(100, pn.stability + (Math.random() * 3 - 1.5)));
    pn.popularity = Math.max(0, Math.min(100, pn.popularity + (Math.random() * 4 - 2)));
    pn.treasury += Math.round(pn.gdp * 0.001);

    if (pn.stability < oldStability - 3) {
      stateChanges.push('Your stability is declining!');
    }
    if (pn.inflation > 20) {
      stateChanges.push('Warning: Inflation is dangerously high');
      headlines.push({ text: `Inflation crisis grips ${FACTION_INFO[state.playerFaction]?.name}`, perspective: 'western', severity: 'high' });
    }
    if (pn.stability < 20) {
      stateChanges.push('CRITICAL: Your regime is on the brink of collapse!');
      headlines.push({ text: `Political crisis deepens in ${FACTION_INFO[state.playerFaction]?.name}`, perspective: 'western', severity: 'critical' });
    }
  }

  // ── Innovation Engine Integration (FR-5100) ───────────────────────────
  // NOTE: Innovation is processed BEFORE markets so that tech breakthrough
  // signals from this turn feed into the stock market engine.
  let updatedInnovationState: InnovationState | null = state.innovationState ? structuredClone(state.innovationState) : null;
  try {
    if (updatedInnovationState) {
      const nationResearch = updatedInnovationState.nationResearch;
      for (const [key, rs] of Object.entries(nationResearch)) {
        if (rs.discovered) continue;
        const innov = updatedInnovationState.innovations[rs.innovationId];
        if (!innov) continue;
        const advanced = advanceResearch(rs, rs.fundingLevel);
        const rollResult = rollForDiscovery(advanced, innov);
        if (rollResult.discovered) {
          const disc = processDiscovery(advanced, innov, state.currentTurn as number, rs.nationId);
          nationResearch[key] = disc.research;
          updatedInnovationState.discoveryLog.push(disc.event);
          headlines.push({ text: disc.event.headline, perspective: 'western', severity: 'high' });
          stateChanges.push(`Innovation discovered: ${innov.name}`);
          // Track for market signals
          if (!techBreakthroughFactions.includes(rs.nationId as FactionId)) {
            techBreakthroughFactions.push(rs.nationId as FactionId);
          }

          // ── FR-5404: Innovation discovery feedback loop ─────────────
          // Apply discovery impacts to the discovering nation's state
          const discNation = currentNS[rs.nationId as FactionId];
          if (discNation && disc.event) {
            const evt = disc.event;
            // Market impact → techLevel boost
            if (evt.marketImpact) {
              for (const val of Object.values(evt.marketImpact)) {
                discNation.techLevel = Math.max(0, Math.min(100, discNation.techLevel + (val as number) * 0.1));
              }
            }
            // Diplomatic impact → diplomaticInfluence boost
            if (evt.diplomaticImpact) {
              for (const val of Object.values(evt.diplomaticImpact)) {
                discNation.diplomaticInfluence = Math.max(0, Math.min(100, discNation.diplomaticInfluence + (val as number) * 0.1));
              }
            }
            // Military impact → militaryReadiness boost
            if (evt.militaryImpact) {
              for (const val of Object.values(evt.militaryImpact)) {
                discNation.militaryReadiness = Math.max(0, Math.min(100, discNation.militaryReadiness + (val as number) * 0.1));
              }
            }
          }
        } else {
          nationResearch[key] = advanced;
        }
      }
    }
  } catch (err) {
    console.error('[game-controller] Innovation engine error:', err);
  }

  // ── Emergent Technology Engine (FR-6100) ──────────────────────────────
  // Processes per-nation tech profiles, generates novel AI-driven
  // technologies, advances maturity, and applies cross-industry impacts.
  // Runs AFTER innovation so innovation breakthroughs feed tech profiles.
  let updatedEmergentTechState: EmergentTechState | null = state.emergentTechState
    ? structuredClone(state.emergentTechState)
    : null;
  try {
    // Create a deterministic RNG for emergent tech
    const emergentSeed = (state.randomSeed ^ ((state.currentTurn as number) * 13337)) >>> 0;
    const emergentRng = new SeededRandom(emergentSeed);

    // Initialise on first turn if needed
    if (!updatedEmergentTechState) {
      updatedEmergentTechState = initEmergentTechState(
        state.technologyIndices,
        currentNS,
        state.currentTurn as number,
      );
    }

    const emergentResult = processEmergentTechTurn({
      state: updatedEmergentTechState,
      techIndices: state.technologyIndices,
      nationStates: currentNS,
      relationshipMatrix: currentRel as unknown as Record<FactionId, Record<FactionId, number>>,
      turn: state.currentTurn as number,
      rng: emergentRng,
    });

    updatedEmergentTechState = emergentResult.updatedState;

    // Apply nation-stat effects from emergent techs
    for (const fid of ALL_FACTIONS) {
      const effects = emergentResult.nationEffects[fid];
      const ns = currentNS[fid];
      if (!effects || !ns) continue;
      ns.techLevel = Math.max(0, Math.min(100, ns.techLevel + effects.techLevelDelta));
      ns.stability = Math.max(0, Math.min(100, ns.stability + effects.stabilityDelta));
      ns.militaryReadiness = Math.max(0, Math.min(100, ns.militaryReadiness + effects.militaryReadinessDelta));
      ns.diplomaticInfluence = Math.max(0, Math.min(100, ns.diplomaticInfluence + effects.diplomaticInfluenceDelta));
    }

    // Merge breakthrough factions for market signals
    for (const fid of emergentResult.breakthroughFactions) {
      if (!techBreakthroughFactions.includes(fid)) {
        techBreakthroughFactions.push(fid);
      }
    }

    // Generate headlines from emergent tech events
    for (const evt of emergentResult.events) {
      const severity = evt.eventType === 'generation' ? 'high' : 'medium';
      headlines.push({ text: evt.headline, perspective: 'western', severity });
      stateChanges.push(evt.headline);
    }
  } catch (err) {
    console.error('[game-controller] Emergent tech engine error:', err);
  }

  // ── Stock Market Integration (FR-3300, FR-3400) ───────────────────────
  // Runs AFTER innovation so tech-breakthrough signals are available.
  let updatedMarketState: RuntimeMarketState | null = state.marketState ?? null;
  try {
    const marketIntegration = new MarketTurnIntegration();

    // Defensive re-initialization: if marketState is null but models are
    // loaded, initialise it now. This prevents the processMarketTurn null
    // guard from throwing on every subsequent turn.
    if (updatedMarketState === null && EXCHANGE_MODELS.length > 0 && TICKER_SET_MODELS.length > 0) {
      updatedMarketState = marketIntegration.initialiseMarketState(
        EXCHANGE_MODELS,
        TICKER_SET_MODELS,
        INDEX_MODELS,
        state.currentTurn as number,
      );
    }

    // Detect high-unrest factions
    const highUnrestFactions: FactionId[] = [];
    for (const fid of ALL_FACTIONS) {
      const ns = currentNS[fid];
      if (ns && ns.stability < 40) highUnrestFactions.push(fid);
    }

    // Detect oil/energy disruption from existing chaotic events
    const oilDisruptionActive = state.chaoticEventState?.activeEvents.some(
      e => e.active && (e.type === 'hurricane' || e.type === 'earthquake' || e.type === 'flood')
        && ['us', 'russia', 'iran', 'eu'].includes(e.targetNation),
    ) ?? false;

    const signals: MarketSignals = {
      activeCombatFactions,
      sanctionsChangedFactions,
      techBreakthroughFactions,
      highUnrestFactions,
      tradeDealFactions,
      oilDisruptionActive,
      regimeChangeFactions: [],
      currentTurn: state.currentTurn as number,
    };

    const marketOutput = marketIntegration.processMarketTurn({
      currentMarketState: updatedMarketState,
      signals,
      nationStates: currentNS as Record<string, NationState>,
      gfsi: state.globalFinancialStability?.gfsi ?? 75,
    });

    updatedMarketState = marketOutput.marketState;

    // Generate headlines from market events
    for (const evt of marketOutput.newMarketEvents) {
      if (evt.eventType === 'crash' || evt.eventType === 'contagion') {
        headlines.push({
          text: `Market ${evt.eventType}: ${evt.cause} (${evt.affectedExchanges.join(', ')})`,
          perspective: 'western',
          severity: evt.magnitude > 15 ? 'critical' : 'high',
        });
      } else if (evt.eventType === 'rally') {
        headlines.push({
          text: `Market rally: ${evt.cause} (${evt.affectedExchanges.join(', ')})`,
          perspective: 'western',
          severity: 'medium',
        });
      }
    }
  } catch (err) {
    console.error('[game-controller] Market integration error:', err);
  }

  // ── Policy Engine Integration (FR-5200) ───────────────────────────────
  let updatedPolicies: Record<string, NationalPolicyState> | null = state.nationalPolicies
    ? structuredClone(state.nationalPolicies as Record<string, NationalPolicyState>)
    : null;
  try {
    if (updatedPolicies) {
      for (const [fid, policyState] of Object.entries(updatedPolicies)) {
        const ns = currentNS[fid as FactionId];
        if (!ns) continue;
        const advanced = advancePolicyEffects(policyState, state.currentTurn as number);

        // ── FR-5405: Policy aggregate feedback loop ───────────────────
        // Apply aggregate policy impact to nation state dimensions
        const aggregate = computeAggregateImpact(advanced);
        if (aggregate) {
          const POLICY_FEEDBACK_SCALE = 0.05; // small per-turn factor to prevent runaway
          for (const [dim, value] of Object.entries(aggregate)) {
            const scaled = (value as number) * POLICY_FEEDBACK_SCALE;
            switch (dim) {
              case 'stability':
                ns.stability = Math.max(0, Math.min(100, ns.stability + scaled));
                break;
              case 'treasury':
              case 'economic':
                ns.treasury = Math.max(0, ns.treasury + scaled);
                break;
              case 'popularity':
              case 'approval':
                ns.popularity = Math.max(0, Math.min(100, ns.popularity + scaled));
                break;
              case 'military':
              case 'militaryReadiness':
                ns.militaryReadiness = Math.max(0, Math.min(100, ns.militaryReadiness + scaled));
                break;
              case 'diplomatic':
              case 'diplomaticInfluence':
                ns.diplomaticInfluence = Math.max(0, Math.min(100, ns.diplomaticInfluence + scaled));
                break;
              case 'technology':
              case 'techLevel':
                ns.techLevel = Math.max(0, Math.min(100, ns.techLevel + scaled));
                break;
            }
          }
        }

        updatedPolicies[fid] = advanced;
      }
    }
  } catch { /* Policy integration non-critical */ }

  // ── Civil War Engine Integration (FR-5300) ────────────────────────────
  let updatedCivilWar: Record<string, NationCivilWarState> | null = state.civilWarStates
    ? structuredClone(state.civilWarStates as Record<string, NationCivilWarState>)
    : null;
  try {
    if (updatedCivilWar) {
      for (const fid of ALL_FACTIONS) {
        const cws = updatedCivilWar[fid];
        const ns = currentNS[fid];
        if (!cws || !ns) continue;
        // Track consecutive unrest turns (pass numeric unrest = 100 - stability)
        const unrestValue = Math.max(0, 100 - ns.stability);
        let tracked = trackConsecutiveUnrest(cws, unrestValue);
        // Escalate active protests
        tracked = {
          ...tracked,
          protestMovements: tracked.protestMovements.map(m => {
            if (m.resolved) return m;
            return ns.stability < 30 ? escalateMovement(m) : m;
          }),
        };
        // Check civil war trigger
        const triggered = checkCivilWarTrigger(tracked, unrestValue, 0, false);
        if (triggered && tracked.activeCivilWars.length === 0) {
          headlines.push({
            text: `Civil war erupts in ${FACTION_INFO[fid]?.name}!`,
            perspective: 'intel', severity: 'critical',
          });
          stateChanges.push(`CRITICAL: Civil war triggered in ${FACTION_INFO[fid]?.name}`);
        }
        // Advance active civil wars
        for (const war of tracked.activeCivilWars) {
          if (war.resolutionType != null) continue; // already resolved
          const advanced = advanceCivilWar(war);
          const resolution = checkResolution(advanced);
          if (resolution) {
            tracked = resolveCivilWar(tracked, advanced.warId, resolution, state.currentTurn as number);
            headlines.push({
              text: `Civil war in ${FACTION_INFO[fid]?.name} resolved: ${resolution}`,
              perspective: 'western', severity: 'high',
            });
          } else {
            // Replace the war entry with the advanced version
            tracked = {
              ...tracked,
              activeCivilWars: tracked.activeCivilWars.map(w =>
                w.warId === advanced.warId ? advanced : w
              ),
            };
          }
        }
        // AI reaction for non-player factions
        if (fid !== state.playerFaction && tracked.protestMovements.length > 0) {
          const unresolvedMovement = tracked.protestMovements.find(m => !m.resolved);
          if (unresolvedMovement) {
            // Derive political system archetype from faction ID
            const politicalSystem = fid === 'china' ? 'authoritarian' : fid === 'russia' ? 'authoritarian' : fid === 'iran' ? 'authoritarian' : 'democratic';
            const aiResponseType = getAIUnrestResponse(politicalSystem, unrestValue, ns.treasury / Math.max(1, ns.gdp) * 100);
            const reacted = applyUnrestReaction(tracked, unresolvedMovement.movementId, aiResponseType, state.currentTurn as number);
            tracked = reacted.state;
          }
        }
        updatedCivilWar[fid] = tracked;
      }
    }
  } catch { /* Civil war integration non-critical */ }

  // ── Chaotic Events Engine Integration (FR-7005) ───────────────────────
  let updatedChaoticState: ChaoticEventState | null = state.chaoticEventState
    ? structuredClone(state.chaoticEventState)
    : initChaoticEventState();
  try {
    if (updatedChaoticState) {
      // Generate new events
      const turnNum = state.currentTurn as number;
      const factionRolls: Record<string, number> = {};
      const typeRolls: Record<string, number> = {};
      const severityRolls: Record<string, number> = {};
      for (const fid of ALL_FACTIONS) {
        factionRolls[fid] = Math.random();
        typeRolls[fid] = Math.random();
        severityRolls[fid] = Math.random();
      }

      const newEvents = generateChaoticEvents({
        turn: turnNum as TurnNumber,
        currentState: updatedChaoticState,
        factions: ALL_FACTIONS,
        factionRolls,
        typeRolls,
        severityRolls,
      });

      // Add newly generated events
      updatedChaoticState = {
        ...updatedChaoticState,
        activeEvents: [...updatedChaoticState.activeEvents, ...newEvents],
      };

      // Build trade partners map from relationship matrix
      const tradePartnerMap: Record<string, FactionId[]> = {};
      for (const fid of ALL_FACTIONS) {
        tradePartnerMap[fid] = ALL_FACTIONS.filter(f => f !== fid && (currentRel[fid]?.[f] ?? 50) < 70);
      }
      const spreadRolls: Record<string, number> = {};
      for (const fid of ALL_FACTIONS) spreadRolls[fid] = Math.random();

      // Process active events
      const evtResult = processChaoticEvents({
        currentState: updatedChaoticState,
        nationStates: currentNS as Record<string, NationState>,
        tradePartners: tradePartnerMap,
        spreadRolls,
        turn: turnNum as TurnNumber,
      });

      updatedChaoticState = evtResult.state;

      // Apply chaotic event impacts to nation states
      for (const fid of ALL_FACTIONS) {
        const ns = currentNS[fid];
        if (!ns) continue;
        const stabDelta = evtResult.stabilityImpactByFaction[fid] ?? 0;
        const inflDelta = evtResult.inflationImpactByFaction[fid] ?? 0;
        const gdpPenalty = evtResult.gdpPenaltyByFaction[fid] ?? 0;
        const econDamage = evtResult.economicDamageByFaction[fid] ?? 0;

        ns.stability = Math.max(0, Math.min(100, ns.stability + stabDelta));
        ns.inflation = Math.max(0, ns.inflation + inflDelta);
        ns.gdp = Math.round(ns.gdp * (1 + gdpPenalty));
        ns.treasury = Math.max(0, ns.treasury - econDamage * 0.1);
      }

      // Add headlines from chaotic events
      for (const hl of evtResult.headlines) {
        headlines.push({ text: hl, perspective: 'western', severity: 'critical' });
      }

      // Virus spread: create new events for next turn
      for (const spread of evtResult.virusSpreadTargets) {
        const existing = updatedChaoticState.activeEvents.some(
          e => e.type === 'virus' && e.targetNation === spread.to && e.active,
        );
        if (!existing) {
          updatedChaoticState.activeEvents.push({
            id: `chaos-${spread.to}-virus-spread-${turnNum}`,
            type: 'virus',
            targetNation: spread.to,
            name: `Viral spread from ${FACTION_INFO[spread.from]?.name} to ${FACTION_INFO[spread.to]?.name}`,
            severity: spread.severity,
            turnFired: turnNum as TurnNumber,
            duration: 4,
            turnsRemaining: 4,
            active: true,
            economicDamage: 0,
            populationImpact: 0,
            infrastructureDamage: 0,
            responseActivated: false,
          });
          headlines.push({
            text: `PANDEMIC: Virus spreads from ${FACTION_INFO[spread.from]?.name} to ${FACTION_INFO[spread.to]?.name}`,
            perspective: 'western',
            severity: 'critical',
          });
        }
      }
    }
  } catch { /* Chaotic events integration non-critical */ }

  // ── Macroeconomic Engine Integration (FR-7001–7004) ───────────────────
  let updatedEconomicStates: Record<FactionId, NationEconomicState> | null =
    state.economicStates ? structuredClone(state.economicStates) : null;
  try {
    // Initialize economic states on first turn if null
    if (!updatedEconomicStates) {
      updatedEconomicStates = {} as Record<FactionId, NationEconomicState>;
      for (const fid of ALL_FACTIONS) {
        const ns = currentNS[fid];
        if (!ns) continue;
        const econ = initNationEconomicState(fid, state.currentTurn);
        // Initialize debt from GDP
        econ.nationalDebt = initNationalDebt(fid, ns.gdp);
        updatedEconomicStates[fid] = econ;
      }
    }

    // Process commodity, trade, shipping, consumer, and debt per faction
    for (const fid of ALL_FACTIONS) {
      const ns = currentNS[fid];
      const econ = updatedEconomicStates[fid];
      if (!ns || !econ) continue;

      // Disaster severity for this faction
      const disasterSev = updatedChaoticState
        ? getActiveSeverityForFaction(updatedChaoticState, fid)
        : 0;

      // Commodity & trade turn
      const commodityResult = processCommodityTurn({
        economicState: econ,
        nationState: ns,
        disasterSeverity: disasterSev,
        blockadeActive: false,
        newDisruptedLanes: [],
        randomValues: {
          oil: Math.random(),
          naturalGas: Math.random(),
          food: Math.random(),
          metals: Math.random(),
          consumerGoods: Math.random(),
        },
        turn: state.currentTurn,
      });

      // Apply commodity inflation feedback
      ns.inflation = Math.max(0, ns.inflation + commodityResult.inflationDelta);

      // Apply GDP spending impact
      ns.gdp = Math.round(ns.gdp * (1 + commodityResult.gdpSpendingImpact));

      // Apply trade balance treasury impact
      ns.treasury = Math.max(0, ns.treasury + commodityResult.tradeBalanceTreasuryImpact);

      // National debt turn
      const debtResult = processDebtTurn({
        currentDebt: econ.nationalDebt,
        nationState: ns,
        turnTreasuryDelta: commodityResult.tradeBalanceTreasuryImpact,
        militarySpending: ns.militaryReadiness * 0.1, // rough proxy
        disasterCosts: disasterSev > 0 ? disasterSev * 5 : 0,
        tradeBalance: commodityResult.economicState.tradeLedger.tradeBalance,
      });

      // Apply debt interest cost
      ns.treasury = Math.max(0, ns.treasury - debtResult.interestCost);

      // Apply debt stability penalty
      ns.stability = Math.max(0, Math.min(100, ns.stability + debtResult.stabilityDelta));

      // Apply GDP growth penalty from high debt
      ns.gdp = Math.round(ns.gdp * (1 + debtResult.gdpGrowthPenalty));

      // Store updated economic state
      updatedEconomicStates[fid] = {
        ...commodityResult.economicState,
        nationalDebt: debtResult.debt,
      };

      // Generate headlines for debt events
      if (debtResult.headline) {
        headlines.push({ text: debtResult.headline, perspective: 'western', severity: 'high' });
      }

      // Generate headline for high commodity prices
      const avgIdx = avgCommodityIndex(commodityResult.economicState.commodityPrices);
      if (avgIdx > 150) {
        headlines.push({
          text: `Commodity crisis in ${FACTION_INFO[fid]?.name}: price index at ${Math.round(avgIdx)}`,
          perspective: 'western', severity: 'high',
        });
      }
    }
  } catch { /* Macroeconomic integration non-critical */ }

  // ── Currency / Forex Engine Integration (FR-3800) ─────────────────────
  let updatedCurrencyState: CurrencyState | null = state.currencyState
    ? structuredClone(state.currencyState)
    : null;
  try {
    // Initialize on first turn
    if (!updatedCurrencyState) {
      updatedCurrencyState = initializeCurrencyState(ALL_FACTIONS as unknown as FactionId[]);
    }

    // Build currency events from this turn's happenings
    const currencyEvents: CurrencyEvent[] = [];

    // Sanctions → negative pressure
    for (const fid of sanctionsChangedFactions) {
      currencyEvents.push({
        eventId: `curr-sanc-${fid}-${state.currentTurn}`,
        eventType: 'sanctions',
        affectedNation: fid,
        rateImpactPercent: 0, // engine rolls within config range
        description: `New sanctions imposed on ${FACTION_INFO[fid]?.name}`,
      });
    }

    // Trade deals → positive pressure
    for (const fid of tradeDealFactions) {
      currencyEvents.push({
        eventId: `curr-trade-${fid}-${state.currentTurn}`,
        eventType: 'trade_deal',
        affectedNation: fid,
        rateImpactPercent: 0,
        description: `Trade agreement boosts ${FACTION_INFO[fid]?.name} currency`,
      });
    }

    // Active combat → currency pressure (conflict zones weaken, safe havens strengthen)
    for (const fid of activeCombatFactions) {
      currencyEvents.push({
        eventId: `curr-mil-${fid}-${state.currentTurn}`,
        eventType: 'military_conflict',
        affectedNation: fid,
        rateImpactPercent: 0,
        description: `Military conflict affects ${FACTION_INFO[fid]?.name} currency`,
      });
    }

    // High inflation → currency weakening
    for (const fid of ALL_FACTIONS) {
      const ns = currentNS[fid];
      if (ns && ns.inflation > 15) {
        currencyEvents.push({
          eventId: `curr-infl-${fid}-${state.currentTurn}`,
          eventType: 'inflation',
          affectedNation: fid,
          rateImpactPercent: 0,
          description: `High inflation (${Math.round(ns.inflation)}%) weakens ${FACTION_INFO[fid]?.name} currency`,
        });
      }
    }

    // Chaotic events → market shock on affected nations
    if (updatedChaoticState) {
      for (const evt of updatedChaoticState.activeEvents) {
        if (evt.active && evt.severity >= 5) {
          currencyEvents.push({
            eventId: `curr-chaos-${evt.id}`,
            eventType: 'market_shock',
            affectedNation: evt.targetNation,
            rateImpactPercent: 0,
            description: `${evt.name} causes currency shock`,
          });
        }
      }
    }

    // Process end-of-turn currency updates (uses a simple linear congruential RNG)
    const simpleRng = { next: () => Math.random() };
    updatedCurrencyState = processEndOfTurnCurrency(updatedCurrencyState, currencyEvents, simpleRng);

    // Generate forex headlines for top movers
    const topMovers = getCurrencyTopMovers(updatedCurrencyState, 3);
    for (const mover of topMovers) {
      if (Math.abs(mover.change) > 3) {
        const dir = mover.change > 0 ? 'weakens' : 'strengthens';
        const rec = updatedCurrencyState.records[mover.nation];
        if (rec) {
          headlines.push({
            text: `FOREX: ${rec.currencyCode} ${dir} ${Math.abs(mover.change).toFixed(4)}% against USD`,
            perspective: 'western',
            severity: Math.abs(mover.change) > 10 ? 'critical' : 'medium',
          });
        }
      }
    }
  } catch { /* Currency integration non-critical */ }

  // ── Scenario History Recording (FR-3603) ──────────────────────────────
  let updatedArchive: ScenarioHistoryArchive | null = scenarioArchive ?? null;
  try {
    if (updatedArchive) {
      const scenarioIntegration = new ScenarioTurnIntegration();
      const recordInput: RecordTurnInput = {
        archive: updatedArchive,
        gameState: {
          ...state,
          nationStates: currentNS,
          relationshipMatrix: currentRel,
          marketState: updatedMarketState,
        },
        turn: state.currentTurn as number,
        actions: aiActions.map((a, i) => ({
          actionId: `ai-${i}`,
          factionId: 'ai' as FactionId,
          actionType: 'ai_action',
          description: a,
          cost: 0,
        })),
        events: headlines.map((h, i) => ({
          eventId: `evt-${state.currentTurn}-${i}`,
          turn: state.currentTurn as number,
          eventType: h.severity === 'critical' ? 'crisis' : 'normal',
          description: h.text,
          affectedFactions: [] as FactionId[],
        })),
      };
      const recordResult = scenarioIntegration.recordTurn(recordInput);
      updatedArchive = recordResult.archive;
    }
  } catch {
    // History recording is non-critical — continue if it fails
  }

  // Generate global headlines
  const maxTension = findMaxTension(currentRel);
  if (maxTension.tension > 80) {
    headlines.push({
      text: `Tensions between ${FACTION_INFO[maxTension.a]?.name} and ${FACTION_INFO[maxTension.b]?.name} reach dangerous levels`,
      perspective: 'intel',
      severity: 'critical',
    });
  }

  // Check game-over conditions
  let gameOver = false;
  let gameOverReason: string | null = null;

  if (pn && pn.stability <= 0) {
    gameOver = true;
    gameOverReason = 'Your government has collapsed due to instability. Game Over.';
  }
  if ((state.currentTurn as number) >= GAME_CONFIG.meta.MAX_TURNS) {
    gameOver = true;
    gameOverReason = 'The simulation has reached its conclusion after 60 months.';
  }

  // Check for victory
  if (pn && !gameOver) {
    if (pn.diplomaticInfluence >= 95 && pn.stability >= 70) {
      gameOver = true;
      gameOverReason = `${FACTION_INFO[state.playerFaction]?.name} achieves Diplomatic Victory! Your nation commands unparalleled global influence.`;
    }
    if (pn.militaryReadiness >= 95 && pn.techLevel >= 90) {
      gameOver = true;
      gameOverReason = `${FACTION_INFO[state.playerFaction]?.name} achieves Military Supremacy! Your forces are unmatched.`;
    }
    if (pn.treasury >= 2000 && pn.gdp >= 30000) {
      gameOver = true;
      gameOverReason = `${FACTION_INFO[state.playerFaction]?.name} achieves Economic Hegemony! Your economy dominates the world.`;
    }
  }

  // ── Scenario Scoring at Game End (FR-3601) ────────────────────────────
  let scenarioScore: ScenarioScore | null = null;
  if (gameOver && updatedArchive) {
    try {
      const scenarioIntegration = new ScenarioTurnIntegration();
      const completeInput: CompleteScenarioInput = {
        archive: updatedArchive,
        gameState: {
          ...state,
          nationStates: currentNS,
          relationshipMatrix: currentRel,
          marketState: updatedMarketState,
        },
        endReason: gameOverReason ?? 'unknown',
      };
      const result = scenarioIntegration.completeScenario(completeInput);
      updatedArchive = result.archive;
      scenarioScore = result.score;
    } catch {
      // Scoring is non-critical — continue if it fails
    }
  }

  return {
    headlines,
    aiActions,
    stateChanges,
    gameOver,
    gameOverReason,
    marketState: updatedMarketState,
    scenarioArchive: updatedArchive,
    scenarioScore,
    innovationState: updatedInnovationState,
    nationalPolicies: updatedPolicies,
    civilWarStates: updatedCivilWar,
    economicStates: updatedEconomicStates,
    chaoticEventState: updatedChaoticState,
    currencyState: updatedCurrencyState,
    multiVectorSummary,
    emergentTechState: updatedEmergentTechState,
    nationStates: currentNS,
    relationshipMatrix: currentRel,
  };
}

function findMaxTension(rel: GameState['relationshipMatrix']): { a: FactionId; b: FactionId; tension: number } {
  let max = { a: FID.US as FactionId, b: FID.China as FactionId, tension: 0 };
  for (const a of ALL_FACTIONS) {
    for (const b of ALL_FACTIONS) {
      if (a >= b) continue;
      const t = rel[a]?.[b] ?? 0;
      if (t > max.tension) max = { a, b, tension: t };
    }
  }
  return max;
}
