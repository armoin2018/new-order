/**
 * CNFL-1400 — Command Center UI Shell · Component Tests
 *
 * Covers: MapViewport, ActionMenu, IntelPanel, TopBar, CommandCenter
 * Uses react-dom/client directly (no @testing-library/react).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

import { MapViewport } from '@/ui/MapViewport';
import { ActionMenu } from '@/ui/ActionMenu';
import { IntelPanel } from '@/ui/IntelPanel';
import { TopBar } from '@/ui/TopBar';
import { CommandCenter } from '@/ui/CommandCenter';
import { useGameStore } from '@/engine/store';

import type { Root } from 'react-dom/client';
import type { ActionItem } from '@/ui/ActionMenu';
import type { IntelFaction } from '@/ui/IntelPanel';

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

function render(element: React.ReactElement): void {
  act(() => {
    root.render(element);
  });
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SAMPLE_ACTIONS: ActionItem[] = [
  { id: 'dip-1', label: 'Propose Summit', category: 'Diplomacy', cost: '5 AP' },
  { id: 'dip-2', label: 'Recall Ambassador', category: 'Diplomacy' },
  { id: 'mil-1', label: 'Deploy Fleet', category: 'Military', cost: '12 AP' },
  { id: 'mil-2', label: 'Fortify Border', category: 'Military', disabled: true },
  { id: 'eco-1', label: 'Impose Tariffs', category: 'Economy' },
];

const SAMPLE_FACTIONS: IntelFaction[] = [
  { factionId: 'china', name: 'China', stability: 72, tension: 80, clarity: 45 },
  { factionId: 'russia', name: 'Russia', stability: 40, tension: 55, clarity: 60 },
  { factionId: 'japan', name: 'Japan', stability: 88, tension: 15, clarity: 90 },
];

function setStoreForTopBar(): void {
  useGameStore.setState({
    currentTurn: 5 as never,
    playerFaction: 'us',
    nationStates: {
      us: {
        factionId: 'us',
        stability: 65,
        treasury: 420,
        gdp: 21000,
        inflation: 3,
        militaryReadiness: 82,
        nuclearThreshold: 10,
        diplomaticInfluence: 70,
        popularity: 55,
        allianceCredibility: 75,
        techLevel: 90,
      },
    } as never,
  });
}

// ===========================================================================
// MapViewport
// ===========================================================================

describe('MapViewport', () => {
  it('renders without crashing', () => {
    render(<MapViewport />);
    expect(container.innerHTML).not.toBe('');
  });

  it('contains faction names', () => {
    render(<MapViewport />);
    expect(container.textContent).toContain('United States');
  });

  it('contains interactive map elements', () => {
    render(<MapViewport />);
    expect(container.textContent).toContain('China');
  });
});

// ===========================================================================
// ActionMenu
// ===========================================================================

describe('ActionMenu', () => {
  const noop = () => {};

  it('renders action items', () => {
    render(
      <ActionMenu actions={SAMPLE_ACTIONS} onSelectAction={noop} onEndTurn={noop} />,
    );
    for (const action of SAMPLE_ACTIONS) {
      expect(container.textContent).toContain(action.label);
    }
  });

  it('groups actions by category with headers', () => {
    render(
      <ActionMenu actions={SAMPLE_ACTIONS} onSelectAction={noop} onEndTurn={noop} />,
    );
    const categories = new Set(SAMPLE_ACTIONS.map((a) => a.category));
    for (const cat of categories) {
      expect(container.textContent).toContain(cat);
    }
  });

  it('calls onSelectAction when an action button is clicked', () => {
    const handler = vi.fn();
    render(
      <ActionMenu actions={SAMPLE_ACTIONS} onSelectAction={handler} onEndTurn={noop} />,
    );
    const buttons = container.querySelectorAll('button');
    // First non-End-Turn button should correspond to the first enabled action
    const actionButton = Array.from(buttons).find(
      (btn) => btn.textContent?.includes('Propose Summit'),
    );
    expect(actionButton).toBeDefined();
    act(() => {
      actionButton!.click();
    });
    expect(handler).toHaveBeenCalledWith('dip-1');
  });

  it('shows cost badge when cost is provided', () => {
    render(
      <ActionMenu actions={SAMPLE_ACTIONS} onSelectAction={noop} onEndTurn={noop} />,
    );
    expect(container.textContent).toContain('5 AP');
    expect(container.textContent).toContain('12 AP');
  });

  it('disabled actions have the disabled attribute', () => {
    render(
      <ActionMenu actions={SAMPLE_ACTIONS} onSelectAction={noop} onEndTurn={noop} />,
    );
    const fortifyBtn = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent?.includes('Fortify Border'),
    );
    expect(fortifyBtn).toBeDefined();
    expect(fortifyBtn!.disabled).toBe(true);
  });

  it('shows End Turn button when onEndTurn is provided', () => {
    render(
      <ActionMenu actions={SAMPLE_ACTIONS} onSelectAction={noop} onEndTurn={noop} />,
    );
    const endTurnBtn = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent?.includes('End Turn'),
    );
    expect(endTurnBtn).toBeDefined();
  });

  it('calls onEndTurn when End Turn is clicked', () => {
    const endTurnHandler = vi.fn();
    render(
      <ActionMenu
        actions={SAMPLE_ACTIONS}
        onSelectAction={noop}
        onEndTurn={endTurnHandler}
      />,
    );
    const endTurnBtn = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent?.includes('End Turn'),
    );
    expect(endTurnBtn).toBeDefined();
    act(() => {
      endTurnBtn!.click();
    });
    expect(endTurnHandler).toHaveBeenCalledOnce();
  });

  it('category sections are collapsible', () => {
    render(
      <ActionMenu actions={SAMPLE_ACTIONS} onSelectAction={noop} onEndTurn={noop} />,
    );

    // Before collapsing, "Propose Summit" should be visible
    expect(container.textContent).toContain('Propose Summit');

    // Click the Diplomacy category header to collapse it.
    // The header div uses cursor:pointer and uppercase text.
    const allDivs = container.querySelectorAll('div');
    const diplomacyHeader = Array.from(allDivs).find(
      (el) =>
        el.style.cursor === 'pointer' &&
        el.textContent?.includes('Diplomacy'),
    );
    expect(diplomacyHeader).toBeDefined();
    act(() => {
      diplomacyHeader!.click();
    });

    // After collapsing, the Diplomacy items should no longer be rendered
    // but the Military items should still be there
    const buttons = Array.from(container.querySelectorAll('button'));
    const proposeSummit = buttons.find((b) => b.textContent?.includes('Propose Summit'));
    expect(proposeSummit).toBeUndefined();

    // Military items still visible
    expect(container.textContent).toContain('Deploy Fleet');
  });
});

// ===========================================================================
// IntelPanel
// ===========================================================================

describe('IntelPanel', () => {
  it('renders faction names', () => {
    render(<IntelPanel factions={SAMPLE_FACTIONS} />);
    for (const f of SAMPLE_FACTIONS) {
      expect(container.textContent).toContain(f.name);
    }
  });

  it('shows stability values', () => {
    render(<IntelPanel factions={SAMPLE_FACTIONS} />);
    for (const f of SAMPLE_FACTIONS) {
      expect(container.textContent).toContain(String(f.stability));
    }
  });

  it('shows tension values', () => {
    render(<IntelPanel factions={SAMPLE_FACTIONS} />);
    for (const f of SAMPLE_FACTIONS) {
      expect(container.textContent).toContain(String(f.tension));
    }
  });

  it('color-codes high tension as red', () => {
    render(<IntelPanel factions={SAMPLE_FACTIONS} />);
    // China has tension 80 (> 66) → should be #ef5350 (red)
    const allSpans = container.querySelectorAll('span');
    const chinaHighTension = Array.from(allSpans).find(
      (span) =>
        span.textContent === '80' &&
        (span.style.color === '#ef5350' ||
          span.style.color === 'rgb(239, 83, 80)'),
    );
    expect(chinaHighTension).toBeDefined();
  });

  it('shows clarity as percentage', () => {
    render(<IntelPanel factions={SAMPLE_FACTIONS} />);
    expect(container.textContent).toContain('45%');
    expect(container.textContent).toContain('60%');
    expect(container.textContent).toContain('90%');
  });

  it('renders empty state when no factions', () => {
    render(<IntelPanel factions={[]} />);
    // Should still render the container with the title but no faction cards
    expect(container.textContent).toContain('Intelligence Brief');
    // No faction names
    expect(container.textContent).not.toContain('China');
    expect(container.textContent).not.toContain('Russia');
  });
});

// ===========================================================================
// TopBar
// ===========================================================================

describe('TopBar', () => {
  beforeEach(() => {
    setStoreForTopBar();
  });

  it('renders turn number', () => {
    render(<TopBar />);
    expect(container.textContent).toContain('Turn 5');
  });

  it('renders faction name', () => {
    render(<TopBar />);
    expect(container.textContent).toContain('United States');
  });

  it('renders stat pills (STB, MIL, DIP, POP)', () => {
    render(<TopBar />);
    expect(container.textContent).toContain('STB');
    expect(container.textContent).toContain('MIL');
    expect(container.textContent).toContain('DIP');
    expect(container.textContent).toContain('POP');
  });

  it('shows "No data" when nationState is undefined', () => {
    useGameStore.setState({
      currentTurn: 1 as never,
      playerFaction: 'us',
      nationStates: {} as never,
    });
    render(<TopBar />);
    expect(container.textContent).toContain('No data');
  });
});

// ===========================================================================
// CommandCenter
// ===========================================================================

describe('CommandCenter', () => {
  const noop = () => {};

  beforeEach(() => {
    setStoreForTopBar();
  });

  it('renders all grid areas (topbar, left, center, right, footer)', () => {
    render(
      <CommandCenter
        actionMenuProps={{
          actions: SAMPLE_ACTIONS,
          onSelectAction: noop,
          onEndTurn: noop,
        }}
        rightPanel={<div data-testid="right">Right Panel</div>}
        footer={<div data-testid="footer">Headlines Here</div>}
      />,
    );
    // TopBar content
    expect(container.textContent).toContain('Turn 5');
    // ActionMenu content (left)
    expect(container.textContent).toContain('Propose Summit');
    // MapViewport content (center)
    expect(container.textContent).toContain('United States');
    // Right panel content
    expect(container.textContent).toContain('Right Panel');
    // Footer content
    expect(container.textContent).toContain('Headlines Here');
  });

  it('shows footer slot content when provided', () => {
    render(
      <CommandCenter
        actionMenuProps={{
          actions: SAMPLE_ACTIONS,
          onSelectAction: noop,
          onEndTurn: noop,
        }}
        rightPanel={<span>Right</span>}
        footer={<div>Custom Footer Content</div>}
      />,
    );
    expect(container.textContent).toContain('Custom Footer Content');
  });

  it('shows overlay when provided', () => {
    render(
      <CommandCenter
        actionMenuProps={{
          actions: SAMPLE_ACTIONS,
          onSelectAction: noop,
          onEndTurn: noop,
        }}
        rightPanel={<span>Right</span>}
        overlay={<div>Strategic Dashboard Overlay</div>}
      />,
    );
    expect(container.textContent).toContain('Strategic Dashboard Overlay');
  });

  it('shows placeholder when no footer is provided', () => {
    render(
      <CommandCenter
        actionMenuProps={{
          actions: SAMPLE_ACTIONS,
          onSelectAction: noop,
          onEndTurn: noop,
        }}
        rightPanel={<span>Right</span>}
      />,
    );
    expect(container.textContent).toContain('Headlines ticker will appear here');
  });
});
