/**
 * CNFL-1401 — HeadlinesPanel · Component Tests
 *
 * Covers: perspective tabs, headline display, archive toggle,
 * archive sorting, click callbacks, and accessibility.
 * Uses react-dom/client directly (no @testing-library/react).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

import { HeadlinesPanel } from '@/ui/HeadlinesPanel';
import { HeadlinePerspective } from '@/data/types';

import type { Root } from 'react-dom/client';
import type {
  Headline,
  TurnHeadlines,
  HeadlineArchive,
} from '@/data/types';

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

const mockHeadline = (
  perspective: string,
  text: string,
  subtext?: string,
): Headline => ({
  perspective: perspective as HeadlinePerspective,
  text,
  subtext,
  relatedEventIds: ['evt-1'],
});

const mockTurnHeadlines: TurnHeadlines = {
  turn: 3,
  headlines: {
    [HeadlinePerspective.WesternPress]: mockHeadline(
      HeadlinePerspective.WesternPress,
      'NATO Summit Addresses Pacific Tensions',
      'Leaders discuss unified response',
    ),
    [HeadlinePerspective.StatePropaganda]: mockHeadline(
      HeadlinePerspective.StatePropaganda,
      'Glorious Progress in National Defense Program',
    ),
    [HeadlinePerspective.Intelligence]: mockHeadline(
      HeadlinePerspective.Intelligence,
      'SIGINT: Unusual submarine activity detected in South China Sea',
      'Confidence: Medium',
    ),
  },
};

const mockArchive: HeadlineArchive = [
  {
    turn: 1,
    headlines: {
      [HeadlinePerspective.WesternPress]: mockHeadline(HeadlinePerspective.WesternPress, 'Turn 1 Western Headline'),
      [HeadlinePerspective.StatePropaganda]: mockHeadline(HeadlinePerspective.StatePropaganda, 'Turn 1 State Headline'),
      [HeadlinePerspective.Intelligence]: mockHeadline(HeadlinePerspective.Intelligence, 'Turn 1 Intel Headline'),
    },
  },
  {
    turn: 2,
    headlines: {
      [HeadlinePerspective.WesternPress]: mockHeadline(HeadlinePerspective.WesternPress, 'Turn 2 Western Headline'),
      [HeadlinePerspective.StatePropaganda]: mockHeadline(HeadlinePerspective.StatePropaganda, 'Turn 2 State Headline'),
      [HeadlinePerspective.Intelligence]: mockHeadline(HeadlinePerspective.Intelligence, 'Turn 2 Intel Headline'),
    },
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return all <button> elements in the container. */
function buttons(): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll('button'));
}

/** Find a button whose text content includes the given string. */
function buttonByText(text: string): HTMLButtonElement | undefined {
  return buttons().find((b) => b.textContent?.includes(text));
}

/** Click a DOM element inside an `act` boundary. */
function click(el: HTMLElement): void {
  act(() => {
    el.click();
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HeadlinesPanel', () => {
  // 1
  it('renders without crashing when currentTurnHeadlines is null', () => {
    render(
      createElement(HeadlinesPanel, {
        currentTurnHeadlines: null,
        archive: [],
      }),
    );
    expect(container.innerHTML).not.toBe('');
  });

  // 2
  it('shows "Awaiting dispatches" when currentTurnHeadlines is null', () => {
    render(
      createElement(HeadlinesPanel, {
        currentTurnHeadlines: null,
        archive: [],
      }),
    );
    expect(container.textContent).toContain('Awaiting dispatches');
  });

  // 3
  it('renders three perspective tabs', () => {
    render(
      createElement(HeadlinesPanel, {
        currentTurnHeadlines: mockTurnHeadlines,
        archive: [],
      }),
    );
    const tabLabels = ['Western Press', 'State Propaganda', 'Intelligence'];
    for (const label of tabLabels) {
      expect(buttonByText(label)).toBeDefined();
    }
  });

  // 4
  it('shows Western Press tab content by default', () => {
    render(
      createElement(HeadlinesPanel, {
        currentTurnHeadlines: mockTurnHeadlines,
        archive: [],
      }),
    );
    expect(container.textContent).toContain('NATO Summit Addresses Pacific Tensions');
  });

  // 5
  it('clicking State Propaganda tab shows its headline', () => {
    render(
      createElement(HeadlinesPanel, {
        currentTurnHeadlines: mockTurnHeadlines,
        archive: [],
      }),
    );
    const tab = buttonByText('State Propaganda');
    expect(tab).toBeDefined();
    click(tab!);
    expect(container.textContent).toContain('Glorious Progress in National Defense Program');
  });

  // 6
  it('clicking Intelligence tab shows its headline', () => {
    render(
      createElement(HeadlinesPanel, {
        currentTurnHeadlines: mockTurnHeadlines,
        archive: [],
      }),
    );
    const tab = buttonByText('Intelligence');
    expect(tab).toBeDefined();
    click(tab!);
    expect(container.textContent).toContain(
      'SIGINT: Unusual submarine activity detected in South China Sea',
    );
  });

  // 7
  it('active tab has colored underline', () => {
    render(
      createElement(HeadlinesPanel, {
        currentTurnHeadlines: mockTurnHeadlines,
        archive: [],
      }),
    );
    // Western Press is active by default — its accent color is #4a9eff
    const wpTab = buttonByText('Western Press');
    expect(wpTab).toBeDefined();
    expect(wpTab!.style.borderBottom).toContain('#4a9eff');

    // Non-active tab should have transparent border
    const spTab = buttonByText('State Propaganda');
    expect(spTab).toBeDefined();
    expect(spTab!.style.borderBottom).toContain('transparent');
  });

  // 8
  it('shows headline text for the active perspective', () => {
    render(
      createElement(HeadlinesPanel, {
        currentTurnHeadlines: mockTurnHeadlines,
        archive: [],
      }),
    );
    // Default is Western Press
    expect(container.textContent).toContain('NATO Summit Addresses Pacific Tensions');

    // Switch to Intelligence
    click(buttonByText('Intelligence')!);
    expect(container.textContent).toContain(
      'SIGINT: Unusual submarine activity detected in South China Sea',
    );
  });

  // 9
  it('shows subtext when available', () => {
    render(
      createElement(HeadlinesPanel, {
        currentTurnHeadlines: mockTurnHeadlines,
        archive: [],
      }),
    );
    // Western Press has subtext
    expect(container.textContent).toContain('Leaders discuss unified response');

    // Switch to Intelligence which also has subtext
    click(buttonByText('Intelligence')!);
    expect(container.textContent).toContain('Confidence: Medium');
  });

  // 10
  it('calls onHeadlineClick when headline is clicked', () => {
    const spy = vi.fn();
    render(
      createElement(HeadlinesPanel, {
        currentTurnHeadlines: mockTurnHeadlines,
        archive: [],
        onHeadlineClick: spy,
      }),
    );
    // The headline area has role="button"
    const headlineButton = container.querySelector<HTMLElement>('[role="button"]');
    expect(headlineButton).not.toBeNull();
    click(headlineButton!);
    expect(spy).toHaveBeenCalledOnce();
    expect(spy).toHaveBeenCalledWith(mockTurnHeadlines.headlines[HeadlinePerspective.WesternPress]);
  });

  // 11
  it('Press Review button toggles archive panel', () => {
    render(
      createElement(HeadlinesPanel, {
        currentTurnHeadlines: mockTurnHeadlines,
        archive: mockArchive,
      }),
    );
    const pressReviewBtn = buttonByText('Press Review');
    expect(pressReviewBtn).toBeDefined();

    // Archive not visible initially
    expect(container.textContent).not.toContain('Turn 1');

    // Open archive
    click(pressReviewBtn!);
    expect(container.textContent).toContain('Turn 1');
    expect(container.textContent).toContain('Turn 2');

    // Close archive
    click(pressReviewBtn!);
    expect(container.textContent).not.toContain('Turn 1');
  });

  // 12
  it('archive shows past headlines grouped by turn', () => {
    render(
      createElement(HeadlinesPanel, {
        currentTurnHeadlines: mockTurnHeadlines,
        archive: mockArchive,
      }),
    );
    click(buttonByText('Press Review')!);

    // Both turn groups are present
    expect(container.textContent).toContain('Turn 1');
    expect(container.textContent).toContain('Turn 2');

    // Headlines from each turn are present
    expect(container.textContent).toContain('Turn 1 Western Headline');
    expect(container.textContent).toContain('Turn 2 Western Headline');
    expect(container.textContent).toContain('Turn 1 Intel Headline');
  });

  // 13
  it('archive sorted most recent first', () => {
    render(
      createElement(HeadlinesPanel, {
        currentTurnHeadlines: mockTurnHeadlines,
        archive: mockArchive,
      }),
    );
    click(buttonByText('Press Review')!);

    const html = container.innerHTML;
    const turn2Pos = html.indexOf('Turn 2');
    const turn1Pos = html.indexOf('Turn 1');
    expect(turn2Pos).toBeLessThan(turn1Pos);
  });

  // 14
  it('renders empty archive gracefully', () => {
    render(
      createElement(HeadlinesPanel, {
        currentTurnHeadlines: mockTurnHeadlines,
        archive: [],
      }),
    );
    click(buttonByText('Press Review')!);

    expect(container.textContent).toContain('No archived headlines yet');
  });

  // 15
  it('headline accessibility — clickable headlines have cursor pointer', () => {
    render(
      createElement(HeadlinesPanel, {
        currentTurnHeadlines: mockTurnHeadlines,
        archive: [],
      }),
    );
    const headlineButton = container.querySelector<HTMLElement>('[role="button"]');
    expect(headlineButton).not.toBeNull();
    expect(headlineButton!.style.cursor).toBe('pointer');
    expect(headlineButton!.getAttribute('tabindex')).toBe('0');
  });
});
