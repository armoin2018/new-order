/**
 * CNFL-3004 — Profile Selection UI at Game Start
 *
 * Displays available leader profiles (8 defaults + any custom)
 * as summary cards during game setup. Appears after faction
 * selection, before scenario start. Includes "Create Custom"
 * button linking to the profile builder.
 */

import { useState, useMemo } from 'react';
import type { FC, CSSProperties } from 'react';
import type { LeaderProfile } from './ProfileBuilder';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ProfileSummary {
  leaderId: string;
  name: string;
  title: string;
  mbtiType: string;
  factionId: string | null;
  isCustom: boolean;
  /** Short gameplay tendency lines */
  tendencies: string[];
  /** Key personality traits for the card */
  keyTraits: { label: string; value: number }[];
}

export interface ProfileSelectionProps {
  profiles: ProfileSummary[];
  /** Optional default profile to pre-select based on faction. */
  defaultProfileId?: string | null;
  onSelect: (profileId: string) => void;
  onCreateCustom: () => void;
  onConfirm: (profileId: string) => void;
  onBack: () => void;
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const panelRoot: CSSProperties = {
  width: '100%',
  maxWidth: 1100,
  margin: '0 auto',
  padding: 24,
  color: '#e0e0e0',
  fontFamily: 'system-ui, -apple-system, sans-serif',
};

const cardGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(260, 1fr))',
  gap: 14,
  marginBottom: 24,
};

const traitBar: CSSProperties = {
  height: 4,
  borderRadius: 2,
  backgroundColor: '#222',
  overflow: 'hidden',
};

const btnPrimary: CSSProperties = {
  padding: '10px 28px',
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: 1,
  textTransform: 'uppercase',
  border: '2px solid #4caf50',
  borderRadius: 6,
  background: 'rgba(76,175,80,0.1)',
  color: '#4caf50',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const btnSecondary: CSSProperties = {
  padding: '10px 28px',
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: 1,
  textTransform: 'uppercase',
  border: '1px solid #555',
  borderRadius: 6,
  background: 'transparent',
  color: '#aaa',
  cursor: 'pointer',
  fontFamily: 'inherit',
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function traitColor(val: number): string {
  if (val >= 70) return '#4caf50';
  if (val >= 40) return '#ffaa00';
  return '#ff4a4a';
}

// ─── Component ──────────────────────────────────────────────────────────────

export const ProfileSelection: FC<ProfileSelectionProps> = ({
  profiles,
  defaultProfileId,
  onSelect,
  onCreateCustom,
  onConfirm,
  onBack,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(defaultProfileId ?? null);

  const sorted = useMemo(() => {
    const defaults = profiles.filter((p) => !p.isCustom);
    const customs = profiles.filter((p) => p.isCustom);
    return [...defaults, ...customs];
  }, [profiles]);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    onSelect(id);
  };

  return (
    <div style={panelRoot} data-testid="profile-selection">
      <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: 2, marginBottom: 4 }}>
        👤 Select Leader Profile
      </h2>
      <p style={{ fontSize: 12, color: '#666', marginBottom: 20 }}>
        Choose a leader to guide your nation. Each profile shapes decision-making, diplomacy, and crisis response.
      </p>

      {/* ── Card Grid ─────────────────────────────── */}
      <div style={cardGrid} data-testid="profile-grid">
        {sorted.map((p) => {
          const isSelected = selectedId === p.leaderId;
          return (
            <button
              key={p.leaderId}
              data-testid={`profile-card-${p.leaderId}`}
              onClick={() => handleSelect(p.leaderId)}
              style={{
                textAlign: 'left',
                padding: 16,
                backgroundColor: isSelected ? '#0d1a0d' : '#111',
                border: isSelected ? '2px solid #4caf50' : '1px solid #333',
                borderRadius: 8,
                cursor: 'pointer',
                color: '#e0e0e0',
                fontFamily: 'inherit',
                transition: 'border-color 0.15s',
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{p.name}</div>
                {p.isCustom && (
                  <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 3, backgroundColor: '#3a2a00', color: '#ffaa00', fontWeight: 600 }}>
                    CUSTOM
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>
                {p.mbtiType} · {p.title}
              </div>

              {/* Key traits */}
              <div style={{ marginBottom: 8 }}>
                {p.keyTraits.slice(0, 4).map((t) => (
                  <div key={t.label} style={{ marginBottom: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#aaa', marginBottom: 2 }}>
                      <span>{t.label}</span>
                      <span style={{ fontWeight: 600 }}>{t.value}</span>
                    </div>
                    <div style={traitBar}>
                      <div style={{ width: `${t.value}%`, height: '100%', backgroundColor: traitColor(t.value), borderRadius: 2 }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Tendencies */}
              {p.tendencies.length > 0 && (
                <div style={{ fontSize: 10, color: '#777', lineHeight: 1.6, borderTop: '1px solid #222', paddingTop: 6 }}>
                  {p.tendencies[0]}
                </div>
              )}
            </button>
          );
        })}

        {/* Create Custom card */}
        <button
          data-testid="btn-create-custom"
          onClick={onCreateCustom}
          style={{
            textAlign: 'center',
            padding: 16,
            backgroundColor: '#111',
            border: '1px dashed #444',
            borderRadius: 8,
            cursor: 'pointer',
            color: '#888',
            fontFamily: 'inherit',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 160,
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 8 }}>➕</div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Create Custom</div>
          <div style={{ fontSize: 10, color: '#666', marginTop: 4 }}>Build your own leader profile</div>
        </button>
      </div>

      {/* ── Footer Actions ────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button style={btnSecondary} onClick={onBack} data-testid="btn-back">
          ← Back
        </button>
        <button
          style={{ ...btnPrimary, opacity: selectedId ? 1 : 0.4, cursor: selectedId ? 'pointer' : 'not-allowed' }}
          disabled={!selectedId}
          onClick={() => { if (selectedId) onConfirm(selectedId); }}
          data-testid="btn-confirm"
        >
          Confirm Leader →
        </button>
      </div>
    </div>
  );
};
