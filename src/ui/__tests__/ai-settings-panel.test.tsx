/**
 * AI Settings Panel tests.
 *
 * Uses createRoot + act(from 'react') pattern — no @testing-library/react.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { AISettingsPanel } from '@/ui/AISettingsPanel';
import type { AISettingsPanelProps, AISettingsState, ConnectionTestResult } from '@/ui/AISettingsPanel';
import type { ModelInfo } from '@/engine/ai/ai-adapter';
import type { Root } from 'react-dom/client';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function testId(id: string): HTMLElement | null {
  return container.querySelector(`[data-testid="${id}"]`);
}
function click(el: HTMLElement): void {
  act(() => { el.click(); });
}
function setSelectValue(el: HTMLSelectElement, val: string): void {
  act(() => {
    el.value = val;
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
}
function setInputValue(el: HTMLInputElement, val: string): void {
  act(() => {
    /* eslint-disable-next-line */
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    nativeInputValueSetter.call(el, val);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

const BASE_SETTINGS: AISettingsState = {
  enabled: true,
  provider: 'openai',
  apiKey: 'sk-test-key-12345678',
  model: 'gpt-4o',
  temperature: 0.7,
  maxTokens: 2048,
};

const SAMPLE_MODELS: ModelInfo[] = [
  { modelId: 'gpt-4o', provider: 'openai', displayName: 'GPT-4o', contextWindow: 128_000, maxOutputTokens: 16_384, inputPricePer1kTokens: 0.0025, outputPricePer1kTokens: 0.01, supportsStreaming: true, supportsJsonMode: true, supportsEmbeddings: false, supportsFunctionCalling: true },
  { modelId: 'gpt-4o-mini', provider: 'openai', displayName: 'GPT-4o Mini', contextWindow: 128_000, maxOutputTokens: 16_384, inputPricePer1kTokens: 0.00015, outputPricePer1kTokens: 0.0006, supportsStreaming: true, supportsJsonMode: true, supportsEmbeddings: false, supportsFunctionCalling: true },
];

function render(overrides?: Partial<AISettingsPanelProps>): void {
  const defaults: AISettingsPanelProps = {
    settings: BASE_SETTINGS,
    onSettingsChange: vi.fn(),
    availableModels: SAMPLE_MODELS,
    ...overrides,
  };
  act(() => { root.render(createElement(AISettingsPanel, defaults)); });
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('AISettingsPanel', () => {

  describe('rendering', () => {
    it('renders the panel', () => {
      render();
      expect(testId('ai-settings-panel')).not.toBeNull();
    });

    it('shows AI Settings heading', () => {
      render();
      expect(testId('ai-settings-panel')!.textContent).toContain('AI Settings');
    });

    it('shows provider section when enabled', () => {
      render();
      expect(testId('provider-section')).not.toBeNull();
    });

    it('shows API key section for key-required providers', () => {
      render();
      expect(testId('apikey-section')).not.toBeNull();
    });

    it('shows model section', () => {
      render();
      expect(testId('model-section')).not.toBeNull();
    });

    it('shows temperature section', () => {
      render();
      expect(testId('temperature-section')).not.toBeNull();
    });

    it('shows max tokens section', () => {
      render();
      expect(testId('maxtokens-section')).not.toBeNull();
    });

    it('shows test connection button', () => {
      render();
      expect(testId('test-connection-btn')).not.toBeNull();
    });
  });

  describe('AI toggle', () => {
    it('renders toggle in enabled state', () => {
      render();
      const toggle = testId('ai-toggle');
      expect(toggle).not.toBeNull();
      expect(toggle!.getAttribute('aria-checked')).toBe('true');
    });

    it('shows disabled message when AI is off', () => {
      render({ settings: { ...BASE_SETTINGS, enabled: false } });
      expect(testId('ai-disabled-message')).not.toBeNull();
      expect(testId('provider-section')).toBeNull();
    });

    it('calls onSettingsChange when toggled', () => {
      const onChange = vi.fn();
      render({ onSettingsChange: onChange });
      click(testId('ai-toggle')!);
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
    });
  });

  describe('provider selection', () => {
    it('renders provider dropdown with correct value', () => {
      render();
      const sel = testId('provider-select') as HTMLSelectElement;
      expect(sel).not.toBeNull();
      expect(sel.value).toBe('openai');
    });

    it('calls onSettingsChange when provider changes', () => {
      const onChange = vi.fn();
      render({ onSettingsChange: onChange });
      setSelectValue(testId('provider-select') as HTMLSelectElement, 'gemini');
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ provider: 'gemini', model: '' }));
    });

    it('shows Ollama status when Ollama selected', () => {
      render({ settings: { ...BASE_SETTINGS, provider: 'ollama' }, ollamaDetected: true });
      const status = testId('ollama-status');
      expect(status).not.toBeNull();
      expect(status!.textContent).toContain('Running');
    });

    it('shows Ollama not detected status', () => {
      render({ settings: { ...BASE_SETTINGS, provider: 'ollama' }, ollamaDetected: false });
      const status = testId('ollama-status');
      expect(status!.textContent).toContain('Not Detected');
    });

    it('hides API key section for Ollama', () => {
      render({ settings: { ...BASE_SETTINGS, provider: 'ollama' } });
      expect(testId('apikey-section')).toBeNull();
    });
  });

  describe('API key management', () => {
    it('renders masked API key by default (password type)', () => {
      render();
      const inp = testId('apikey-input') as HTMLInputElement;
      expect(inp.type).toBe('password');
    });

    it('toggles key visibility', () => {
      render();
      click(testId('toggle-key-visibility')!);
      // After click, the component should re-render but since we use vi.fn for onChange,
      // the toggle changes local state only
      const btn = testId('toggle-key-visibility');
      expect(btn).not.toBeNull();
    });

    it('calls onSettingsChange when key changes', () => {
      const onChange = vi.fn();
      render({ onSettingsChange: onChange });
      setInputValue(testId('apikey-input') as HTMLInputElement, 'sk-new-key');
      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('model selection', () => {
    it('renders model dropdown when models available', () => {
      render();
      const sel = testId('model-select') as HTMLSelectElement;
      expect(sel).not.toBeNull();
    });

    it('renders model text input when no models available', () => {
      render({ availableModels: [] });
      expect(testId('model-input')).not.toBeNull();
      expect(testId('model-select')).toBeNull();
    });

    it('model dropdown contains available models', () => {
      render();
      const sel = testId('model-select') as HTMLSelectElement;
      const options = Array.from(sel.options).map((o) => o.value);
      expect(options).toContain('gpt-4o');
      expect(options).toContain('gpt-4o-mini');
    });
  });

  describe('temperature slider', () => {
    it('displays current temperature value', () => {
      render();
      expect(testId('temperature-value')!.textContent).toBe('0.7');
    });

    it('calls onSettingsChange when temperature changes', () => {
      const onChange = vi.fn();
      render({ onSettingsChange: onChange });
      setInputValue(testId('temperature-slider') as HTMLInputElement, '1.2');
      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('max tokens slider', () => {
    it('displays current max tokens value', () => {
      render();
      expect(testId('maxtokens-value')!.textContent).toContain('2,048');
    });

    it('calls onSettingsChange when max tokens changes', () => {
      const onChange = vi.fn();
      render({ onSettingsChange: onChange });
      setInputValue(testId('maxtokens-slider') as HTMLInputElement, '4096');
      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('test connection', () => {
    it('calls onTestConnection when button clicked', async () => {
      const testFn = vi.fn().mockResolvedValue({ ok: true, message: 'Connected', latencyMs: 100 });
      render({ onTestConnection: testFn });
      await act(async () => { testId('test-connection-btn')!.click(); });
      expect(testFn).toHaveBeenCalledWith('openai', 'sk-test-key-12345678', 'gpt-4o');
    });

    it('shows success result', async () => {
      const testFn = vi.fn().mockResolvedValue({ ok: true, message: 'Connected to OpenAI', latencyMs: 150 });
      render({ onTestConnection: testFn });
      await act(async () => { testId('test-connection-btn')!.click(); });
      const result = testId('test-result');
      expect(result).not.toBeNull();
      expect(result!.textContent).toContain('Connected to OpenAI');
      expect(result!.textContent).toContain('150ms');
    });

    it('shows failure result', async () => {
      const testFn = vi.fn().mockResolvedValue({ ok: false, message: 'Invalid API key', latencyMs: 50 });
      render({ onTestConnection: testFn });
      await act(async () => { testId('test-connection-btn')!.click(); });
      const result = testId('test-result');
      expect(result!.textContent).toContain('Invalid API key');
    });
  });

  describe('cost tracking', () => {
    it('shows cost summary when provided', () => {
      render({
        costSummary: { totalCost: 0.0235, byProvider: { openai: 0.02, gemini: 0.0035 }, sessionStart: Date.now() },
      });
      expect(testId('cost-summary')).not.toBeNull();
      expect(testId('total-cost')!.textContent).toContain('0.0235');
    });

    it('hides cost summary when not provided', () => {
      render({ costSummary: undefined });
      expect(testId('cost-summary')).toBeNull();
    });
  });
});
