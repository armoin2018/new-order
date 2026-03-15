import { useState } from 'react';
import type { FC, CSSProperties } from 'react';
import type {
  NationCivilWarState,
  ProtestMovement,
  ProtestCause,
  CivilWarState,
  UnrestReactionOption,
} from '@/data/types/civil-war.types';
import { getReactionOptions } from '@/engine/civil-war-engine';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface CivilWarPanelProps {
  civilWarState: NationCivilWarState | undefined;
  nationName: string;
  isPlayerNation: boolean;
}

/* ------------------------------------------------------------------ */
/*  Palette & shared styles                                            */
/* ------------------------------------------------------------------ */

const COLOR = {
  bg: '#0a0a0a',
  surface: '#111',
  card: '#161616',
  border: '#222',
  text: '#e0e0e0',
  textMuted: '#888',
  accent: '#4caf50',
  danger: '#e53935',
  dangerDark: '#b71c1c',
  warning: '#ff9800',
  barBg: '#222',
} as const;

/** Badge colours keyed by actual ProtestCause enum values. */
const causeBadgeColors: Record<ProtestCause, string> = {
  economic: '#ff9800',
  political: '#e53935',
  ethnic: '#ab47bc',
  religious: '#7e57c2',
  ideological: '#42a5f5',
};

const orgIcons: Record<string, string> = {
  spontaneous: '🔥',
  organized: '📢',
  militant: '⚔️',
};

/* ------------------------------------------------------------------ */
/*  Tiny helpers                                                       */
/* ------------------------------------------------------------------ */

const fmt = (n: number) => n.toLocaleString();

const signedStr = (n: number): string =>
  n > 0 ? `+${n}` : n < 0 ? `${n}` : '0';

const impactColor = (n: number): string =>
  n > 0 ? COLOR.accent : n < 0 ? COLOR.danger : COLOR.textMuted;

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

const strengthColor = (v: number): string => {
  if (v >= 75) return COLOR.danger;
  if (v >= 50) return COLOR.warning;
  if (v >= 25) return '#66bb6a';
  return COLOR.accent;
};

const prettyCause = (c: ProtestCause): string =>
  c.charAt(0).toUpperCase() + c.slice(1);

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

/**
 * Red alert banner shown when one or more civil wars are active.
 * Uses the actual CivilWarState fields: warId, rebelFactionName, cause,
 * startTurn, territoryControlPercent, militarySplitRatio,
 * economicDamagePercent, casualties, refugeesGenerated, etc.
 */
const CivilWarAlert: FC<{ wars: CivilWarState[] }> = ({ wars }) => {
  const banner: CSSProperties = {
    background: 'linear-gradient(90deg, #b71c1c 0%, #e53935 100%)',
    color: '#fff',
    padding: '12px 16px',
    borderRadius: 6,
    marginBottom: 16,
  };

  const stat: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    fontSize: 12,
    gap: 2,
  };

  const bigNum: CSSProperties = { fontSize: 18, fontWeight: 700 };

  return (
    <>
      {wars.map((war) => (
        <div
          key={war.warId}
          style={{
            ...banner,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 16,
            alignItems: 'center',
            fontWeight: 600,
          }}
        >
          <span style={{ fontSize: 20 }}>⚔️ CIVIL WAR — {war.rebelFactionName}</span>
          <div style={stat}>
            <span style={bigNum}>{war.cause}</span>
            <span>Cause</span>
          </div>
          <div style={stat}>
            <span style={bigNum}>{fmt(war.casualties)}</span>
            <span>Casualties</span>
          </div>
          <div style={stat}>
            <span style={bigNum}>{war.economicDamagePercent}%</span>
            <span>Economic Damage</span>
          </div>
          <div style={stat}>
            <span style={bigNum}>{war.territoryControlPercent}%</span>
            <span>Govt Control</span>
          </div>
          <div style={stat}>
            <span style={bigNum}>{(war.militarySplitRatio * 100).toFixed(4)}%</span>
            <span>Military Loyal</span>
          </div>
          {war.refugeesGenerated > 0 && (
            <div style={stat}>
              <span style={bigNum}>{fmt(war.refugeesGenerated)}</span>
              <span>Refugees</span>
            </div>
          )}
          {Object.keys(war.externalSupport).length > 0 && (
            <div style={stat}>
              <span style={bigNum}>🌐 {Object.keys(war.externalSupport).length}</span>
              <span>Foreign Actors</span>
            </div>
          )}
          {war.resolutionType && (
            <div style={stat}>
              <span style={bigNum}>✓</span>
              <span>{war.resolutionType.replace(/_/g, ' ')}</span>
            </div>
          )}
        </div>
      ))}
    </>
  );
};

/** Horizontal bar gauge */
const Bar: FC<{ value: number; max?: number; color: string; height?: number }> = ({
  value,
  max = 100,
  color,
  height = 8,
}) => {
  const outer: CSSProperties = {
    background: COLOR.barBg,
    borderRadius: height / 2,
    height,
    width: '100%',
    overflow: 'hidden',
  };
  const inner: CSSProperties = {
    height: '100%',
    width: `${clamp((value / max) * 100)}%`,
    background: color,
    borderRadius: height / 2,
    transition: 'width 0.3s ease',
  };
  return (
    <div style={outer}>
      <div style={inner} />
    </div>
  );
};

/** Cause badge pill */
const CauseBadge: FC<{ cause: ProtestCause }> = ({ cause }) => {
  const pill: CSSProperties = {
    display: 'inline-block',
    fontSize: 11,
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 10,
    background: causeBadgeColors[cause] ?? COLOR.textMuted,
    color: '#000',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  };
  return <span style={pill}>{prettyCause(cause)}</span>;
};

/**
 * Single protest movement card.
 *
 * Uses actual ProtestMovement fields: movementId, nationId, name, cause,
 * sizePercent, organizationLevel, demands, foreignBacking, turnsActive,
 * leaderName, publicSympathy, governmentResponse, resolved.
 */
const ProtestCard: FC<{
  movement: ProtestMovement;
  isPlayerNation: boolean;
  resolved?: boolean;
}> = ({ movement, isPlayerNation, resolved = false }) => {
  const [showReactions, setShowReactions] = useState(false);
  const reactions: UnrestReactionOption[] =
    !resolved && isPlayerNation ? getReactionOptions(movement) : [];

  const card: CSSProperties = {
    background: resolved ? '#0e0e0e' : COLOR.card,
    border: `1px solid ${resolved ? '#1a1a1a' : COLOR.border}`,
    borderRadius: 8,
    padding: 14,
    opacity: resolved ? 0.55 : 1,
    transition: 'opacity 0.2s',
  };

  const header: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    flexWrap: 'wrap',
    gap: 6,
  };

  const metaRow: CSSProperties = {
    display: 'flex',
    gap: 14,
    fontSize: 12,
    color: COLOR.textMuted,
    marginBottom: 8,
    flexWrap: 'wrap',
  };

  const demandList: CSSProperties = {
    margin: '6px 0 0 16px',
    padding: 0,
    fontSize: 12,
    color: COLOR.textMuted,
    lineHeight: 1.6,
  };

  const reactionBtnStyle = (_opt: UnrestReactionOption): CSSProperties => ({
    background: '#1e1e1e',
    border: `1px solid ${COLOR.border}`,
    borderRadius: 6,
    padding: '6px 10px',
    color: COLOR.text,
    cursor: 'pointer',
    fontSize: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    transition: 'border-color 0.15s',
  });

  return (
    <div style={card}>
      {/* Header */}
      <div style={header}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <CauseBadge cause={movement.cause} />
          <span style={{ fontSize: 14, fontWeight: 600 }}>{movement.name}</span>
          <span style={{ fontSize: 13, fontWeight: 500, color: COLOR.textMuted }}>
            {orgIcons[movement.organizationLevel] ?? ''}{' '}
            {movement.organizationLevel.charAt(0).toUpperCase() +
              movement.organizationLevel.slice(1)}
          </span>
        </div>
        {resolved && (
          <span style={{ fontSize: 11, color: COLOR.textMuted }}>Resolved</span>
        )}
      </div>

      {/* Size / strength bar — using sizePercent */}
      <div style={{ marginBottom: 6 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 11,
            color: COLOR.textMuted,
            marginBottom: 2,
          }}
        >
          <span>Size</span>
          <span>{movement.sizePercent.toFixed(4)}%</span>
        </div>
        <Bar value={movement.sizePercent} color={strengthColor(movement.sizePercent)} />
      </div>

      {/* Public sympathy gauge */}
      <div style={{ marginBottom: 8 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 11,
            color: COLOR.textMuted,
            marginBottom: 2,
          }}
        >
          <span>❤️ Public Sympathy</span>
          <span>{movement.publicSympathy}/100</span>
        </div>
        <Bar value={movement.publicSympathy} color="#42a5f5" height={6} />
      </div>

      {/* Meta row */}
      <div style={metaRow}>
        <span>🧑‍✈️ {movement.leaderName}</span>
        <span>🕐 {movement.turnsActive} turn{movement.turnsActive !== 1 ? 's' : ''} active</span>
        <span>🏛️ Govt: {movement.governmentResponse}</span>
        {movement.foreignBacking && (
          <span style={{ color: COLOR.warning }}>
            🌐 Foreign backing ({movement.foreignBacking.nationId}, level {movement.foreignBacking.level})
          </span>
        )}
      </div>

      {/* Demands */}
      {movement.demands.length > 0 && (
        <div>
          <span style={{ fontSize: 11, color: COLOR.textMuted, fontWeight: 600 }}>Demands:</span>
          <ul style={demandList}>
            {movement.demands.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Reaction panel (player only, active movements) */}
      {reactions.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <button
            onClick={() => setShowReactions((p) => !p)}
            style={{
              background: 'transparent',
              border: `1px solid ${COLOR.accent}`,
              borderRadius: 4,
              color: COLOR.accent,
              fontSize: 12,
              padding: '4px 10px',
              cursor: 'pointer',
              marginBottom: showReactions ? 8 : 0,
            }}
          >
            {showReactions ? '▾ Hide Responses' : '▸ Respond'}
          </button>

          {showReactions && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {reactions.map((opt) => (
                <button key={opt.type} style={reactionBtnStyle(opt)} title={opt.description}>
                  <span style={{ fontWeight: 600 }}>{opt.label}</span>
                  <span style={{ fontSize: 10, color: COLOR.textMuted }}>{opt.description}</span>
                  <div style={{ display: 'flex', gap: 8, fontSize: 10, marginTop: 2 }}>
                    <span style={{ color: impactColor(opt.stabilityEffect) }}>
                      Stab {signedStr(opt.stabilityEffect)}
                    </span>
                    <span style={{ color: impactColor(opt.unrestEffect) }}>
                      Unrest {signedStr(opt.unrestEffect)}
                    </span>
                    <span style={{ color: impactColor(opt.internationalReputationEffect) }}>
                      Rep {signedStr(opt.internationalReputationEffect)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export const CivilWarPanel: FC<CivilWarPanelProps> = ({
  civilWarState,
  nationName,
  isPlayerNation,
}) => {
  const [showResolved, setShowResolved] = useState(false);

  /* ----- Container ----- */
  const container: CSSProperties = {
    background: COLOR.bg,
    color: COLOR.text,
    fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
    padding: 20,
    borderRadius: 10,
    border: `1px solid ${COLOR.border}`,
    maxWidth: 720,
    width: '100%',
  };

  const heading: CSSProperties = {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 14,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  };

  /* ----- Undefined state ----- */
  if (!civilWarState) {
    return (
      <div style={container}>
        <div style={heading}>✊ Civil War Monitor</div>
        <p style={{ color: COLOR.textMuted, fontSize: 13 }}>
          ✊ Civil War Monitor — Available after game starts
        </p>
      </div>
    );
  }

  const activeMovements = civilWarState.protestMovements.filter((m) => !m.resolved);
  const resolvedMovements = civilWarState.protestMovements.filter((m) => m.resolved);
  const activeWars = civilWarState.activeCivilWars.filter((w) => w.resolutionType == null);
  const hasAnything = activeMovements.length > 0 || activeWars.length > 0;

  /* ----- Empty / stable ----- */
  if (!hasAnything && resolvedMovements.length === 0) {
    return (
      <div style={container}>
        <div style={heading}>✊ {nationName} — Civil War Monitor</div>
        <p style={{ color: COLOR.textMuted, fontSize: 13 }}>
          ✊ Civil Stability — No active protests or unrest
        </p>
        <StatsBar state={civilWarState} />
      </div>
    );
  }

  return (
    <div style={container}>
      {/* Title */}
      <div style={heading}>✊ {nationName} — Civil War Monitor</div>

      {/* Civil war alert banner(s) */}
      {activeWars.length > 0 && <CivilWarAlert wars={activeWars} />}

      {/* Stats bar */}
      <StatsBar state={civilWarState} />

      {/* Active protest cards */}
      {activeMovements.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: COLOR.text,
              marginBottom: 8,
              display: 'block',
            }}
          >
            Active Protests ({activeMovements.length})
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {activeMovements.map((m) => (
              <ProtestCard
                key={m.movementId}
                movement={m}
                isPlayerNation={isPlayerNation}
              />
            ))}
          </div>
        </div>
      )}

      {/* Resolved toggle */}
      {resolvedMovements.length > 0 && (
        <div>
          <button
            onClick={() => setShowResolved((p) => !p)}
            style={{
              background: 'transparent',
              border: `1px solid ${COLOR.border}`,
              borderRadius: 4,
              color: COLOR.textMuted,
              fontSize: 12,
              padding: '4px 12px',
              cursor: 'pointer',
              marginBottom: showResolved ? 10 : 0,
            }}
          >
            {showResolved
              ? `▾ Hide Resolved (${resolvedMovements.length})`
              : `▸ Show Resolved (${resolvedMovements.length})`}
          </button>

          {showResolved && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {resolvedMovements.map((m) => (
                <ProtestCard
                  key={m.movementId}
                  movement={m}
                  isPlayerNation={isPlayerNation}
                  resolved
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Stats bar                                                          */
/* ------------------------------------------------------------------ */

const StatsBar: FC<{ state: NationCivilWarState }> = ({ state }) => {
  const wrapper: CSSProperties = {
    display: 'flex',
    gap: 20,
    flexWrap: 'wrap',
    marginBottom: 14,
    padding: '8px 12px',
    background: COLOR.surface,
    borderRadius: 6,
    border: `1px solid ${COLOR.border}`,
  };

  const item: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    fontSize: 12,
    gap: 2,
  };

  const num: CSSProperties = { fontSize: 16, fontWeight: 700, color: COLOR.accent };

  const totalProtests = state.protestMovements.length;
  const totalWars = state.activeCivilWars.length;

  return (
    <div style={wrapper}>
      <div style={item}>
        <span style={num}>{totalProtests}</span>
        <span style={{ color: COLOR.textMuted }}>Total Protests</span>
      </div>
      <div style={item}>
        <span style={{ ...num, color: totalWars > 0 ? COLOR.danger : COLOR.accent }}>
          {totalWars}
        </span>
        <span style={{ color: COLOR.textMuted }}>Civil Wars</span>
      </div>
      <div style={item}>
        <span
          style={{
            ...num,
            color: state.consecutiveHighUnrestTurns >= 3 ? COLOR.warning : COLOR.accent,
          }}
        >
          {state.consecutiveHighUnrestTurns}
        </span>
        <span style={{ color: COLOR.textMuted }}>Consecutive High Unrest</span>
      </div>
      <div style={item}>
        <span style={num}>{state.unrestResponseHistory.length}</span>
        <span style={{ color: COLOR.textMuted }}>Responses Taken</span>
      </div>
    </div>
  );
};

export default CivilWarPanel;
