/**
 * CNFL-3103 — Custom Political System Creator
 *
 * Form UI for creating custom political system profiles. Players can:
 * - Name their system and provide a description
 * - Adjust all modifier sliders (decision speed, stability, civil liberty, etc.)
 * - Clone and modify existing presets
 * - Save as a valid JSON model
 */

import { useState, useMemo, useCallback } from 'react';
import type { FC, CSSProperties, ChangeEvent } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PoliticalSystemModifiers {
  decisionSpeedModifier: number;      // -50 to +50
  stabilityBaseline: number;           // 0-25
  civilLibertyIndex: number;           // 0-100
  pressFreedomIndex: number;           // 0-100
  corruptionBaseline: number;          // 0-100
  successionRisk: number;              // 0-100
  reformCapacity: number;              // 0-100
}

export interface GameplayModifiers {
  stabilityRecoveryRate: number;       // 0.5-2.0
  crisisResistance: number;            // 0.5-2.0
  controversialActionDelay: number;    // 0-5
  propagandaEffectiveness: number;     // 0-2.0
  civilUnrestThreshold: number;        // 0.1-1.0
}

export interface PoliticalSystemProfile {
  systemId: string;
  systemName: string;
  description: string;
  modifiers: PoliticalSystemModifiers;
  gameplayModifiers: GameplayModifiers;
  tags: string[];
}

export interface PoliticalSystemPreset {
  systemId: string;
  systemName: string;
  description: string;
  modifiers: PoliticalSystemModifiers;
  gameplayModifiers: GameplayModifiers;
}

export interface PoliticalSystemCreatorProps {
  presets: PoliticalSystemPreset[];
  onSave: (system: PoliticalSystemProfile) => void;
  onCancel: () => void;
}

// ─── Defaults ───────────────────────────────────────────────────────────────

const DEFAULT_MODIFIERS: PoliticalSystemModifiers = {
  decisionSpeedModifier: 0,
  stabilityBaseline: 10,
  civilLibertyIndex: 50,
  pressFreedomIndex: 50,
  corruptionBaseline: 50,
  successionRisk: 50,
  reformCapacity: 50,
};

const DEFAULT_GAMEPLAY: GameplayModifiers = {
  stabilityRecoveryRate: 1.0,
  crisisResistance: 1.0,
  controversialActionDelay: 1,
  propagandaEffectiveness: 1.0,
  civilUnrestThreshold: 0.5,
};

// ─── Slider Config ──────────────────────────────────────────────────────────

interface SliderDef {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  description: string;
}

const MODIFIER_SLIDERS: SliderDef[] = [
  { key: 'decisionSpeedModifier', label: 'Decision Speed', min: -50, max: 50, step: 5, description: 'Affects how fast policy actions take effect' },
  { key: 'stabilityBaseline', label: 'Stability Baseline', min: 0, max: 25, step: 1, description: 'Base stability contribution from the system' },
  { key: 'civilLibertyIndex', label: 'Civil Liberty', min: 0, max: 100, step: 5, description: 'Level of individual freedoms and rights' },
  { key: 'pressFreedomIndex', label: 'Press Freedom', min: 0, max: 100, step: 5, description: 'Media independence and reporting freedom' },
  { key: 'corruptionBaseline', label: 'Corruption', min: 0, max: 100, step: 5, description: 'Baseline corruption level in the system' },
  { key: 'successionRisk', label: 'Succession Risk', min: 0, max: 100, step: 5, description: 'Risk during leadership transitions' },
  { key: 'reformCapacity', label: 'Reform Capacity', min: 0, max: 100, step: 5, description: 'Ability to enact systemic reforms' },
];

const GAMEPLAY_SLIDERS: SliderDef[] = [
  { key: 'stabilityRecoveryRate', label: 'Stability Recovery', min: 0.5, max: 2.0, step: 0.1, description: 'How fast stability rebounds after crises' },
  { key: 'crisisResistance', label: 'Crisis Resistance', min: 0.5, max: 2.0, step: 0.1, description: 'Multiplier for resisting external shocks' },
  { key: 'controversialActionDelay', label: 'Action Delay', min: 0, max: 5, step: 1, description: 'Turns of delay for controversial policies' },
  { key: 'propagandaEffectiveness', label: 'Propaganda', min: 0, max: 2.0, step: 0.1, description: 'Effectiveness of state messaging' },
  { key: 'civilUnrestThreshold', label: 'Unrest Threshold', min: 0.1, max: 1.0, step: 0.05, description: 'How sensitive population is to unrest triggers' },
];

// ─── Styles ─────────────────────────────────────────────────────────────────

const panel: CSSProperties = {
  width: '100%', maxWidth: 900, margin: '0 auto', padding: 24,
  color: '#e0e0e0', fontFamily: 'system-ui, -apple-system, sans-serif',
};
const sectionTitle: CSSProperties = {
  fontSize: 14, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5,
  color: '#888', borderBottom: '1px solid #333', paddingBottom: 8, marginBottom: 16, marginTop: 24,
};
const card: CSSProperties = { backgroundColor: '#111', border: '1px solid #333', borderRadius: 8, padding: 16, marginBottom: 12 };
const sliderRow: CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 };
const sliderLbl: CSSProperties = { width: 140, fontSize: 12, color: '#aaa', textAlign: 'right' };
const sliderInp: CSSProperties = { flex: 1, accentColor: '#4caf50' };
const sliderVal: CSSProperties = { width: 50, fontSize: 13, fontWeight: 600, textAlign: 'center', color: '#e0e0e0' };
const btnP: CSSProperties = { padding: '10px 28px', fontSize: 13, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', border: '2px solid #4caf50', borderRadius: 6, background: 'rgba(76,175,80,0.1)', color: '#4caf50', cursor: 'pointer', fontFamily: 'inherit' };
const btnS: CSSProperties = { padding: '10px 28px', fontSize: 13, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', border: '1px solid #555', borderRadius: 6, background: 'transparent', color: '#aaa', cursor: 'pointer', fontFamily: 'inherit' };

// ─── Component ──────────────────────────────────────────────────────────────

export const PoliticalSystemCreator: FC<PoliticalSystemCreatorProps> = ({
  presets,
  onSave,
  onCancel,
}) => {
  const [systemName, setSystemName] = useState('');
  const [description, setDescription] = useState('');
  const [modifiers, setModifiers] = useState<PoliticalSystemModifiers>(DEFAULT_MODIFIERS);
  const [gameplay, setGameplay] = useState<GameplayModifiers>(DEFAULT_GAMEPLAY);
  const [tags, setTags] = useState('');

  const loadPreset = useCallback((preset: PoliticalSystemPreset) => {
    setSystemName(`${preset.systemName} (Custom)`);
    setDescription(preset.description);
    setModifiers(preset.modifiers);
    setGameplay(preset.gameplayModifiers);
  }, []);

  const updateMod = useCallback((key: string) => (e: ChangeEvent<HTMLInputElement>) => {
    setModifiers((prev) => ({ ...prev, [key]: Number(e.target.value) }));
  }, []);

  const updateGp = useCallback((key: string) => (e: ChangeEvent<HTMLInputElement>) => {
    setGameplay((prev) => ({ ...prev, [key]: Number(e.target.value) }));
  }, []);

  const currentSystem = useMemo<PoliticalSystemProfile>(() => ({
    systemId: systemName.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'custom-system',
    systemName: systemName || 'Custom System',
    description,
    modifiers,
    gameplayModifiers: gameplay,
    tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
  }), [systemName, description, modifiers, gameplay, tags]);

  const valid = systemName.trim().length >= 2;

  // Summary text
  const summary = useMemo(() => {
    const lines: string[] = [];
    if (modifiers.civilLibertyIndex >= 70) lines.push('High civil liberties — citizens enjoy broad freedoms.');
    else if (modifiers.civilLibertyIndex <= 30) lines.push('Restricted freedoms — authoritarian control mechanisms.');
    if (modifiers.decisionSpeedModifier >= 20) lines.push('Fast policy execution — decisive governance.');
    else if (modifiers.decisionSpeedModifier <= -20) lines.push('Slow bureaucratic process — democratic deliberation.');
    if (modifiers.corruptionBaseline >= 60) lines.push('Significant corruption undermines governance.');
    if (gameplay.crisisResistance >= 1.5) lines.push('Highly resilient to external shocks and crises.');
    if (gameplay.propagandaEffectiveness >= 1.5) lines.push('Effective state propaganda shapes public opinion.');
    return lines.length ? lines : ['Balanced governance model.'];
  }, [modifiers, gameplay]);

  return (
    <div style={panel} data-testid="polsys-creator">
      <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: 2, marginBottom: 4 }}>
        🏛️ Political System Creator
      </h2>
      <p style={{ fontSize: 12, color: '#666', marginBottom: 16 }}>
        Define a custom political system with tailored governance mechanics.
      </p>

      {/* Presets */}
      {presets.length > 0 && (
        <>
          <div style={sectionTitle}>Clone from Preset</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {presets.map((p) => (
              <button
                key={p.systemId}
                data-testid={`preset-${p.systemId}`}
                onClick={() => loadPreset(p)}
                style={{
                  padding: '6px 14px', fontSize: 11, border: '1px solid #444',
                  borderRadius: 4, background: '#111', color: '#ccc', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {p.systemName}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Identity */}
      <div style={sectionTitle}>System Identity</div>
      <div style={card}>
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>System Name</label>
          <input
            data-testid="input-system-name"
            value={systemName}
            onChange={(e) => setSystemName(e.target.value)}
            placeholder="e.g. Techno-Democracy"
            style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: 4, color: '#e0e0e0', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>Description</label>
          <textarea
            data-testid="input-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Describe the system's governance philosophy…"
            style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: 4, color: '#e0e0e0', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
          />
        </div>
        <div>
          <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>Tags (comma-separated)</label>
          <input
            data-testid="input-tags"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="e.g. democratic, hybrid, reform"
            style={{ width: '100%', padding: '8px 12px', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: 4, color: '#e0e0e0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }}
          />
        </div>
      </div>

      {/* System Modifiers */}
      <div style={sectionTitle}>System Modifiers</div>
      <div style={card}>
        {MODIFIER_SLIDERS.map((s) => (
          <div key={s.key} style={sliderRow} title={s.description}>
            <span style={sliderLbl}>{s.label}</span>
            <input
              type="range" min={s.min} max={s.max} step={s.step}
              value={(modifiers as Record<string, number>)[s.key]}
              onChange={updateMod(s.key)}
              style={sliderInp}
              data-testid={`slider-${s.key}`}
            />
            <span style={sliderVal}>{(modifiers as Record<string, number>)[s.key]}</span>
          </div>
        ))}
      </div>

      {/* Gameplay Modifiers */}
      <div style={sectionTitle}>Gameplay Modifiers</div>
      <div style={card}>
        {GAMEPLAY_SLIDERS.map((s) => (
          <div key={s.key} style={sliderRow} title={s.description}>
            <span style={sliderLbl}>{s.label}</span>
            <input
              type="range" min={s.min} max={s.max} step={s.step}
              value={(gameplay as Record<string, number>)[s.key]}
              onChange={updateGp(s.key)}
              style={sliderInp}
              data-testid={`slider-${s.key}`}
            />
            <span style={sliderVal}>{(gameplay as Record<string, number>)[s.key]}</span>
          </div>
        ))}
      </div>

      {/* Summary */}
      <div style={sectionTitle}>System Summary</div>
      <div style={{ ...card, backgroundColor: '#0d1117', borderColor: '#224422' }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6, color: '#4caf50' }}>{currentSystem.systemName}</div>
        <ul style={{ margin: 0, padding: '0 0 0 16px', listStyle: 'disc' }} data-testid="system-summary">
          {summary.map((line, i) => (
            <li key={i} style={{ fontSize: 12, color: '#bbb', lineHeight: 1.8 }}>{line}</li>
          ))}
        </ul>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
        <button style={btnS} onClick={onCancel} data-testid="btn-cancel">Cancel</button>
        <button
          style={{ ...btnP, opacity: valid ? 1 : 0.4, cursor: valid ? 'pointer' : 'not-allowed' }}
          disabled={!valid}
          onClick={() => { if (valid) onSave(currentSystem); }}
          data-testid="btn-save"
        >
          Save System
        </button>
      </div>
    </div>
  );
};
