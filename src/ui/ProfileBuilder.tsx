/**
 * CNFL-3003 — Custom Psychological Profile Builder
 *
 * Allows players to construct custom leader profiles through three modes:
 * 1. **Preset** — select from 16 MBTI types with pre-filled defaults
 * 2. **Manual** — adjust individual sliders for every dimension
 * 3. **Hybrid** — start from MBTI preset then fine-tune
 *
 * The builder outputs a valid leader JSON model and shows a real-time
 * gameplay-tendency preview as sliders change.
 */

import { useState, useMemo, useCallback } from 'react';
import type { FC, CSSProperties, ChangeEvent } from 'react';

// ─── Constants ──────────────────────────────────────────────────────────────

const MBTI_TYPES = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP',
  'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISTP', 'ESTJ', 'ESTP',
  'ISFJ', 'ISFP', 'ESFJ', 'ESFP',
] as const;
export type MbtiType = typeof MBTI_TYPES[number];

const MBTI_NAMES: Record<MbtiType, string> = {
  INTJ: 'The Architect',   INTP: 'The Logician',
  ENTJ: 'The Commander',   ENTP: 'The Debater',
  INFJ: 'The Advocate',    INFP: 'The Mediator',
  ENFJ: 'The Protagonist', ENFP: 'The Campaigner',
  ISTJ: 'The Logistician', ISTP: 'The Virtuoso',
  ESTJ: 'The Executive',   ESTP: 'The Entrepreneur',
  ISFJ: 'The Defender',    ISFP: 'The Adventurer',
  ESFJ: 'The Consul',      ESFP: 'The Entertainer',
};

const DECISION_STYLES = ['autocratic', 'consultative', 'delegative', 'consensus'] as const;
const STRESS_RESPONSES = ['escalate', 'withdraw', 'delegate', 'freeze', 'double-down'] as const;

export type DecisionStyle = typeof DECISION_STYLES[number];
export type StressResponse = typeof STRESS_RESPONSES[number];

type BuilderMode = 'preset' | 'manual' | 'hybrid';

// ─── Psychology Defaults per MBTI ───────────────────────────────────────────

interface PsychologySliders {
  riskTolerance: number;
  paranoia: number;
  narcissism: number;
  pragmatism: number;
  patience: number;
  vengefulIndex: number;
  charisma: number;
  empathy: number;
  ideologicalRigidity: number;
  corruptibility: number;
}

interface DichotomyScores {
  EI: number;
  SN: number;
  TF: number;
  JP: number;
}

export interface LeaderProfile {
  leaderId: string;
  name: string;
  title: string;
  mbtiType: MbtiType;
  mbtiDichotomyScores: DichotomyScores;
  decisionStyle: DecisionStyle;
  stressResponse: StressResponse;
  psychology: PsychologySliders;
  motivationPrimary: string;
  motivationSecondary: string;
  motivationFear: string;
}

function defaultDichotomy(mbti: MbtiType): DichotomyScores {
  return {
    EI: mbti[0] === 'E' ? 25 : 75,
    SN: mbti[1] === 'S' ? 25 : 75,
    TF: mbti[2] === 'T' ? 25 : 75,
    JP: mbti[3] === 'J' ? 25 : 75,
  };
}

function defaultPsychology(mbti: MbtiType): PsychologySliders {
  const isE = mbti[0] === 'E';
  const isN = mbti[1] === 'N';
  const isT = mbti[2] === 'T';
  const isJ = mbti[3] === 'J';
  return {
    riskTolerance: isN ? 65 : 40,
    paranoia: isT && isJ ? 55 : 35,
    narcissism: isE ? 55 : 30,
    pragmatism: isT ? 70 : 45,
    patience: isJ ? 35 : 60,
    vengefulIndex: isT && !isE ? 50 : 30,
    charisma: isE ? 70 : 40,
    empathy: !isT ? 75 : 40,
    ideologicalRigidity: isJ && !isN ? 60 : 30,
    corruptibility: 25,
  };
}

function defaultDecisionStyle(mbti: MbtiType): DecisionStyle {
  if (mbti[0] === 'E' && mbti[3] === 'J') return 'autocratic';
  if (mbti[2] === 'F') return 'consensus';
  if (mbti[0] === 'I') return 'consultative';
  return 'delegative';
}

function defaultStressResponse(mbti: MbtiType): StressResponse {
  if (mbti[2] === 'T' && mbti[3] === 'J') return 'escalate';
  if (mbti[0] === 'I' && mbti[2] === 'F') return 'withdraw';
  if (mbti[0] === 'E') return 'delegate';
  return 'double-down';
}

const MOTIVATIONS = ['prosperity', 'security', 'legacy', 'power', 'ideology', 'stability', 'glory'] as const;
const FEARS = ['economic-collapse', 'military-defeat', 'revolution', 'irrelevance', 'invasion', 'chaos'] as const;

// ─── Props ──────────────────────────────────────────────────────────────────

export interface ProfileBuilderProps {
  /** Called when the player finishes building a profile. */
  onSave: (profile: LeaderProfile) => void;
  /** Called when the player cancels building. */
  onCancel: () => void;
  /** Optional existing profile to edit (hybrid mode default). */
  existingProfile?: LeaderProfile | null;
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const panel: CSSProperties = {
  width: '100%',
  maxWidth: 960,
  margin: '0 auto',
  padding: 24,
  color: '#e0e0e0',
  fontFamily: 'system-ui, -apple-system, sans-serif',
};

const sectionTitle: CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: 1.5,
  color: '#888',
  borderBottom: '1px solid #333',
  paddingBottom: 8,
  marginBottom: 16,
  marginTop: 24,
};

const card: CSSProperties = {
  backgroundColor: '#111',
  border: '1px solid #333',
  borderRadius: 8,
  padding: 16,
  marginBottom: 12,
};

const sliderRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  marginBottom: 10,
};

const sliderLabel: CSSProperties = {
  width: 150,
  fontSize: 12,
  color: '#aaa',
  textAlign: 'right',
};

const sliderInput: CSSProperties = {
  flex: 1,
  accentColor: '#4caf50',
};

const sliderValue: CSSProperties = {
  width: 36,
  fontSize: 13,
  fontWeight: 600,
  textAlign: 'center',
  color: '#e0e0e0',
};

const mbtiGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4, 1fr)',
  gap: 8,
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

function buildTendencyPreview(profile: LeaderProfile): string[] {
  const lines: string[] = [];
  const p = profile.psychology;

  // Diplomacy vs aggression
  if (p.empathy >= 60 && p.pragmatism >= 60) {
    lines.push('Favours diplomatic solutions but pivots to coercion when talks stall.');
  } else if (p.empathy >= 60) {
    lines.push('Strong preference for diplomatic engagement and multilateral cooperation.');
  } else if (p.riskTolerance >= 60 && p.vengefulIndex >= 50) {
    lines.push('Aggressive posture — quick to retaliate and escalate conflicts.');
  } else {
    lines.push('Balanced approach, adapting stance based on circumstances.');
  }

  // Stress
  if (profile.stressResponse === 'escalate') {
    lines.push('Under stress, tends to double down and escalate confrontations.');
  } else if (profile.stressResponse === 'withdraw') {
    lines.push('Under stress, pulls back to consolidate domestic position.');
  } else if (profile.stressResponse === 'delegate') {
    lines.push('Under stress, delegates crisis management to advisors.');
  } else {
    lines.push('Under stress, becomes unpredictable and may freeze decision-making.');
  }

  // Economic
  if (p.pragmatism >= 65) {
    lines.push('Prioritises economic pragmatism over ideological purity.');
  } else if (p.ideologicalRigidity >= 55) {
    lines.push('Ideology-driven economics — may resist reforms even when beneficial.');
  }

  // Trust & alliances
  if (p.paranoia >= 55) {
    lines.push('Suspicious of allies — prefers self-reliance over partnerships.');
  } else if (p.charisma >= 60 && p.empathy >= 50) {
    lines.push('Natural coalition builder — excels at forming and maintaining alliances.');
  }

  // Risk
  if (p.riskTolerance >= 70) {
    lines.push('High risk appetite — will gamble on bold strategies.');
  } else if (p.riskTolerance <= 30) {
    lines.push('Risk-averse — prefers incremental, safe moves.');
  }

  return lines;
}

function isValidProfile(p: LeaderProfile): boolean {
  if (!p.name.trim() || p.name.length < 2) return false;
  if (!p.leaderId.trim()) return false;
  return true;
}

// ─── Component ──────────────────────────────────────────────────────────────

export const ProfileBuilder: FC<ProfileBuilderProps> = ({ onSave, onCancel, existingProfile }) => {
  const initial: MbtiType = existingProfile?.mbtiType ?? 'ENTJ';

  const [mode, setMode] = useState<BuilderMode>(existingProfile ? 'hybrid' : 'preset');
  const [selectedMbti, setSelectedMbti] = useState<MbtiType>(initial);

  const [name, setName] = useState(existingProfile?.name ?? '');
  const [title, setTitle] = useState(existingProfile?.title ?? 'Custom Leader');
  const [decisionStyle, setDecisionStyle] = useState<DecisionStyle>(
    existingProfile?.decisionStyle ?? defaultDecisionStyle(initial),
  );
  const [stressResponse, setStressResponse] = useState<StressResponse>(
    existingProfile?.stressResponse ?? defaultStressResponse(initial),
  );
  const [dichotomy, setDichotomy] = useState<DichotomyScores>(
    existingProfile?.mbtiDichotomyScores ?? defaultDichotomy(initial),
  );
  const [psychology, setPsychology] = useState<PsychologySliders>(
    existingProfile?.psychology ?? defaultPsychology(initial),
  );
  const [motivPrimary, setMotivPrimary] = useState(existingProfile?.motivationPrimary ?? 'prosperity');
  const [motivSecondary, setMotivSecondary] = useState(existingProfile?.motivationSecondary ?? 'security');
  const [motivFear, setMotivFear] = useState(existingProfile?.motivationFear ?? 'economic-collapse');

  // When MBTI changes in preset/hybrid mode, update defaults
  const selectMbti = useCallback((mbti: MbtiType) => {
    setSelectedMbti(mbti);
    if (mode === 'preset') {
      setDichotomy(defaultDichotomy(mbti));
      setPsychology(defaultPsychology(mbti));
      setDecisionStyle(defaultDecisionStyle(mbti));
      setStressResponse(defaultStressResponse(mbti));
    } else if (mode === 'hybrid') {
      setDichotomy(defaultDichotomy(mbti));
    }
  }, [mode]);

  const currentProfile = useMemo<LeaderProfile>(() => ({
    leaderId: name.toLowerCase().replace(/\s+/g, '-') || 'custom-leader',
    name,
    title,
    mbtiType: selectedMbti,
    mbtiDichotomyScores: dichotomy,
    decisionStyle,
    stressResponse,
    psychology,
    motivationPrimary: motivPrimary,
    motivationSecondary: motivSecondary,
    motivationFear: motivFear,
  }), [name, title, selectedMbti, dichotomy, decisionStyle, stressResponse, psychology, motivPrimary, motivSecondary, motivFear]);

  const tendencies = useMemo(() => buildTendencyPreview(currentProfile), [currentProfile]);
  const valid = useMemo(() => isValidProfile(currentProfile), [currentProfile]);

  const updateSlider = useCallback((key: keyof PsychologySliders) => (e: ChangeEvent<HTMLInputElement>) => {
    setPsychology((prev) => ({ ...prev, [key]: Number(e.target.value) }));
  }, []);

  const updateDichotomy = useCallback((key: keyof DichotomyScores) => (e: ChangeEvent<HTMLInputElement>) => {
    setDichotomy((prev) => ({ ...prev, [key]: Number(e.target.value) }));
  }, []);

  return (
    <div style={panel} data-testid="profile-builder">
      <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: 2, marginBottom: 4 }}>
        🧠 Leader Profile Builder
      </h2>
      <p style={{ fontSize: 12, color: '#666', marginBottom: 16 }}>
        Craft a custom psychological profile for your leader.
      </p>

      {/* ── Mode Tabs ─────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['preset', 'hybrid', 'manual'] as BuilderMode[]).map((m) => (
          <button
            key={m}
            data-testid={`mode-${m}`}
            onClick={() => setMode(m)}
            style={{
              padding: '6px 18px',
              fontSize: 12,
              fontWeight: 700,
              textTransform: 'uppercase',
              border: mode === m ? '2px solid #4caf50' : '1px solid #444',
              borderRadius: 4,
              background: mode === m ? 'rgba(76,175,80,0.1)' : 'transparent',
              color: mode === m ? '#4caf50' : '#888',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {m}
          </button>
        ))}
      </div>

      {/* ── Name & Title ──────────────────────────────── */}
      <div style={sectionTitle}>Identity</div>
      <div style={card}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>Leader Name</label>
            <input
              data-testid="input-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter leader name…"
              style={{
                width: '100%',
                padding: '8px 12px',
                backgroundColor: '#0a0a0a',
                border: '1px solid #333',
                borderRadius: 4,
                color: '#e0e0e0',
                fontSize: 14,
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>Title</label>
            <input
              data-testid="input-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Supreme Commander"
              style={{
                width: '100%',
                padding: '8px 12px',
                backgroundColor: '#0a0a0a',
                border: '1px solid #333',
                borderRadius: 4,
                color: '#e0e0e0',
                fontSize: 14,
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>
      </div>

      {/* ── MBTI Selection ────────────────────────────── */}
      {(mode === 'preset' || mode === 'hybrid') && (
        <>
          <div style={sectionTitle}>MBTI Preset</div>
          <div style={mbtiGrid}>
            {MBTI_TYPES.map((t) => (
              <button
                key={t}
                data-testid={`mbti-${t}`}
                onClick={() => selectMbti(t)}
                style={{
                  padding: '10px 4px',
                  textAlign: 'center',
                  border: selectedMbti === t ? '2px solid #4caf50' : '1px solid #333',
                  borderRadius: 6,
                  background: selectedMbti === t ? 'rgba(76,175,80,0.08)' : '#111',
                  color: selectedMbti === t ? '#4caf50' : '#ccc',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 700 }}>{t}</div>
                <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>{MBTI_NAMES[t]}</div>
              </button>
            ))}
          </div>
        </>
      )}

      {/* ── Dichotomy Sliders ─────────────────────────── */}
      {(mode === 'manual' || mode === 'hybrid') && (
        <>
          <div style={sectionTitle}>MBTI Dichotomy Scores</div>
          <div style={card}>
            {(Object.keys(dichotomy) as (keyof DichotomyScores)[]).map((key) => {
              const labels: Record<string, [string, string]> = {
                EI: ['Extravert', 'Introvert'],
                SN: ['Sensing', 'Intuitive'],
                TF: ['Thinking', 'Feeling'],
                JP: ['Judging', 'Perceiving'],
              };
              const [lo, hi] = labels[key]!;
              return (
                <div key={key} style={sliderRow}>
                  <span style={{ ...sliderLabel, width: 80 }}>{lo}</span>
                  <input
                    type="range" min={0} max={100}
                    value={dichotomy[key]}
                    onChange={updateDichotomy(key)}
                    style={sliderInput}
                    data-testid={`slider-${key}`}
                  />
                  <span style={{ ...sliderLabel, width: 80, textAlign: 'left' }}>{hi}</span>
                  <span style={sliderValue}>{dichotomy[key]}</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Psychology Sliders ────────────────────────── */}
      {(mode === 'manual' || mode === 'hybrid') && (
        <>
          <div style={sectionTitle}>Psychological Dimensions</div>
          <div style={card}>
            {(Object.keys(psychology) as (keyof PsychologySliders)[]).map((key) => (
              <div key={key} style={sliderRow}>
                <span style={sliderLabel}>{key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}</span>
                <input
                  type="range" min={0} max={100}
                  value={psychology[key]}
                  onChange={updateSlider(key)}
                  style={sliderInput}
                  data-testid={`slider-${key}`}
                />
                <span style={sliderValue}>{psychology[key]}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Decision Style & Stress Response ──────────── */}
      <div style={sectionTitle}>Behavioural Patterns</div>
      <div style={{ ...card, display: 'flex', gap: 24 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 6 }}>Decision Style</label>
          {DECISION_STYLES.map((ds) => (
            <label key={ds} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, cursor: 'pointer' }}>
              <input
                type="radio"
                name="decisionStyle"
                value={ds}
                checked={decisionStyle === ds}
                onChange={() => setDecisionStyle(ds)}
                data-testid={`radio-ds-${ds}`}
              />
              <span style={{ fontSize: 12, color: '#ccc', textTransform: 'capitalize' }}>{ds}</span>
            </label>
          ))}
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 6 }}>Stress Response</label>
          {STRESS_RESPONSES.map((sr) => (
            <label key={sr} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, cursor: 'pointer' }}>
              <input
                type="radio"
                name="stressResponse"
                value={sr}
                checked={stressResponse === sr}
                onChange={() => setStressResponse(sr)}
                data-testid={`radio-sr-${sr}`}
              />
              <span style={{ fontSize: 12, color: '#ccc', textTransform: 'capitalize' }}>{sr.replace('-', ' ')}</span>
            </label>
          ))}
        </div>
      </div>

      {/* ── Motivations ───────────────────────────────── */}
      <div style={sectionTitle}>Motivations</div>
      <div style={{ ...card, display: 'flex', gap: 16 }}>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>Primary</label>
          <select
            value={motivPrimary}
            onChange={(e) => setMotivPrimary(e.target.value)}
            data-testid="select-motiv-primary"
            style={{ width: '100%', padding: 6, backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: 4, color: '#e0e0e0', fontSize: 12, fontFamily: 'inherit' }}
          >
            {MOTIVATIONS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>Secondary</label>
          <select
            value={motivSecondary}
            onChange={(e) => setMotivSecondary(e.target.value)}
            data-testid="select-motiv-secondary"
            style={{ width: '100%', padding: 6, backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: 4, color: '#e0e0e0', fontSize: 12, fontFamily: 'inherit' }}
          >
            {MOTIVATIONS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>Greatest Fear</label>
          <select
            value={motivFear}
            onChange={(e) => setMotivFear(e.target.value)}
            data-testid="select-motiv-fear"
            style={{ width: '100%', padding: 6, backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: 4, color: '#e0e0e0', fontSize: 12, fontFamily: 'inherit' }}
          >
            {FEARS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
      </div>

      {/* ── Real-Time Preview ─────────────────────────── */}
      <div style={sectionTitle}>Gameplay Tendency Preview</div>
      <div style={{ ...card, backgroundColor: '#0d1117', borderColor: '#224422' }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: '#4caf50' }}>
          {currentProfile.name || 'Unnamed Leader'} — {selectedMbti} "{MBTI_NAMES[selectedMbti]}"
        </div>
        <ul style={{ margin: 0, padding: '0 0 0 16px', listStyle: 'disc' }} data-testid="tendency-preview">
          {tendencies.map((t, i) => (
            <li key={i} style={{ fontSize: 12, color: '#bbb', lineHeight: 1.8 }}>{t}</li>
          ))}
        </ul>
      </div>

      {/* ── Actions ───────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
        <button style={btnSecondary} onClick={onCancel} data-testid="btn-cancel">
          Cancel
        </button>
        <button
          style={{ ...btnPrimary, opacity: valid ? 1 : 0.4, cursor: valid ? 'pointer' : 'not-allowed' }}
          disabled={!valid}
          onClick={() => { if (valid) onSave(currentProfile); }}
          data-testid="btn-save"
        >
          Save Profile
        </button>
      </div>
    </div>
  );
};
