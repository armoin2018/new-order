import type { FC, CSSProperties } from 'react';
import { useCurrentTurn, usePlayerFaction, useNationState } from '@/engine/hooks';
import type { FactionId } from '@/data/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FACTION_LABELS: Record<FactionId, string> = {
  us: 'United States',
  china: 'China',
  russia: 'Russia',
  japan: 'Japan',
  iran: 'Iran',
  dprk: 'North Korea',
  eu: 'European Union',
  syria: 'Syria',
};

/** Translate a turn number into a readable simulated date (March 2026 + N months). */
function simulatedDate(turn: number): string {
  const base = new Date(2026, 2, 1); // March 2026
  base.setMonth(base.getMonth() + turn);
  return base.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/** Pick a colour based on a 0-100 stat value. */
function statColor(value: number): string {
  if (value > 60) return '#4caf50';
  if (value >= 30) return '#ffb300';
  return '#ef5350';
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const bar: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 16px',
  backgroundColor: '#111',
  borderBottom: '1px solid #222',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontSize: 13,
  color: '#e0e0e0',
  minHeight: 48,
  gap: 16,
};

const sectionLeft: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  flexShrink: 0,
};

const sectionCenter: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: 1,
  fontWeight: 700,
  fontSize: 15,
  textTransform: 'uppercase',
  letterSpacing: 1.5,
};

const sectionRight: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  flexShrink: 0,
};

const pillStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '2px 8px',
  borderRadius: 4,
  backgroundColor: '#1a1a1a',
  fontSize: 12,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const TopBar: FC = () => {
  const turn = useCurrentTurn();
  const factionId = usePlayerFaction();
  const nation = useNationState(factionId);

  const label = FACTION_LABELS[factionId] ?? factionId;

  return (
    <header style={bar}>
      {/* ── Left: turn + date ── */}
      <div style={sectionLeft}>
        <span style={{ fontWeight: 600 }}>Turn {turn}</span>
        <span style={{ color: '#888' }}>|</span>
        <span style={{ color: '#aaa' }}>{simulatedDate(turn)}</span>
      </div>

      {/* ── Center: faction name ── */}
      <div style={sectionCenter}>{label}</div>

      {/* ── Right: key stats ── */}
      <div style={sectionRight}>
        {nation ? (
          <>
            <Stat label="STB" value={nation.stability} />
            <Stat label="TRS" value={nation.treasury} isCurrency />
            <Stat label="MIL" value={nation.militaryReadiness} />
            <Stat label="DIP" value={nation.diplomaticInfluence} />
            <Stat label="POP" value={nation.popularity} />
          </>
        ) : (
          <span style={{ color: '#666' }}>No data</span>
        )}
      </div>
    </header>
  );
};

// ---------------------------------------------------------------------------
// Stat pill sub-component
// ---------------------------------------------------------------------------

interface StatProps {
  label: string;
  value: number;
  isCurrency?: boolean;
}

const Stat: FC<StatProps> = ({ label, value, isCurrency }) => {
  const display = isCurrency ? `$${value.toFixed(0)}B` : String(Math.round(value));
  const color = isCurrency ? '#e0e0e0' : statColor(value);

  return (
    <span style={pillStyle}>
      <span style={{ color: '#888' }}>{label}</span>
      <span style={{ color, fontWeight: 600 }}>{display}</span>
    </span>
  );
};
