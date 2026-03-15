import type { FC, ReactNode, CSSProperties } from 'react';
import { TopBar } from './TopBar';
import { ActionMenu } from './ActionMenu';
import { MapViewport } from './MapViewport';

import type { ActionMenuProps } from './ActionMenu';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CommandCenterProps {
  /** Props forwarded to the ActionMenu sidebar. */
  actionMenuProps: ActionMenuProps;
  /** Right panel content (IntelPanel, DiplomacyPanel, etc.). */
  rightPanel: ReactNode;
  /** Footer slot — typically the HeadlinesPanel ticker. */
  footer?: ReactNode;
  /** Full-screen overlay slot — e.g. StrategicDashboard. */
  overlay?: ReactNode;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const shell: CSSProperties = {
  display: 'grid',
  gridTemplateAreas: `
    "topbar   topbar  topbar"
    "left     center  right"
    "footer   footer  footer"
  `,
  gridTemplateColumns: '240px 1fr 260px',
  gridTemplateRows: 'auto 1fr auto',
  width: '100vw',
  height: '100vh',
  backgroundColor: '#0a0a0a',
  color: '#e0e0e0',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  overflow: 'hidden',
};

const area = (name: string): CSSProperties => ({ gridArea: name, minHeight: 0, minWidth: 0 });

const footerPlaceholder: CSSProperties = {
  gridArea: 'footer',
  minHeight: 36,
  borderTop: '1px solid #222',
  backgroundColor: '#0f0f0f',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#444',
  fontSize: 12,
};

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 100,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const CommandCenter: FC<CommandCenterProps> = ({
  actionMenuProps,
  rightPanel,
  footer,
  overlay,
}) => {
  return (
    <>
      <div style={shell}>
        {/* Top bar */}
        <div style={area('topbar')}>
          <TopBar />
        </div>

        {/* Left sidebar — actions / orders */}
        <div style={area('left')}>
          <ActionMenu
            actions={actionMenuProps.actions}
            onSelectAction={actionMenuProps.onSelectAction}
            onEndTurn={actionMenuProps.onEndTurn}
          />
        </div>

        {/* Center — map viewport */}
        <div style={area('center')}>
          <MapViewport />
        </div>

        {/* Right sidebar — intel / status / diplomacy */}
        <div style={area('right')}>{rightPanel}</div>

        {/* Footer — headlines ticker */}
        {footer ? (
          <div style={area('footer')}>{footer}</div>
        ) : (
          <div style={footerPlaceholder}>Headlines ticker will appear here</div>
        )}
      </div>

      {/* Full-screen overlay (e.g. StrategicDashboard) */}
      {overlay != null && <div style={overlayStyle}>{overlay}</div>}
    </>
  );
};
