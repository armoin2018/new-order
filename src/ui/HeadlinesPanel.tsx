import { useState } from 'react';
import type { FC, CSSProperties } from 'react';
import type {
  Headline,
  HeadlineArchive,
  TurnHeadlines,
} from '@/data/types';
import { HeadlinePerspective } from '@/data/types';

export interface HeadlinesPanelProps {
  currentTurnHeadlines: TurnHeadlines | null;
  archive: HeadlineArchive;
  onHeadlineClick?: (headline: Headline) => void;
}

const TABS = [
  { key: HeadlinePerspective.WesternPress, label: 'Western Press', color: '#4a9eff' },
  { key: HeadlinePerspective.StatePropaganda, label: 'State Propaganda', color: '#ff4a4a' },
  { key: HeadlinePerspective.Intelligence, label: 'Intelligence', color: '#4aff4a' },
] as const;

const containerStyle: CSSProperties = {
  background: '#0a0a0a',
  color: '#e0e0e0',
  border: '1px solid #333',
  borderRadius: 6,
  padding: 16,
  position: 'relative',
  fontFamily: 'sans-serif',
};

const tabBarStyle: CSSProperties = {
  display: 'flex',
  gap: 0,
  borderBottom: '1px solid #333',
  marginBottom: 16,
};

const headlineTextStyle: CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  lineHeight: 1.3,
  cursor: 'pointer',
  transition: 'color 0.15s',
};

const subtextStyle: CSSProperties = {
  fontSize: 14,
  color: '#999',
  marginTop: 6,
  cursor: 'pointer',
};

const awaitingStyle: CSSProperties = {
  color: '#777',
  fontStyle: 'italic',
  textAlign: 'center',
  padding: '24px 0',
};

const pressReviewBtnStyle: CSSProperties = {
  position: 'absolute',
  top: 12,
  right: 12,
  background: 'transparent',
  border: '1px solid #333',
  borderRadius: 4,
  color: '#e0e0e0',
  fontSize: 12,
  padding: '4px 10px',
  cursor: 'pointer',
  transition: 'border-color 0.15s',
};

const archivePanelStyle: CSSProperties = {
  marginTop: 16,
  borderTop: '1px solid #333',
  paddingTop: 12,
  maxHeight: 300,
  overflowY: 'auto',
};

const archiveTurnHeaderStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: '#888',
  marginTop: 12,
  marginBottom: 4,
  textTransform: 'uppercase',
  letterSpacing: 1,
};

const archiveHeadlineStyle: CSSProperties = {
  fontSize: 13,
  color: '#ccc',
  padding: '3px 0 3px 8px',
  borderLeft: '2px solid #333',
  marginBottom: 2,
  cursor: 'pointer',
  transition: 'color 0.15s',
};

export const HeadlinesPanel: FC<HeadlinesPanelProps> = ({
  currentTurnHeadlines,
  archive,
  onHeadlineClick,
}) => {
  const [activeTab, setActiveTab] = useState<HeadlinePerspective>(
    HeadlinePerspective.WesternPress,
  );
  const [archiveOpen, setArchiveOpen] = useState(false);

  const activeTabMeta = TABS.find((t) => t.key === activeTab);
  const accentColor = activeTabMeta?.color ?? '#4a9eff';

  const currentHeadline: Headline | undefined =
    currentTurnHeadlines?.headlines[activeTab];

  return (
    <div style={containerStyle}>
      {/* Press Review toggle */}
      <button
        type="button"
        style={pressReviewBtnStyle}
        onMouseEnter={(e) => {
          (e.currentTarget.style.borderColor = '#666');
        }}
        onMouseLeave={(e) => {
          (e.currentTarget.style.borderColor = '#333');
        }}
        onClick={() => {
          setArchiveOpen((prev) => !prev);
        }}
      >
        📰 Press Review
      </button>

      {/* Tab bar */}
      <div style={tabBarStyle}>
        {TABS.map((tab) => {
          const isActive = tab.key === activeTab;
          const tabStyle: CSSProperties = {
            flex: 1,
            background: 'transparent',
            border: 'none',
            borderBottom: isActive ? `3px solid ${tab.color}` : '3px solid transparent',
            color: isActive ? '#e0e0e0' : '#777',
            fontWeight: isActive ? 700 : 400,
            fontSize: 13,
            padding: '8px 4px',
            cursor: 'pointer',
            textAlign: 'center',
            transition: 'color 0.15s, border-color 0.15s',
          };
          return (
            <button
              key={tab.key}
              type="button"
              style={tabStyle}
              onClick={() => {
                setActiveTab(tab.key);
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Current headline */}
      {currentTurnHeadlines == null || currentHeadline == null ? (
        <div style={awaitingStyle}>Awaiting dispatches...</div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          style={{ cursor: 'pointer' }}
          onClick={() => {
            onHeadlineClick?.(currentHeadline);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              onHeadlineClick?.(currentHeadline);
            }
          }}
          onMouseEnter={(e) => {
            const target = e.currentTarget.querySelector<HTMLElement>('[data-headline-text]');
            if (target) {
              target.style.color = accentColor;
            }
          }}
          onMouseLeave={(e) => {
            const target = e.currentTarget.querySelector<HTMLElement>('[data-headline-text]');
            if (target) {
              target.style.color = '#e0e0e0';
            }
          }}
        >
          <div data-headline-text="" style={{ ...headlineTextStyle, color: '#e0e0e0' }}>
            {currentHeadline.text}
          </div>
          {currentHeadline.subtext != null && currentHeadline.subtext !== '' && (
            <div style={subtextStyle}>{currentHeadline.subtext}</div>
          )}
        </div>
      )}

      {/* Archive panel */}
      {archiveOpen && (
        <div style={archivePanelStyle}>
          {archive.length === 0 ? (
            <div style={{ color: '#666', fontSize: 13 }}>No archived headlines yet.</div>
          ) : (
            [...archive]
              .sort((a, b) => b.turn - a.turn)
              .map((turnEntry) => (
                <div key={turnEntry.turn}>
                  <div style={archiveTurnHeaderStyle}>Turn {turnEntry.turn}</div>
                  {TABS.map((tab) => {
                    const headline: Headline | undefined = turnEntry.headlines[tab.key];
                    if (headline == null) return null;
                    return (
                      <div
                        key={tab.key}
                        role="button"
                        tabIndex={0}
                        style={{ ...archiveHeadlineStyle, borderLeftColor: tab.color }}
                        onClick={() => {
                          onHeadlineClick?.(headline);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            onHeadlineClick?.(headline);
                          }
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = tab.color;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = '#ccc';
                        }}
                      >
                        <strong>{tab.label}:</strong> {headline.text}
                      </div>
                    );
                  })}
                </div>
              ))
          )}
        </div>
      )}
    </div>
  );
};
