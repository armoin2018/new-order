/**
 * CNFL-3608 — AI Settings Panel
 *
 * UI panel for configuring the AI integration layer:
 * - Provider selection (OpenAI, Gemini, Claude, OpenRouter, Ollama)
 * - API key entry with masked display
 * - Model selection from the provider's catalog
 * - Temperature / max-tokens sliders
 * - Test connection button
 * - Cost tracking dashboard
 * - AI toggle (enable/disable)
 * - Ollama auto-detect indicator
 *
 * @module ui/AISettingsPanel
 */

import { useState, useMemo, useCallback } from 'react';
import type { FC, CSSProperties } from 'react';
import type { AIProvider, ModelInfo, AICost } from '../engine/ai/ai-adapter';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AISettingsState {
  enabled: boolean;
  provider: AIProvider;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  baseUrl?: string;
}

export interface ConnectionTestResult {
  ok: boolean;
  message: string;
  latencyMs: number;
}

export interface CostSummary {
  totalCost: number;
  byProvider: Record<string, number>;
  sessionStart: number;
}

export interface AISettingsPanelProps {
  settings: AISettingsState;
  onSettingsChange: (settings: AISettingsState) => void;
  onTestConnection?: (provider: AIProvider, apiKey: string, model: string) => Promise<ConnectionTestResult>;
  availableModels?: ModelInfo[];
  costSummary?: CostSummary;
  ollamaDetected?: boolean;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const PROVIDERS: { id: AIProvider; label: string; keyRequired: boolean }[] = [
  { id: 'openai', label: 'OpenAI', keyRequired: true },
  { id: 'gemini', label: 'Google Gemini', keyRequired: true },
  { id: 'claude', label: 'Anthropic Claude', keyRequired: true },
  { id: 'openrouter', label: 'OpenRouter', keyRequired: true },
  { id: 'ollama', label: 'Ollama (Local)', keyRequired: false },
];

// ─── Styles ─────────────────────────────────────────────────────────────────

const panel: CSSProperties = {
  background: '#1a1a2e', color: '#e0e0e0', padding: '24px', borderRadius: '12px',
  fontFamily: 'monospace', maxWidth: '600px', width: '100%',
};
const heading: CSSProperties = { fontSize: '1.4rem', fontWeight: 700, marginBottom: '20px', color: '#00e5ff' };
const section: CSSProperties = { marginBottom: '20px' };
const label: CSSProperties = { display: 'block', fontSize: '0.85rem', color: '#90a4ae', marginBottom: '6px' };
const select: CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: '6px',
  background: '#16213e', color: '#e0e0e0', border: '1px solid #334155',
  fontSize: '0.9rem', cursor: 'pointer',
};
const input: CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: '6px',
  background: '#16213e', color: '#e0e0e0', border: '1px solid #334155',
  fontSize: '0.9rem', boxSizing: 'border-box',
};
const slider: CSSProperties = { width: '100%', cursor: 'pointer' };
const row: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' };
const badge: CSSProperties = { fontSize: '0.75rem', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 };
const btn: CSSProperties = {
  padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer',
  fontWeight: 600, fontSize: '0.85rem',
};
const primaryBtn: CSSProperties = { ...btn, background: '#00e5ff', color: '#0a0a1a' };
const toggleTrack: CSSProperties = {
  width: '48px', height: '26px', borderRadius: '13px', cursor: 'pointer',
  position: 'relative', display: 'inline-block', transition: 'background 0.2s',
};
const toggleKnob: CSSProperties = {
  width: '22px', height: '22px', borderRadius: '50%', background: '#fff',
  position: 'absolute', top: '2px', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
};
const costCard: CSSProperties = {
  background: '#16213e', borderRadius: '8px', padding: '12px', marginTop: '12px',
};
const errorText: CSSProperties = { color: '#ff5252', fontSize: '0.8rem', marginTop: '4px' };
const successText: CSSProperties = { color: '#4caf50', fontSize: '0.8rem', marginTop: '4px' };
const divider: CSSProperties = { borderTop: '1px solid #334155', margin: '16px 0' };

// ─── Component ──────────────────────────────────────────────────────────────

export const AISettingsPanel: FC<AISettingsPanelProps> = ({
  settings,
  onSettingsChange,
  onTestConnection,
  availableModels,
  costSummary,
  ollamaDetected,
}) => {
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const providerInfo = useMemo(
    () => PROVIDERS.find((p) => p.id === settings.provider) ?? PROVIDERS[0]!,
    [settings.provider],
  );

  const models = useMemo(
    () => availableModels?.filter((m) => m.provider === settings.provider) ?? [],
    [availableModels, settings.provider],
  );

  const maskedKey = useMemo(() => {
    if (!settings.apiKey) return '';
    if (showKey) return settings.apiKey;
    return settings.apiKey.slice(0, 4) + '•'.repeat(Math.max(0, settings.apiKey.length - 8)) + settings.apiKey.slice(-4);
  }, [settings.apiKey, showKey]);

  const update = useCallback(
    (patch: Partial<AISettingsState>) => onSettingsChange({ ...settings, ...patch }),
    [settings, onSettingsChange],
  );

  const handleTestConnection = useCallback(async () => {
    if (!onTestConnection) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await onTestConnection(settings.provider, settings.apiKey, settings.model);
      setTestResult(result);
    } catch {
      setTestResult({ ok: false, message: 'Connection test failed', latencyMs: 0 });
    } finally {
      setTesting(false);
    }
  }, [onTestConnection, settings.provider, settings.apiKey, settings.model]);

  return (
    <div style={panel} data-testid="ai-settings-panel">
      <div style={heading}>🤖 AI Settings</div>

      {/* ── Enable Toggle ── */}
      <div style={{ ...section, ...row }} data-testid="ai-toggle-section">
        <span style={{ fontSize: '0.95rem', fontWeight: 600 }}>AI Integration</span>
        <div
          data-testid="ai-toggle"
          style={{ ...toggleTrack, background: settings.enabled ? '#00e5ff' : '#455a64' }}
          onClick={() => update({ enabled: !settings.enabled })}
          role="switch"
          aria-checked={settings.enabled}
        >
          <div style={{ ...toggleKnob, left: settings.enabled ? '24px' : '2px' }} />
        </div>
      </div>

      {!settings.enabled && (
        <div style={{ textAlign: 'center', color: '#78909c', padding: '20px 0' }} data-testid="ai-disabled-message">
          AI features are disabled. Enable to configure providers.
        </div>
      )}

      {settings.enabled && (
        <>
          {/* ── Provider Selection ── */}
          <div style={section} data-testid="provider-section">
            <span style={label}>Provider</span>
            <select
              data-testid="provider-select"
              style={select}
              value={settings.provider}
              onChange={(e) => update({ provider: e.target.value as AIProvider, model: '' })}
            >
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
            {settings.provider === 'ollama' && (
              <div style={{ marginTop: '6px' }}>
                <span
                  data-testid="ollama-status"
                  style={{
                    ...badge,
                    background: ollamaDetected ? '#1b5e20' : '#b71c1c',
                    color: '#fff',
                  }}
                >
                  {ollamaDetected ? '● Ollama Running' : '○ Ollama Not Detected'}
                </span>
              </div>
            )}
          </div>

          {/* ── API Key ── */}
          {providerInfo.keyRequired && (
            <div style={section} data-testid="apikey-section">
              <span style={label}>API Key</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  data-testid="apikey-input"
                  style={{ ...input, flex: 1 }}
                  type={showKey ? 'text' : 'password'}
                  value={settings.apiKey}
                  onChange={(e) => update({ apiKey: e.target.value })}
                  placeholder={`Enter ${providerInfo.label} API key…`}
                />
                <button
                  data-testid="toggle-key-visibility"
                  style={{ ...btn, background: '#334155', color: '#e0e0e0', whiteSpace: 'nowrap' }}
                  onClick={() => setShowKey(!showKey)}
                >
                  {showKey ? '🙈 Hide' : '👁 Show'}
                </button>
              </div>
            </div>
          )}

          {/* ── Model Selection ── */}
          <div style={section} data-testid="model-section">
            <span style={label}>Model</span>
            {models.length > 0 ? (
              <select
                data-testid="model-select"
                style={select}
                value={settings.model}
                onChange={(e) => update({ model: e.target.value })}
              >
                <option value="">Select a model…</option>
                {models.map((m) => (
                  <option key={m.modelId} value={m.modelId}>
                    {m.displayName} ({m.contextWindow.toLocaleString()} ctx)
                  </option>
                ))}
              </select>
            ) : (
              <input
                data-testid="model-input"
                style={input}
                value={settings.model}
                onChange={(e) => update({ model: e.target.value })}
                placeholder="Enter model name…"
              />
            )}
          </div>

          {/* ── Temperature ── */}
          <div style={section} data-testid="temperature-section">
            <div style={row}>
              <span style={label}>Temperature</span>
              <span style={{ ...label, color: '#00e5ff' }} data-testid="temperature-value">{settings.temperature.toFixed(1)}</span>
            </div>
            <input
              data-testid="temperature-slider"
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={settings.temperature}
              onChange={(e) => update({ temperature: parseFloat(e.target.value) })}
              style={slider}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#78909c' }}>
              <span>Deterministic</span>
              <span>Creative</span>
            </div>
          </div>

          {/* ── Max Tokens ── */}
          <div style={section} data-testid="maxtokens-section">
            <div style={row}>
              <span style={label}>Max Tokens</span>
              <span style={{ ...label, color: '#00e5ff' }} data-testid="maxtokens-value">{settings.maxTokens.toLocaleString()}</span>
            </div>
            <input
              data-testid="maxtokens-slider"
              type="range"
              min="256"
              max="16384"
              step="256"
              value={settings.maxTokens}
              onChange={(e) => update({ maxTokens: parseInt(e.target.value) })}
              style={slider}
            />
          </div>

          <div style={divider} />

          {/* ── Test Connection ── */}
          <div style={section} data-testid="test-connection-section">
            <button
              data-testid="test-connection-btn"
              style={{ ...primaryBtn, opacity: testing ? 0.6 : 1 }}
              onClick={handleTestConnection}
              disabled={testing}
            >
              {testing ? '⏳ Testing…' : '🔌 Test Connection'}
            </button>
            {testResult && (
              <div style={testResult.ok ? successText : errorText} data-testid="test-result">
                {testResult.ok ? '✓' : '✗'} {testResult.message}
                {testResult.latencyMs > 0 && ` (${testResult.latencyMs}ms)`}
              </div>
            )}
          </div>

          {/* ── Cost Tracking ── */}
          {costSummary && (
            <div style={costCard} data-testid="cost-summary">
              <div style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '8px', color: '#00e5ff' }}>💰 Cost Tracking</div>
              <div style={row}>
                <span style={{ color: '#90a4ae', fontSize: '0.85rem' }}>Total Spend</span>
                <span data-testid="total-cost" style={{ fontWeight: 700 }}>${costSummary.totalCost.toFixed(4)}</span>
              </div>
              {Object.entries(costSummary.byProvider).map(([prov, cost]) => (
                <div key={prov} style={row}>
                  <span style={{ color: '#78909c', fontSize: '0.8rem' }}>{prov}</span>
                  <span style={{ fontSize: '0.8rem' }}>${(cost as number).toFixed(4)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
