/**
 * New Order: Global Simulation Engine — Central Configuration Constants
 *
 * Single source of truth for ALL game constants, formula weights, thresholds,
 * decay rates, and modifiers. Imported by every engine subsystem.
 *
 * Organized into domain-specific modules for maintainability.
 * Each domain file exports individual section configs that are composed here.
 *
 * @see NFR-204 — All game formulas shall be configurable via constants in a
 * dedicated config file. Formula tuning requires no code changes.
 */

import { metaConfig } from './meta';
import { stabilityConfig, powerBaseConfig } from './stability';
import { nuclearConfig, combatConfig, militaryConfig } from './military';
import { aiDecisionConfig, aiDifficultyConfig, leaderCreationConfig } from './ai';
import { intelligenceConfig, intelReliabilityConfig, doubleAgentConfig } from './intelligence';
import { psychologyConfig } from './psychology';
import { infoWarConfig, headlinesConfig, greyZoneConfig } from './information-warfare';
import { economyConfig, financialConfig, marketReactionsConfig, technologyConfig } from './economy';
import { resourcesConfig, proxyConfig, diplomacyConfig, unResolutionsConfig } from './geopolitics';
import { advisoryConfig, victoryLossConfig, postGameAnalysisConfig, scenarioSelectionConfig, tutorialConfig, moddingConfig, visualizationConfig } from './systems';
import { temporalConfig } from './temporal';
import { currencyConfig } from './currency';
import { budgetConfig } from './budget';
import { promptsConfig } from './prompts';
import { rankingConfig } from './ranking';
import { aiConfigConfig } from './ai-config';
import { electionConfig } from './election';
import { persistenceConfig } from './persistence';
import { webGatheringConfig } from './web-gathering';
import { queueConfig } from './queue';
import { lifecycleConfig } from './lifecycle';
import { nationRosterConfig } from './nation-roster';
import { mapViewConfig } from './map-view';
import { actionSlateConfig } from './action-slate';
import { innovationConfig } from './innovation';
import { policyConfig } from './policy';
import { civilWarConfig } from './civil-war';
import { liveDataConfig } from './live-data';
import { macroEconomicConfig } from './macro-economy';

export const GAME_CONFIG = {
  meta: metaConfig,
  stability: stabilityConfig,
  powerBase: powerBaseConfig,
  nuclear: nuclearConfig,
  combat: combatConfig,
  military: militaryConfig,
  aiDecision: aiDecisionConfig,
  aiDifficulty: aiDifficultyConfig,
  leaderCreation: leaderCreationConfig,
  intelligence: intelligenceConfig,
  intelReliability: intelReliabilityConfig,
  doubleAgent: doubleAgentConfig,
  psychology: psychologyConfig,
  infoWar: infoWarConfig,
  headlines: headlinesConfig,
  greyZone: greyZoneConfig,
  economy: economyConfig,
  financial: financialConfig,
  marketReactions: marketReactionsConfig,
  technology: technologyConfig,
  resources: resourcesConfig,
  proxy: proxyConfig,
  diplomacy: diplomacyConfig,
  unResolutions: unResolutionsConfig,
  advisory: advisoryConfig,
  victoryLoss: victoryLossConfig,
  postGameAnalysis: postGameAnalysisConfig,
  scenarioSelection: scenarioSelectionConfig,
  tutorial: tutorialConfig,
  modding: moddingConfig,
  visualization: visualizationConfig,
  temporal: temporalConfig,
  currency: currencyConfig,
  budget: budgetConfig,
  prompts: promptsConfig,
  ranking: rankingConfig,
  aiConfig: aiConfigConfig,
  election: electionConfig,
  persistence: persistenceConfig,
  webGathering: webGatheringConfig,
  queue: queueConfig,
  lifecycle: lifecycleConfig,
  nationRoster: nationRosterConfig,
  mapView: mapViewConfig,
  actionSlate: actionSlateConfig,
  innovation: innovationConfig,
  policy: policyConfig,
  civilWar: civilWarConfig,
  liveData: liveDataConfig,
  macroEconomy: macroEconomicConfig,
} as const;

