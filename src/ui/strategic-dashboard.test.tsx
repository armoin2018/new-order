/**
 * CNFL-1402 — StrategicDashboard · Component Tests
 *
 * Covers: rendering, victory path gauges, loss condition monitor,
 * recommended actions, rival leaderboard, and collapsibility.
 * Uses react-dom/client directly (no @testing-library/react).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

import { StrategicDashboard } from '@/ui/StrategicDashboard';

import type { Root } from 'react-dom/client';
import type { VictoryPathViability } from '@/data/types';
import type {
  LossConditionDisplayData,
  RecommendedActionDisplayData,
  RivalLeaderboardEntry,
  StrategicDashboardProps,
} from '@/ui/StrategicDashboard';

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

const mockPaths: VictoryPathViability[] = [
  { victoryConditionId: 'economic_dominance', viabilityScore: 72, label: 'favorable', trend: 'rising', turnsToVictoryEstimate: 18, confidence: 'high' },
  { victoryConditionId: 'military_hegemony', viabilityScore: 35, label: 'viable', trend: 'stable', turnsToVictoryEstimate: 30, confidence: 'medium' },
  { victoryConditionId: 'diplomatic_victory', viabilityScore: 8, label: 'foreclosed', trend: 'falling_fast', turnsToVictoryEstimate: null, confidence: 'low' },
];

const mockLoss: LossConditionDisplayData[] = [
  { lossConditionId: 'nuclear_winter', label: 'Nuclear Winter', threatLevel: 25, urgency: 'watch', turnsUntilTrigger: 15 },
  { lossConditionId: 'regime_collapse', label: 'Regime Collapse', threatLevel: 65, urgency: 'warning', turnsUntilTrigger: 6 },
];

const mockActions: RecommendedActionDisplayData[] = [
  { actionId: 'trade-deal-eu', label: 'Trade Deal with EU', description: 'Strengthen economic ties', viabilityImpact: 5, cost: '$3B', risk: 'low', targetPath: 'economic_dominance' },
  { actionId: 'mil-readiness', label: 'Increase Readiness', description: 'Boost military posture', viabilityImpact: 3, cost: '$5B', risk: 'medium', targetPath: 'military_hegemony' },
];

const mockRivals: RivalLeaderboardEntry[] = [
  { factionId: 'china', factionName: 'China', closestVictory: 'Economic Supremacy', turnsEstimate: 14, confidence: 'high' },
  { factionId: 'russia', factionName: 'Russia', closestVictory: 'Regional Hegemony', turnsEstimate: null, confidence: 'low' },
  { factionId: 'eu', factionName: 'EU', closestVictory: 'Diplomatic Victory', turnsEstimate: 22, confidence: 'medium' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultProps(overrides?: Partial<StrategicDashboardProps>): StrategicDashboardProps {
  return {
    victoryPaths: mockPaths,
    lossConditions: mockLoss,
    recommendedActions: mockActions,
    rivals: mockRivals,
    strategyScore: 78,
    onSimulateAction: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
}

/** Return all <button> elements in the container. */
function buttons(): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll('button'));
}

/** Find a button whose text content includes the given string. */
function buttonByText(text: string): HTMLButtonElement | undefined {
  return buttons().find((b) => b.textContent?.includes(text));
}

/** Find a button by its aria-label. */
function buttonByLabel(label: string): HTMLButtonElement | undefined {
  return buttons().find((b) => b.getAttribute('aria-label') === label);
}

/** Click a DOM element inside an `act` boundary. */
function click(el: HTMLElement): void {
  act(() => {
    el.click();
  });
}

/** Find a section header (div with cursor:pointer that contains given text). */
function sectionHeader(text: string): HTMLElement | undefined {
  const spans = Array.from(container.querySelectorAll('span'));
  const span = spans.find((s) => s.textContent?.includes(text));
  // The clickable header is the parent div of the span
  return span?.closest('div[style]') as HTMLElement | undefined;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StrategicDashboard', () => {
  // ═══════════════════════════════════════════════════════════════════════
  // 1. Rendering & Structure
  // ═══════════════════════════════════════════════════════════════════════

  describe('Rendering & Structure', () => {
    // 1
    it('renders without crashing with minimal props', () => {
      render(
        createElement(StrategicDashboard, {
          victoryPaths: [],
          lossConditions: [],
          recommendedActions: [],
          rivals: [],
          strategyScore: null,
          onClose: vi.fn(),
        }),
      );
      expect(container.innerHTML).not.toBe('');
      expect(container.textContent).toContain('Strategic Dashboard');
    });

    // 2
    it('shows strategy score when provided (e.g. "78/100")', () => {
      render(createElement(StrategicDashboard, defaultProps()));
      expect(container.textContent).toContain('78/100');
    });

    // 3
    it('shows dash when strategyScore is null', () => {
      render(
        createElement(StrategicDashboard, defaultProps({ strategyScore: null })),
      );
      expect(container.textContent).toContain('Strategic Rating: —');
      expect(container.textContent).not.toContain('Strategic Rating: 78');
    });

    // 4
    it('close button calls onClose', () => {
      const onClose = vi.fn();
      render(
        createElement(StrategicDashboard, defaultProps({ onClose })),
      );

      const closeBtn = buttonByLabel('Close dashboard');
      expect(closeBtn).toBeDefined();
      click(closeBtn!);
      expect(onClose).toHaveBeenCalledOnce();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 2. Victory Path Gauges
  // ═══════════════════════════════════════════════════════════════════════

  describe('Victory Path Gauges', () => {
    // 5
    it('renders all victory paths', () => {
      render(createElement(StrategicDashboard, defaultProps()));
      // Each victory path shows its formatted condition ID
      expect(container.textContent).toContain('Economic Dominance');
      expect(container.textContent).toContain('Military Hegemony');
      expect(container.textContent).toContain('Diplomatic Victory');
    });

    // 6
    it('shows viabilityScore as bar width', () => {
      render(createElement(StrategicDashboard, defaultProps()));
      // The gauge fill divs have width set as percentage of viabilityScore
      const gaugeFills = Array.from(container.querySelectorAll('div')).filter(
        (div) => {
          const style = div.getAttribute('style') ?? '';
          return style.includes('width:') && style.includes('border-radius: 7px');
        },
      );
      // At least the 3 victory path gauges should be present
      const widths = gaugeFills.map((div) => {
        const match = (div.getAttribute('style') ?? '').match(/width:\s*(\d+)%/);
        return match ? Number(match[1]) : null;
      });
      expect(widths).toContain(72);
      expect(widths).toContain(35);
      expect(widths).toContain(8);
    });

    // 7
    it('shows trend arrows (↗ for rising, ↓ for falling_fast, → for stable)', () => {
      render(createElement(StrategicDashboard, defaultProps()));
      const text = container.textContent ?? '';
      expect(text).toContain('↗'); // rising
      expect(text).toContain('→'); // stable
      expect(text).toContain('↓'); // falling_fast
    });

    // 8
    it('shows formatted victory condition ID as label', () => {
      render(createElement(StrategicDashboard, defaultProps()));
      // formatConditionId converts snake_case to Title Case
      expect(container.textContent).toContain('Economic Dominance');
      expect(container.textContent).toContain('Military Hegemony');
      expect(container.textContent).toContain('Diplomatic Victory');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 3. Loss Condition Monitor
  // ═══════════════════════════════════════════════════════════════════════

  describe('Loss Condition Monitor', () => {
    // 9
    it('renders all loss conditions', () => {
      render(createElement(StrategicDashboard, defaultProps()));
      expect(container.textContent).toContain('Nuclear Winter');
      expect(container.textContent).toContain('Regime Collapse');
    });

    // 10
    it('shows urgency labels', () => {
      render(createElement(StrategicDashboard, defaultProps()));
      expect(container.textContent).toContain('watch');
      expect(container.textContent).toContain('warning');
    });

    // 11
    it('shows turnsUntilTrigger', () => {
      render(createElement(StrategicDashboard, defaultProps()));
      expect(container.textContent).toContain('15 turns');
      expect(container.textContent).toContain('6 turns');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 4. Recommended Actions
  // ═══════════════════════════════════════════════════════════════════════

  describe('Recommended Actions', () => {
    // 12
    it('renders action cards', () => {
      render(createElement(StrategicDashboard, defaultProps()));
      expect(container.textContent).toContain('Trade Deal with EU');
      expect(container.textContent).toContain('Increase Readiness');
    });

    // 13
    it('shows cost and risk badges when action is expanded', () => {
      render(createElement(StrategicDashboard, defaultProps()));

      // Click the first action to expand it
      const actionLabel = Array.from(container.querySelectorAll('span')).find(
        (s) => s.textContent === 'Trade Deal with EU',
      );
      expect(actionLabel).toBeDefined();
      click(actionLabel!.closest('div')!);

      expect(container.textContent).toContain('$3B');
      expect(container.textContent).toContain('Risk: low');
    });

    // 14
    it('clicking "Simulate" calls onSimulateAction with correct actionId', () => {
      const onSimulateAction = vi.fn();
      render(
        createElement(StrategicDashboard, defaultProps({ onSimulateAction })),
      );

      // Expand the first action card
      const actionLabel = Array.from(container.querySelectorAll('span')).find(
        (s) => s.textContent === 'Trade Deal with EU',
      );
      click(actionLabel!.closest('div')!);

      // Find and click the Simulate button
      const simBtn = buttonByText('Simulate');
      expect(simBtn).toBeDefined();
      click(simBtn!);

      expect(onSimulateAction).toHaveBeenCalledOnce();
      expect(onSimulateAction).toHaveBeenCalledWith('trade-deal-eu');
    });

    // 15
    it('shows viability impact with sign (+ or -)', () => {
      render(createElement(StrategicDashboard, defaultProps()));

      // Expand both actions
      const labels = Array.from(container.querySelectorAll('span')).filter(
        (s) =>
          s.textContent === 'Trade Deal with EU' ||
          s.textContent === 'Increase Readiness',
      );
      for (const label of labels) {
        click(label.closest('div')!);
      }

      // viabilityImpact of 5 → "+5 viability", viabilityImpact of 3 → "+3 viability"
      expect(container.textContent).toContain('+5 viability');
      expect(container.textContent).toContain('+3 viability');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 5. Rival Leaderboard
  // ═══════════════════════════════════════════════════════════════════════

  describe('Rival Leaderboard', () => {
    // 16
    it('renders all rivals', () => {
      render(createElement(StrategicDashboard, defaultProps()));
      expect(container.textContent).toContain('China');
      expect(container.textContent).toContain('Russia');
      expect(container.textContent).toContain('EU');
    });

    // 17
    it('rivals sorted by turnsEstimate (nulls last)', () => {
      render(createElement(StrategicDashboard, defaultProps()));

      // Extract table rows — the first row is the header, skip it
      const rows = Array.from(container.querySelectorAll('tr'));
      const dataRows = rows.slice(1); // skip thead row

      expect(dataRows).toHaveLength(3);

      // Order should be: China (14), EU (22), Russia (null)
      const factionCells = dataRows.map(
        (row) => row.querySelector('td')?.textContent ?? '',
      );
      expect(factionCells[0]).toBe('China');
      expect(factionCells[1]).toBe('EU');
      expect(factionCells[2]).toBe('Russia');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // 6. Collapsibility
  // ═══════════════════════════════════════════════════════════════════════

  describe('Collapsibility', () => {
    // 18
    it('sections are collapsible (clicking header hides content)', () => {
      render(createElement(StrategicDashboard, defaultProps()));

      // Confirm victory paths section is visible
      expect(container.textContent).toContain('Economic Dominance');

      // Find and click the "Victory Path Gauges" section header
      const header = sectionHeader('Victory Path Gauges');
      expect(header).toBeDefined();
      click(header!);

      // After collapsing, the victory path details should be hidden
      expect(container.textContent).not.toContain('Economic Dominance');

      // The section header itself should still be visible
      expect(container.textContent).toContain('Victory Path Gauges');

      // Click again to re-expand
      click(header!);
      expect(container.textContent).toContain('Economic Dominance');
    });
  });
});
