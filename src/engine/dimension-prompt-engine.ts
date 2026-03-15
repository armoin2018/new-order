/**
 * New Order — AI Dimension Prompt Engine
 *
 * Pure-function module for managing AI prompt templates across the 10
 * simulation dimensions.  All functions are side-effect free and return
 * new state objects (immutable update pattern).
 *
 * @see FR-4001 — Prompt Dimensions
 * @see FR-4002 — Default Prompt Templates
 * @see FR-4003 — Template Variable Substitution
 * @see FR-4004 — Prompt Version History
 */

import type {
  PromptDimension,
  DimensionPromptTemplate,
  DimensionPromptState,
  PromptVariableContext,
} from '@/data/types';
import { PROMPT_DIMENSIONS, PROMPT_TEMPLATE_VARIABLES } from '@/data/types';
import { promptsConfig } from '@/engine/config/prompts';

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Detect which template variables appear in a prompt string. */
function detectVariables(text: string): readonly string[] {
  return PROMPT_TEMPLATE_VARIABLES.filter((v) => text.includes(v));
}

/** Create a fresh ISO-8601 timestamp. */
function now(): string {
  return new Date().toISOString();
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Create the initial {@link DimensionPromptState} populated with the default
 * prompt for every dimension defined in the config.
 *
 * @see FR-4001
 * @returns A fully-initialised prompt state object.
 */
export function initializeDimensionPrompts(): DimensionPromptState {
  const prompts = {} as Record<PromptDimension, DimensionPromptTemplate>;
  const ts = now();

  for (const dim of PROMPT_DIMENSIONS) {
    const text = promptsConfig.defaultPrompts[dim];
    prompts[dim] = {
      dimensionId: dim,
      promptText: text,
      templateVariables: detectVariables(text),
      version: 1,
      lastModified: ts,
      characterCount: text.length,
      versions: [{ version: 1, text, timestamp: ts }],
    };
  }

  return { prompts };
}

/**
 * Return the default prompt text for a given dimension.
 *
 * @see FR-4002
 */
export function getDefaultPrompt(dimension: PromptDimension): string {
  return promptsConfig.defaultPrompts[dimension];
}

/**
 * Immutably update the prompt text for a dimension.  A new version entry is
 * appended and the history is pruned to {@link promptsConfig.maxVersions}.
 *
 * @see FR-4002
 * @see FR-4004
 */
export function updatePrompt(
  state: DimensionPromptState,
  dimension: PromptDimension,
  newText: string,
): DimensionPromptState {
  const existing = state.prompts[dimension];
  const nextVersion = existing.version + 1;
  const ts = now();

  const updatedVersions: DimensionPromptTemplate['versions'] = [
    ...existing.versions,
    { version: nextVersion, text: newText, timestamp: ts },
  ];

  // Prune oldest entries when exceeding max
  const pruned =
    updatedVersions.length > promptsConfig.maxVersions
      ? updatedVersions.slice(updatedVersions.length - promptsConfig.maxVersions)
      : updatedVersions;

  const updated: DimensionPromptTemplate = {
    ...existing,
    promptText: newText,
    templateVariables: detectVariables(newText),
    version: nextVersion,
    lastModified: ts,
    characterCount: newText.length,
    versions: pruned,
  };

  return {
    ...state,
    prompts: { ...state.prompts, [dimension]: updated },
  };
}

/**
 * Replace all recognised template variables in {@link promptText} with the
 * corresponding values from {@link context}.  Unrecognised or absent
 * variables are left as-is.
 *
 * @see FR-4003
 */
export function resolveTemplateVariables(
  promptText: string,
  context: PromptVariableContext,
): string {
  const map: Record<string, string> = {
    '{{nationName}}': context.nationName,
    '{{turnNumber}}': String(context.turnNumber),
    '{{gameState}}': context.gameState,
    '{{leaderProfile}}': context.leaderProfile,
    '{{dimensionData}}': context.dimensionData,
    '{{recentEvents}}': context.recentEvents,
  };

  let result = promptText;
  for (const [token, value] of Object.entries(map)) {
    result = result.replaceAll(token, value);
  }
  return result;
}

/**
 * Revert a dimension's prompt to a previously-stored version.  If the
 * requested version does not exist, the state is returned unchanged.
 *
 * @see FR-4004
 */
export function revertToVersion(
  state: DimensionPromptState,
  dimension: PromptDimension,
  targetVersion: number,
): DimensionPromptState {
  const existing = state.prompts[dimension];
  const target = existing.versions.find((v) => v.version === targetVersion);
  if (!target) return state;

  const ts = now();
  const nextVersion = existing.version + 1;

  const updatedVersions: DimensionPromptTemplate['versions'] = [
    ...existing.versions,
    { version: nextVersion, text: target.text, timestamp: ts },
  ];

  const pruned =
    updatedVersions.length > promptsConfig.maxVersions
      ? updatedVersions.slice(updatedVersions.length - promptsConfig.maxVersions)
      : updatedVersions;

  const updated: DimensionPromptTemplate = {
    ...existing,
    promptText: target.text,
    templateVariables: detectVariables(target.text),
    version: nextVersion,
    lastModified: ts,
    characterCount: target.text.length,
    versions: pruned,
  };

  return {
    ...state,
    prompts: { ...state.prompts, [dimension]: updated },
  };
}

/**
 * Perform a simple line-based diff between two stored versions.  Returns
 * `null` if either version cannot be found.
 *
 * @see FR-4004
 */
export function diffVersions(
  template: DimensionPromptTemplate,
  versionA: number,
  versionB: number,
): { added: string[]; removed: string[] } | null {
  const a = template.versions.find((v) => v.version === versionA);
  const b = template.versions.find((v) => v.version === versionB);
  if (!a || !b) return null;

  const linesA = a.text.split('\n');
  const linesB = b.text.split('\n');

  const setA = new Set(linesA);
  const setB = new Set(linesB);

  const added = linesB.filter((line) => !setA.has(line));
  const removed = linesA.filter((line) => !setB.has(line));

  return { added, removed };
}

/**
 * Reset a dimension's prompt back to its factory default and clear version
 * history to a single entry.
 *
 * @see FR-4001
 * @see FR-4002
 */
export function resetToDefault(
  state: DimensionPromptState,
  dimension: PromptDimension,
): DimensionPromptState {
  const defaultText = promptsConfig.defaultPrompts[dimension];
  const ts = now();

  const fresh: DimensionPromptTemplate = {
    dimensionId: dimension,
    promptText: defaultText,
    templateVariables: detectVariables(defaultText),
    version: 1,
    lastModified: ts,
    characterCount: defaultText.length,
    versions: [{ version: 1, text: defaultText, timestamp: ts }],
  };

  return {
    ...state,
    prompts: { ...state.prompts, [dimension]: fresh },
  };
}
