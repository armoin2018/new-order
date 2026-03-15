import { useState } from 'react';
import type { FC, CSSProperties } from 'react';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ActionItem {
  id: string;
  label: string;
  category: string;
  disabled?: boolean;
  cost?: string;
}

export interface ActionMenuProps {
  actions: ActionItem[];
  onSelectAction: (actionId: string) => void;
  onEndTurn: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Group an array by a key function. */
function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const group = map.get(key);
    if (group) {
      group.push(item);
    } else {
      map.set(key, [item]);
    }
  }
  return map;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const sidebar: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: '#0f0f0f',
  borderRight: '1px solid #222',
  padding: '12px 0',
  overflowY: 'auto',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontSize: 13,
  color: '#e0e0e0',
};

const categoryHeader: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '6px 14px',
  cursor: 'pointer',
  userSelect: 'none',
  fontWeight: 700,
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: 1.2,
  color: '#888',
  borderBottom: '1px solid #1a1a1a',
};

const actionBtn: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 14px 8px 22px',
  cursor: 'pointer',
  border: 'none',
  background: 'none',
  color: '#ccc',
  fontSize: 13,
  width: '100%',
  textAlign: 'left',
  fontFamily: 'inherit',
};

const actionBtnHover: CSSProperties = {
  backgroundColor: '#1a1a1a',
};

const endTurnBtn: CSSProperties = {
  margin: '12px 14px 4px',
  padding: '10px 0',
  border: '1px solid #4caf50',
  borderRadius: 4,
  backgroundColor: 'transparent',
  color: '#4caf50',
  fontWeight: 700,
  fontSize: 14,
  cursor: 'pointer',
  textTransform: 'uppercase',
  letterSpacing: 1,
  fontFamily: 'inherit',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ActionMenu: FC<ActionMenuProps> = ({ actions, onSelectAction, onEndTurn }) => {
  const groups = groupBy(actions, (a) => a.category);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [hovered, setHovered] = useState<string | null>(null);

  const toggle = (cat: string) =>
    setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }));

  return (
    <nav style={sidebar}>
      {[...groups.entries()].map(([category, items]) => {
        const isCollapsed = collapsed[category] ?? false;
        return (
          <div key={category}>
            <div style={categoryHeader} onClick={() => toggle(category)}>
              <span>{category}</span>
              <span>{isCollapsed ? '▸' : '▾'}</span>
            </div>

            {!isCollapsed &&
              items.map((action) => (
                <button
                  key={action.id}
                  style={{
                    ...actionBtn,
                    ...(hovered === action.id ? actionBtnHover : {}),
                    ...(action.disabled ? { opacity: 0.4, cursor: 'not-allowed' } : {}),
                  }}
                  disabled={action.disabled}
                  onClick={() => onSelectAction(action.id)}
                  onMouseEnter={() => setHovered(action.id)}
                  onMouseLeave={() => setHovered(null)}
                >
                  <span>{action.label}</span>
                  {action.cost != null && (
                    <span style={{ fontSize: 11, color: '#666' }}>{action.cost}</span>
                  )}
                </button>
              ))}
          </div>
        );
      })}

      {/* Spacer pushes End Turn to bottom */}
      <div style={{ flex: 1 }} />

      <button style={endTurnBtn} onClick={onEndTurn}>
        End Turn
      </button>
    </nav>
  );
};
