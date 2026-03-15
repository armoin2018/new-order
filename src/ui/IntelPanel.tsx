import type { FC, CSSProperties } from 'react';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface IntelFaction {
  factionId: string;
  name: string;
  stability: number;
  tension: number;
  clarity: number;
}

export interface IntelPanelProps {
  factions: IntelFaction[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tensionColor(value: number): string {
  if (value > 66) return '#ef5350';
  if (value >= 33) return '#ffb300';
  return '#4caf50';
}

function clarityLabel(value: number): string {
  if (value >= 80) return 'High';
  if (value >= 50) return 'Moderate';
  return 'Low';
}

function stabilityColor(value: number): string {
  if (value > 60) return '#4caf50';
  if (value >= 30) return '#ffb300';
  return '#ef5350';
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const sidebar: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: '#0f0f0f',
  borderLeft: '1px solid #222',
  padding: '12px 14px',
  overflowY: 'auto',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontSize: 13,
  color: '#e0e0e0',
  gap: 4,
};

const title: CSSProperties = {
  fontWeight: 700,
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: 1.2,
  color: '#888',
  marginBottom: 8,
};

const card: CSSProperties = {
  backgroundColor: '#141414',
  border: '1px solid #1e1e1e',
  borderRadius: 4,
  padding: '10px 12px',
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
};

const row: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  fontSize: 12,
};

const badge: CSSProperties = {
  padding: '1px 6px',
  borderRadius: 3,
  fontSize: 10,
  fontWeight: 600,
  textTransform: 'uppercase',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const IntelPanel: FC<IntelPanelProps> = ({ factions }) => {
  return (
    <aside style={sidebar}>
      <div style={title}>Intelligence Brief</div>

      {factions.map((f) => (
        <div key={f.factionId} style={card}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{f.name}</div>

          <div style={row}>
            <span style={{ color: '#888' }}>Stability</span>
            <span style={{ color: stabilityColor(f.stability), fontWeight: 600 }}>
              {f.stability}
            </span>
          </div>

          <div style={row}>
            <span style={{ color: '#888' }}>Tension</span>
            <span style={{ color: tensionColor(f.tension), fontWeight: 600 }}>
              {f.tension}
            </span>
          </div>

          <div style={row}>
            <span style={{ color: '#888' }}>Intel Clarity</span>
            <span>
              <span style={{ color: '#bbb', marginRight: 6 }}>{f.clarity}%</span>
              <span
                style={{
                  ...badge,
                  backgroundColor:
                    f.clarity >= 80
                      ? 'rgba(76,175,80,0.15)'
                      : f.clarity >= 50
                        ? 'rgba(255,179,0,0.15)'
                        : 'rgba(239,83,80,0.15)',
                  color:
                    f.clarity >= 80
                      ? '#4caf50'
                      : f.clarity >= 50
                        ? '#ffb300'
                        : '#ef5350',
                }}
              >
                {clarityLabel(f.clarity)}
              </span>
            </span>
          </div>
        </div>
      ))}
    </aside>
  );
};
