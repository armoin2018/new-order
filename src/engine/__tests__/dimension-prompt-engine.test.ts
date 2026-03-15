/**
 * AI Dimension Prompt Engine — Test Suite
 *
 * 40+ tests covering initialisation, updates, template-variable resolution,
 * version revert, line-based diff, and factory reset.
 *
 * @see FR-4001, FR-4002, FR-4003, FR-4004
 */

import { describe, it, expect } from 'vitest';
import {
  initializeDimensionPrompts,
  getDefaultPrompt,
  updatePrompt,
  resolveTemplateVariables,
  revertToVersion,
  diffVersions,
  resetToDefault,
} from '@/engine/dimension-prompt-engine';
import {
  PROMPT_DIMENSIONS,
  PROMPT_TEMPLATE_VARIABLES,
  type DimensionPromptState,
  type PromptVariableContext,
} from '@/data/types';
import { promptsConfig } from '@/engine/config/prompts';

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeContext(overrides: Partial<PromptVariableContext> = {}): PromptVariableContext {
  return {
    nationName: 'TestNation',
    turnNumber: 5,
    gameState: 'stable',
    leaderProfile: 'pragmatic leader',
    dimensionData: 'dim-data-blob',
    recentEvents: 'border skirmish',
    ...overrides,
  };
}

// ── initializeDimensionPrompts ──────────────────────────────────────────────

describe('initializeDimensionPrompts', () => {
  it('should return a state with exactly 10 dimensions', () => {
    const state = initializeDimensionPrompts();
    expect(Object.keys(state.prompts)).toHaveLength(PROMPT_DIMENSIONS.length);
  });

  it('should contain every dimension key', () => {
    const state = initializeDimensionPrompts();
    for (const dim of PROMPT_DIMENSIONS) {
      expect(state.prompts[dim]).toBeDefined();
    }
  });

  it('should initialise each dimension with version 1', () => {
    const state = initializeDimensionPrompts();
    for (const dim of PROMPT_DIMENSIONS) {
      expect(state.prompts[dim].version).toBe(1);
    }
  });

  it('should set promptText to the default from config', () => {
    const state = initializeDimensionPrompts();
    for (const dim of PROMPT_DIMENSIONS) {
      expect(state.prompts[dim].promptText).toBe(promptsConfig.defaultPrompts[dim]);
    }
  });

  it('should populate characterCount correctly', () => {
    const state = initializeDimensionPrompts();
    for (const dim of PROMPT_DIMENSIONS) {
      expect(state.prompts[dim].characterCount).toBe(
        promptsConfig.defaultPrompts[dim].length,
      );
    }
  });

  it('should seed version history with a single entry', () => {
    const state = initializeDimensionPrompts();
    for (const dim of PROMPT_DIMENSIONS) {
      expect(state.prompts[dim].versions).toHaveLength(1);
      expect(state.prompts[dim].versions[0]!.version).toBe(1);
    }
  });

  it('should set dimensionId matching the key', () => {
    const state = initializeDimensionPrompts();
    for (const dim of PROMPT_DIMENSIONS) {
      expect(state.prompts[dim].dimensionId).toBe(dim);
    }
  });

  it('should set a valid ISO-8601 lastModified timestamp', () => {
    const state = initializeDimensionPrompts();
    for (const dim of PROMPT_DIMENSIONS) {
      expect(Date.parse(state.prompts[dim].lastModified)).not.toBeNaN();
    }
  });

  it('should detect template variables in each default prompt', () => {
    const state = initializeDimensionPrompts();
    for (const dim of PROMPT_DIMENSIONS) {
      expect(state.prompts[dim].templateVariables.length).toBeGreaterThan(0);
    }
  });

  it('should only list variables that actually appear in the text', () => {
    const state = initializeDimensionPrompts();
    for (const dim of PROMPT_DIMENSIONS) {
      for (const v of state.prompts[dim].templateVariables) {
        expect(state.prompts[dim].promptText).toContain(v);
      }
    }
  });
});

// ── getDefaultPrompt ────────────────────────────────────────────────────────

describe('getDefaultPrompt', () => {
  it('should return a non-empty string for every dimension', () => {
    for (const dim of PROMPT_DIMENSIONS) {
      expect(getDefaultPrompt(dim).length).toBeGreaterThan(0);
    }
  });

  it('should match the config value', () => {
    for (const dim of PROMPT_DIMENSIONS) {
      expect(getDefaultPrompt(dim)).toBe(promptsConfig.defaultPrompts[dim]);
    }
  });
});

// ── updatePrompt ────────────────────────────────────────────────────────────

describe('updatePrompt', () => {
  let state: DimensionPromptState;

  it('should update the prompt text for the targeted dimension', () => {
    state = initializeDimensionPrompts();
    const next = updatePrompt(state, 'diplomacy', 'New diplomacy prompt');
    expect(next.prompts.diplomacy.promptText).toBe('New diplomacy prompt');
  });

  it('should increment the version number', () => {
    state = initializeDimensionPrompts();
    const next = updatePrompt(state, 'markets', 'Updated markets');
    expect(next.prompts.markets.version).toBe(2);
  });

  it('should append to version history', () => {
    state = initializeDimensionPrompts();
    const next = updatePrompt(state, 'currency', 'Currency v2');
    expect(next.prompts.currency.versions).toHaveLength(2);
    expect(next.prompts.currency.versions[1]!.text).toBe('Currency v2');
  });

  it('should update characterCount', () => {
    state = initializeDimensionPrompts();
    const text = 'Short';
    const next = updatePrompt(state, 'military', text);
    expect(next.prompts.military.characterCount).toBe(text.length);
  });

  it('should not mutate the original state', () => {
    state = initializeDimensionPrompts();
    const original = state.prompts.diplomacy.promptText;
    updatePrompt(state, 'diplomacy', 'Changed');
    expect(state.prompts.diplomacy.promptText).toBe(original);
  });

  it('should leave other dimensions unchanged', () => {
    state = initializeDimensionPrompts();
    const next = updatePrompt(state, 'education', 'New edu');
    expect(next.prompts.military.promptText).toBe(state.prompts.military.promptText);
  });

  it('should update lastModified', () => {
    state = initializeDimensionPrompts();
    const before = state.prompts.religion.lastModified;
    // Small delay not needed — timestamp precision is fine
    const next = updatePrompt(state, 'religion', 'Updated religion');
    expect(Date.parse(next.prompts.religion.lastModified)).toBeGreaterThanOrEqual(
      Date.parse(before),
    );
  });

  it('should re-detect template variables', () => {
    state = initializeDimensionPrompts();
    const next = updatePrompt(state, 'technology', 'Hello {{nationName}}');
    expect(next.prompts.technology.templateVariables).toContain('{{nationName}}');
  });

  it('should prune versions to maxVersions when exceeded', () => {
    state = initializeDimensionPrompts();
    let s = state;
    for (let i = 0; i < 25; i++) {
      s = updatePrompt(s, 'indexes', `Version ${i + 2}`);
    }
    expect(s.prompts.indexes.versions.length).toBeLessThanOrEqual(
      promptsConfig.maxVersions,
    );
  });

  it('should keep the most recent versions when pruning', () => {
    state = initializeDimensionPrompts();
    let s = state;
    for (let i = 0; i < 25; i++) {
      s = updatePrompt(s, 'indexes', `Version ${i + 2}`);
    }
    const last = s.prompts.indexes.versions[s.prompts.indexes.versions.length - 1]!;
    expect(last.version).toBe(26); // 1 initial + 25 updates
  });
});

// ── resolveTemplateVariables ────────────────────────────────────────────────

describe('resolveTemplateVariables', () => {
  const ctx = makeContext();

  it('should replace {{nationName}}', () => {
    const out = resolveTemplateVariables('Hello {{nationName}}', ctx);
    expect(out).toBe('Hello TestNation');
  });

  it('should replace {{turnNumber}}', () => {
    const out = resolveTemplateVariables('Turn {{turnNumber}}', ctx);
    expect(out).toBe('Turn 5');
  });

  it('should replace {{gameState}}', () => {
    const out = resolveTemplateVariables('State: {{gameState}}', ctx);
    expect(out).toBe('State: stable');
  });

  it('should replace {{leaderProfile}}', () => {
    const out = resolveTemplateVariables('Leader: {{leaderProfile}}', ctx);
    expect(out).toBe('Leader: pragmatic leader');
  });

  it('should replace {{dimensionData}}', () => {
    const out = resolveTemplateVariables('Data: {{dimensionData}}', ctx);
    expect(out).toBe('Data: dim-data-blob');
  });

  it('should replace {{recentEvents}}', () => {
    const out = resolveTemplateVariables('Events: {{recentEvents}}', ctx);
    expect(out).toBe('Events: border skirmish');
  });

  it('should replace all six variables in a single string', () => {
    const template = PROMPT_TEMPLATE_VARIABLES.join(' ');
    const out = resolveTemplateVariables(template, ctx);
    expect(out).not.toContain('{{');
  });

  it('should leave unknown variables untouched', () => {
    const out = resolveTemplateVariables('{{unknownVar}} {{nationName}}', ctx);
    expect(out).toContain('{{unknownVar}}');
    expect(out).toContain('TestNation');
  });

  it('should handle empty prompt text', () => {
    expect(resolveTemplateVariables('', ctx)).toBe('');
  });

  it('should handle text with no variables', () => {
    const plain = 'No variables here.';
    expect(resolveTemplateVariables(plain, ctx)).toBe(plain);
  });

  it('should handle multiple occurrences of the same variable', () => {
    const out = resolveTemplateVariables('{{nationName}} vs {{nationName}}', ctx);
    expect(out).toBe('TestNation vs TestNation');
  });

  it('should convert turnNumber to string', () => {
    const out = resolveTemplateVariables('{{turnNumber}}', makeContext({ turnNumber: 42 }));
    expect(out).toBe('42');
  });
});

// ── revertToVersion ─────────────────────────────────────────────────────────

describe('revertToVersion', () => {
  it('should revert to a previous version text', () => {
    let s = initializeDimensionPrompts();
    const originalText = s.prompts.diplomacy.promptText;
    s = updatePrompt(s, 'diplomacy', 'V2 text');
    s = updatePrompt(s, 'diplomacy', 'V3 text');
    const reverted = revertToVersion(s, 'diplomacy', 1);
    expect(reverted.prompts.diplomacy.promptText).toBe(originalText);
  });

  it('should create a new version entry for the revert', () => {
    let s = initializeDimensionPrompts();
    s = updatePrompt(s, 'markets', 'V2');
    const reverted = revertToVersion(s, 'markets', 1);
    expect(reverted.prompts.markets.version).toBe(3);
  });

  it('should return unchanged state for invalid version', () => {
    const s = initializeDimensionPrompts();
    const result = revertToVersion(s, 'currency', 999);
    expect(result).toBe(s);
  });

  it('should not mutate the original state', () => {
    let s = initializeDimensionPrompts();
    s = updatePrompt(s, 'technology', 'V2');
    const snapshot = s.prompts.technology.promptText;
    revertToVersion(s, 'technology', 1);
    expect(s.prompts.technology.promptText).toBe(snapshot);
  });

  it('should append revert entry to version history', () => {
    let s = initializeDimensionPrompts();
    s = updatePrompt(s, 'education', 'V2');
    const reverted = revertToVersion(s, 'education', 1);
    const last =
      reverted.prompts.education.versions[
        reverted.prompts.education.versions.length - 1
      ]!;
    expect(last.text).toBe(getDefaultPrompt('education'));
  });

  it('should update characterCount after revert', () => {
    let s = initializeDimensionPrompts();
    s = updatePrompt(s, 'religion', 'Short');
    const reverted = revertToVersion(s, 'religion', 1);
    expect(reverted.prompts.religion.characterCount).toBe(
      getDefaultPrompt('religion').length,
    );
  });
});

// ── diffVersions ────────────────────────────────────────────────────────────

describe('diffVersions', () => {
  it('should detect added lines', () => {
    let s = initializeDimensionPrompts();
    s = updatePrompt(s, 'diplomacy', 'line1\nline2\nline3');
    s = updatePrompt(s, 'diplomacy', 'line1\nline2\nline3\nline4');
    const diff = diffVersions(s.prompts.diplomacy, 2, 3);
    expect(diff).not.toBeNull();
    expect(diff!.added).toContain('line4');
  });

  it('should detect removed lines', () => {
    let s = initializeDimensionPrompts();
    s = updatePrompt(s, 'markets', 'alpha\nbeta\ngamma');
    s = updatePrompt(s, 'markets', 'alpha\ngamma');
    const diff = diffVersions(s.prompts.markets, 2, 3);
    expect(diff).not.toBeNull();
    expect(diff!.removed).toContain('beta');
  });

  it('should return empty arrays when versions are identical', () => {
    let s = initializeDimensionPrompts();
    s = updatePrompt(s, 'currency', 'same text');
    s = updatePrompt(s, 'currency', 'same text');
    const diff = diffVersions(s.prompts.currency, 2, 3);
    expect(diff).not.toBeNull();
    expect(diff!.added).toHaveLength(0);
    expect(diff!.removed).toHaveLength(0);
  });

  it('should return null if versionA does not exist', () => {
    const s = initializeDimensionPrompts();
    expect(diffVersions(s.prompts.technology, 999, 1)).toBeNull();
  });

  it('should return null if versionB does not exist', () => {
    const s = initializeDimensionPrompts();
    expect(diffVersions(s.prompts.technology, 1, 999)).toBeNull();
  });

  it('should return null if both versions are invalid', () => {
    const s = initializeDimensionPrompts();
    expect(diffVersions(s.prompts.military, 100, 200)).toBeNull();
  });

  it('should handle multi-line diff correctly', () => {
    let s = initializeDimensionPrompts();
    s = updatePrompt(s, 'education', 'a\nb\nc');
    s = updatePrompt(s, 'education', 'b\nc\nd');
    const diff = diffVersions(s.prompts.education, 2, 3);
    expect(diff!.added).toContain('d');
    expect(diff!.removed).toContain('a');
  });
});

// ── resetToDefault ──────────────────────────────────────────────────────────

describe('resetToDefault', () => {
  it('should restore the default prompt text', () => {
    let s = initializeDimensionPrompts();
    s = updatePrompt(s, 'diplomacy', 'Custom text');
    const reset = resetToDefault(s, 'diplomacy');
    expect(reset.prompts.diplomacy.promptText).toBe(getDefaultPrompt('diplomacy'));
  });

  it('should reset version to 1', () => {
    let s = initializeDimensionPrompts();
    s = updatePrompt(s, 'markets', 'Custom');
    const reset = resetToDefault(s, 'markets');
    expect(reset.prompts.markets.version).toBe(1);
  });

  it('should clear version history to a single entry', () => {
    let s = initializeDimensionPrompts();
    s = updatePrompt(s, 'currency', 'A');
    s = updatePrompt(s, 'currency', 'B');
    const reset = resetToDefault(s, 'currency');
    expect(reset.prompts.currency.versions).toHaveLength(1);
  });

  it('should not mutate the original state', () => {
    let s = initializeDimensionPrompts();
    s = updatePrompt(s, 'technology', 'Custom');
    const snapshot = s.prompts.technology.promptText;
    resetToDefault(s, 'technology');
    expect(s.prompts.technology.promptText).toBe(snapshot);
  });

  it('should leave other dimensions unchanged', () => {
    let s = initializeDimensionPrompts();
    s = updatePrompt(s, 'military', 'Custom');
    s = updatePrompt(s, 'religion', 'Custom religion');
    const reset = resetToDefault(s, 'military');
    expect(reset.prompts.religion.promptText).toBe('Custom religion');
  });

  it('should reset characterCount to match default text', () => {
    let s = initializeDimensionPrompts();
    s = updatePrompt(s, 'education', 'X');
    const reset = resetToDefault(s, 'education');
    expect(reset.prompts.education.characterCount).toBe(
      getDefaultPrompt('education').length,
    );
  });

  it('should re-detect template variables from default text', () => {
    let s = initializeDimensionPrompts();
    s = updatePrompt(s, 'decisionModel', 'No vars');
    const reset = resetToDefault(s, 'decisionModel');
    expect(reset.prompts.decisionModel.templateVariables.length).toBeGreaterThan(0);
  });

  it('should set dimensionId correctly after reset', () => {
    let s = initializeDimensionPrompts();
    s = updatePrompt(s, 'decisionSelection', 'Changed');
    const reset = resetToDefault(s, 'decisionSelection');
    expect(reset.prompts.decisionSelection.dimensionId).toBe('decisionSelection');
  });
});
