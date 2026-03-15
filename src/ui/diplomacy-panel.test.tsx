/**
 * CNFL-1403 — DiplomacyPanel · Component Tests
 *
 * Covers: Nation selector, relationship detail, active pacts, diplomatic actions
 * Uses react-dom/client directly (no @testing-library/react).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

import { DiplomacyPanel } from '@/ui/DiplomacyPanel';

import type { Root } from 'react-dom/client';
import type {
  DiplomacyNationData,
  DiplomacyPact,
} from '@/ui/DiplomacyPanel';

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

const mockNations: DiplomacyNationData[] = [
  { factionId: 'china', name: 'China', leaderName: 'Xi Jinping', tensionLevel: 55, chemistry: -15, trustScore: 25, grudgeCount: 3, relationshipLabel: 'Hostile' },
  { factionId: 'eu', name: 'European Union', leaderName: 'EU Council', tensionLevel: -20, chemistry: 30, trustScore: 72, grudgeCount: 0, relationshipLabel: 'Friendly' },
  { factionId: 'japan', name: 'Japan', leaderName: 'Takaichi', tensionLevel: -40, chemistry: 25, trustScore: 85, grudgeCount: 0, relationshipLabel: 'Allied' },
];

const mockPacts: DiplomacyPact[] = [
  { id: 'pact-1', type: 'trade_deal', partnerFaction: 'eu', turnsRemaining: 8, credibilityRequired: 40 },
  { id: 'pact-2', type: 'defense_pact', partnerFaction: 'japan', turnsRemaining: null, credibilityRequired: 60 },
];

function renderPanel(overrides: Partial<React.ComponentProps<typeof DiplomacyPanel>> = {}): void {
  render(
    createElement(DiplomacyPanel, {
      playerFaction: 'us',
      nations: mockNations,
      activePacts: mockPacts,
      ...overrides,
    }),
  );
}

/** Click the nation button by its displayed name. */
function clickNation(name: string): void {
  const buttons = Array.from(container.querySelectorAll('button'));
  const btn = buttons.find((b) => b.textContent === name);
  expect(btn).toBeTruthy();
  act(() => {
    btn!.click();
  });
}

/** Click a button whose text content includes the given substring. */
function clickButtonMatching(substring: string): void {
  const buttons = Array.from(container.querySelectorAll('button'));
  const btn = buttons.find((b) => b.textContent?.includes(substring));
  expect(btn).toBeTruthy();
  act(() => {
    btn!.click();
  });
}

// ---------------------------------------------------------------------------
// Nation Selector
// ---------------------------------------------------------------------------

describe('DiplomacyPanel — Nation Selector', () => {
  it('renders all nation names', () => {
    renderPanel();
    const buttons = Array.from(container.querySelectorAll('button'));
    const nationNames = buttons.map((b) => b.textContent);
    for (const nation of mockNations) {
      expect(nationNames).toContain(nation.name);
    }
  });

  it('"Select a nation" prompt shown initially', () => {
    renderPanel();
    expect(container.textContent).toContain('Select a nation');
  });

  it('clicking a nation shows its relationship detail', () => {
    renderPanel();
    clickNation('China');
    expect(container.textContent).toContain('Relationship — China');
    expect(container.textContent).toContain('Xi Jinping');
  });

  it('selected nation is visually highlighted', () => {
    renderPanel();
    clickNation('China');
    const buttons = Array.from(container.querySelectorAll('button'));
    const chinaBtn = buttons.find((b) => b.textContent === 'China');
    expect(chinaBtn).toBeTruthy();
    // Selected button gets border: '1px solid #555' and background: '#1a1a1a'
    expect(chinaBtn!.style.border).toContain('solid');
    expect(chinaBtn!.style.border).toContain('555');
  });
});

// ---------------------------------------------------------------------------
// Relationship Detail
// ---------------------------------------------------------------------------

describe('DiplomacyPanel — Relationship Detail', () => {
  it('shows tension level for selected nation', () => {
    renderPanel();
    clickNation('China');
    // Tension level 55 → displayed as "+55"
    expect(container.textContent).toContain('+55');
    expect(container.textContent).toContain('Tension');
  });

  it('shows chemistry score with +/- indicator', () => {
    renderPanel();
    // China has chemistry -15
    clickNation('China');
    expect(container.textContent).toContain('-15');
    expect(container.textContent).toContain('Chemistry');

    // EU has chemistry +30
    clickNation('European Union');
    expect(container.textContent).toContain('+30');
  });

  it('shows trust score', () => {
    renderPanel();
    clickNation('China');
    expect(container.textContent).toContain('Trust');
    expect(container.textContent).toContain('25%');
  });

  it('shows grudge count when > 0', () => {
    renderPanel();
    // China has grudgeCount 3
    clickNation('China');
    expect(container.textContent).toContain('Grudges');
    expect(container.textContent).toContain('3');

    // EU has grudgeCount 0 → "Grudges" row should not appear
    clickNation('European Union');
    expect(container.textContent).not.toContain('Grudges');
  });
});

// ---------------------------------------------------------------------------
// Active Pacts
// ---------------------------------------------------------------------------

describe('DiplomacyPanel — Active Pacts', () => {
  it('shows active pacts for selected nation', () => {
    renderPanel();
    clickNation('European Union');
    // EU has pact-1: trade_deal with label "Trade Deal", 8 turns remaining
    expect(container.textContent).toContain('Trade Deal');
    expect(container.textContent).toContain('8t');
  });

  it('shows "No active pacts" when none exist for selection', () => {
    renderPanel();
    // China has no pacts in our fixtures
    clickNation('China');
    expect(container.textContent).toContain('No active pacts');
  });
});

// ---------------------------------------------------------------------------
// Diplomatic Actions
// ---------------------------------------------------------------------------

describe('DiplomacyPanel — Diplomatic Actions', () => {
  it('agreement dropdown shows options when opened', () => {
    renderPanel();
    clickNation('China');
    clickButtonMatching('Propose Agreement');
    expect(container.textContent).toContain('Non-Aggression Pact');
    expect(container.textContent).toContain('Trade Deal');
    expect(container.textContent).toContain('Defense Pact');
    expect(container.textContent).toContain('Intelligence Sharing');
  });

  it('calling onProposeAgreement fires with faction and type', () => {
    const spy = vi.fn();
    renderPanel({ onProposeAgreement: spy });
    clickNation('China');
    clickButtonMatching('Propose Agreement');
    clickButtonMatching('Trade Deal');
    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith('china', 'trade_deal');
  });

  it('diplomatic action dropdown shows options', () => {
    renderPanel();
    clickNation('Japan');
    clickButtonMatching('Diplomatic Action');
    expect(container.textContent).toContain('Improve Relations');
    expect(container.textContent).toContain('Issue Warning');
    expect(container.textContent).toContain('Demand Concessions');
    expect(container.textContent).toContain('Red Telephone');
  });

  it('calling onDiplomaticAction fires with faction and type', () => {
    const spy = vi.fn();
    renderPanel({ onDiplomaticAction: spy });
    clickNation('Japan');
    clickButtonMatching('Diplomatic Action');
    clickButtonMatching('Issue Warning');
    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith('japan', 'issue_warning');
  });
});
