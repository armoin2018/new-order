import { useState } from 'react';
import type { FC } from 'react';

/* ------------------------------------------------------------------ */
/*  Exported types                                                     */
/* ------------------------------------------------------------------ */

export interface DiplomacyNationData {
  factionId: string;
  name: string;
  leaderName: string;
  tensionLevel: number;       // -100 to +100
  chemistry: number;          // -50 to +50
  trustScore: number;         // 0-100
  grudgeCount: number;
  relationshipLabel: string;  // e.g. "Allied", "Neutral", "Hostile"
}

export interface DiplomacyPact {
  id: string;
  type: string;               // 'non_aggression' | 'trade_deal' | 'defense_pact' | 'intel_sharing'
  partnerFaction: string;
  turnsRemaining: number | null;
  credibilityRequired: number;
}

export interface DiplomacyPanelProps {
  playerFaction: string;
  nations: DiplomacyNationData[];
  activePacts: DiplomacyPact[];
  onProposeAgreement?: (targetFaction: string, agreementType: string) => void;
  onDiplomaticAction?: (targetFaction: string, actionType: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const AGREEMENT_TYPES = [
  'non_aggression',
  'trade_deal',
  'defense_pact',
  'intel_sharing',
] as const;

const DIPLOMATIC_ACTION_TYPES = [
  'improve_relations',
  'issue_warning',
  'demand_concessions',
  'red_telephone',
] as const;

const AGREEMENT_LABELS: Record<string, string> = {
  non_aggression: 'Non-Aggression Pact',
  trade_deal: 'Trade Deal',
  defense_pact: 'Defense Pact',
  intel_sharing: 'Intelligence Sharing',
};

const ACTION_LABELS: Record<string, string> = {
  improve_relations: 'Improve Relations',
  issue_warning: 'Issue Warning',
  demand_concessions: 'Demand Concessions',
  red_telephone: 'Red Telephone',
};

const PACT_ICONS: Record<string, string> = {
  non_aggression: '🕊️',
  trade_deal: '📦',
  defense_pact: '🛡️',
  intel_sharing: '🔍',
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const tensionColor = (level: number): string => {
  if (level < -30) return '#4aff4a';
  if (level <= 30) return '#ffaa00';
  return '#ff4a4a';
};

const tensionPercent = (level: number): number =>
  ((level + 100) / 200) * 100;

const chemistryIndicator = (value: number): string => {
  if (value > 0) return `+${value}`;
  return `${value}`;
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const DiplomacyPanel: FC<DiplomacyPanelProps> = ({
  playerFaction,
  nations,
  activePacts,
  onProposeAgreement,
  onDiplomaticAction,
}) => {
  const [selectedFaction, setSelectedFaction] = useState<string | null>(null);
  const [showAgreementMenu, setShowAgreementMenu] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);

  const selectedNation = nations.find((n) => n.factionId === selectedFaction) ?? null;
  const selectedPacts = activePacts.filter((p) => p.partnerFaction === selectedFaction);

  const handleSelectNation = (factionId: string) => {
    setSelectedFaction(factionId);
    setShowAgreementMenu(false);
    setShowActionMenu(false);
  };

  const handleProposeAgreement = (agreementType: string) => {
    if (selectedFaction && onProposeAgreement) {
      onProposeAgreement(selectedFaction, agreementType);
    }
    setShowAgreementMenu(false);
  };

  const handleDiplomaticAction = (actionType: string) => {
    if (selectedFaction && onDiplomaticAction) {
      onDiplomaticAction(selectedFaction, actionType);
    }
    setShowActionMenu(false);
  };

  /* ---- styles ---- */

  const panelStyle: React.CSSProperties = {
    width: 260,
    background: '#111',
    borderLeft: '1px solid #333',
    color: '#e0e0e0',
    fontFamily: 'monospace',
    fontSize: 12,
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
  };

  const headerStyle: React.CSSProperties = {
    padding: '10px 12px',
    fontWeight: 700,
    fontSize: 13,
    letterSpacing: 1,
    textTransform: 'uppercase',
    borderBottom: '1px solid #333',
    background: '#0a0a0a',
    flexShrink: 0,
  };

  const scrollStyle: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    padding: '8px 10px',
  };

  const nationBtnStyle = (isSelected: boolean): React.CSSProperties => ({
    display: 'block',
    width: '100%',
    padding: '6px 8px',
    marginBottom: 2,
    background: isSelected ? '#1a1a1a' : 'transparent',
    border: isSelected ? '1px solid #555' : '1px solid transparent',
    borderRadius: 3,
    color: isSelected ? '#fff' : '#ccc',
    textAlign: 'left',
    cursor: 'pointer',
    fontSize: 12,
    fontFamily: 'monospace',
  });

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#888',
    marginTop: 12,
    marginBottom: 6,
  };

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '3px 0',
  };

  const labelStyle: React.CSSProperties = {
    color: '#999',
    fontSize: 11,
  };

  const valueStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
  };

  const badgeStyle = (bg: string): React.CSSProperties => ({
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 3,
    fontSize: 10,
    fontWeight: 700,
    background: bg,
    color: '#000',
    letterSpacing: 0.5,
  });

  const dropdownBtnStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    padding: '6px 8px',
    marginTop: 6,
    background: '#1a1a1a',
    border: '1px solid #444',
    borderRadius: 3,
    color: '#e0e0e0',
    fontSize: 11,
    fontFamily: 'monospace',
    cursor: 'pointer',
    textAlign: 'left',
  };

  const menuItemStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    padding: '5px 10px',
    background: '#1a1a1a',
    border: 'none',
    borderBottom: '1px solid #2a2a2a',
    color: '#e0e0e0',
    fontSize: 11,
    fontFamily: 'monospace',
    cursor: 'pointer',
    textAlign: 'left',
  };

  const pactRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 0',
    fontSize: 11,
    borderBottom: '1px solid #222',
  };

  const promptStyle: React.CSSProperties = {
    padding: '24px 12px',
    textAlign: 'center',
    color: '#666',
    fontSize: 12,
    fontStyle: 'italic',
  };

  /* ---- render ---- */

  return (
    <div style={panelStyle} data-testid="diplomacy-panel" data-player={playerFaction}>
      <div style={headerStyle}>Diplomacy</div>

      <div style={scrollStyle}>
        {/* ---- Nation Selector ---- */}
        <div style={sectionTitleStyle}>Nations</div>
        {nations.map((nation) => (
          <button
            key={nation.factionId}
            style={nationBtnStyle(nation.factionId === selectedFaction)}
            onClick={() => handleSelectNation(nation.factionId)}
          >
            {nation.name}
          </button>
        ))}

        {/* ---- No selection prompt ---- */}
        {selectedNation === null && (
          <div style={promptStyle}>Select a nation</div>
        )}

        {/* ---- Relationship Detail ---- */}
        {selectedNation !== null && (
          <>
            <div style={sectionTitleStyle}>
              Relationship — {selectedNation.name}
            </div>

            {/* Leader */}
            <div style={rowStyle}>
              <span style={labelStyle}>Leader</span>
              <span style={valueStyle}>{selectedNation.leaderName}</span>
            </div>

            {/* Tension Gauge */}
            <div style={{ marginTop: 8, marginBottom: 4 }}>
              <div style={rowStyle}>
                <span style={labelStyle}>Tension</span>
                <span style={{ ...valueStyle, color: tensionColor(selectedNation.tensionLevel) }}>
                  {selectedNation.tensionLevel > 0 ? '+' : ''}
                  {selectedNation.tensionLevel}
                </span>
              </div>
              <div
                style={{
                  width: '100%',
                  height: 6,
                  background: '#222',
                  borderRadius: 3,
                  overflow: 'hidden',
                  marginTop: 2,
                }}
              >
                <div
                  style={{
                    width: `${tensionPercent(selectedNation.tensionLevel)}%`,
                    height: '100%',
                    background: tensionColor(selectedNation.tensionLevel),
                    borderRadius: 3,
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 9,
                  color: '#555',
                  marginTop: 1,
                }}
              >
                <span>Allied</span>
                <span>Neutral</span>
                <span>Hostile</span>
              </div>
            </div>

            {/* Chemistry */}
            <div style={rowStyle}>
              <span style={labelStyle}>Chemistry</span>
              <span
                style={{
                  ...valueStyle,
                  color: selectedNation.chemistry >= 0 ? '#4aff4a' : '#ff4a4a',
                }}
              >
                {chemistryIndicator(selectedNation.chemistry)}
              </span>
            </div>

            {/* Trust */}
            <div style={rowStyle}>
              <span style={labelStyle}>Trust</span>
              <span style={valueStyle}>{selectedNation.trustScore}%</span>
            </div>

            {/* Grudge */}
            {selectedNation.grudgeCount > 0 && (
              <div style={rowStyle}>
                <span style={labelStyle}>Grudges</span>
                <span style={{ ...valueStyle, color: '#ff4a4a' }}>
                  {selectedNation.grudgeCount}
                </span>
              </div>
            )}

            {/* Relationship label badge */}
            <div style={{ marginTop: 6 }}>
              <span
                style={badgeStyle(tensionColor(selectedNation.tensionLevel))}
              >
                {selectedNation.relationshipLabel}
              </span>
            </div>

            {/* ---- Active Pacts ---- */}
            <div style={sectionTitleStyle}>Active Pacts</div>
            {selectedPacts.length === 0 && (
              <div style={{ color: '#555', fontSize: 11, fontStyle: 'italic' }}>
                No active pacts
              </div>
            )}
            {selectedPacts.map((pact) => {
              const icon = PACT_ICONS[pact.type] ?? '📄';
              const label = AGREEMENT_LABELS[pact.type] ?? pact.type;
              return (
                <div key={pact.id} style={pactRowStyle}>
                  <span>{icon}</span>
                  <span style={{ flex: 1 }}>{label}</span>
                  <span style={{ color: '#888', fontSize: 10 }}>
                    {pact.turnsRemaining !== null
                      ? `${pact.turnsRemaining}t`
                      : '∞'}
                  </span>
                </div>
              );
            })}

            {/* ---- Action Buttons ---- */}
            <div style={sectionTitleStyle}>Actions</div>

            {/* Propose Agreement */}
            <div style={{ position: 'relative' }}>
              <button
                style={dropdownBtnStyle}
                onClick={() => {
                  setShowAgreementMenu(!showAgreementMenu);
                  setShowActionMenu(false);
                }}
              >
                Propose Agreement ▾
              </button>
              {showAgreementMenu && (
                <div
                  style={{
                    border: '1px solid #444',
                    borderRadius: 3,
                    overflow: 'hidden',
                    marginTop: 2,
                  }}
                >
                  {AGREEMENT_TYPES.map((type) => {
                    const label = AGREEMENT_LABELS[type] ?? type;
                    return (
                      <button
                        key={type}
                        style={menuItemStyle}
                        onClick={() => handleProposeAgreement(type)}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Diplomatic Action */}
            <div style={{ position: 'relative' }}>
              <button
                style={dropdownBtnStyle}
                onClick={() => {
                  setShowActionMenu(!showActionMenu);
                  setShowAgreementMenu(false);
                }}
              >
                Diplomatic Action ▾
              </button>
              {showActionMenu && (
                <div
                  style={{
                    border: '1px solid #444',
                    borderRadius: 3,
                    overflow: 'hidden',
                    marginTop: 2,
                  }}
                >
                  {DIPLOMATIC_ACTION_TYPES.map((type) => {
                    const label = ACTION_LABELS[type] ?? type;
                    return (
                      <button
                        key={type}
                        style={menuItemStyle}
                        onClick={() => handleDiplomaticAction(type)}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
