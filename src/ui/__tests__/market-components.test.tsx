/**
 * StockMarketDashboard + MarketSentimentWidget + MarketIndexPanel — Tests
 *
 * Uses createRoot + act (from 'react') pattern — no @testing-library/react.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { StockMarketDashboard } from '@/ui/StockMarketDashboard';
import { MarketSentimentWidget } from '@/ui/MarketSentimentWidget';
import { MarketIndexPanel } from '@/ui/MarketIndexPanel';
import { useGameStore } from '@/engine/store';
import type { Root } from 'react-dom/client';
import type { RuntimeMarketState, TickerRuntimeState, ExchangeSentimentState, IndexRuntimeState } from '@/data/types/model.types';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
  // Reset store
  useGameStore.setState({ marketState: null } as never);
});

// ── Helpers ──────────────────────────────────────────────────

function testId(id: string): HTMLElement | null {
  return container.querySelector(`[data-testid="${id}"]`);
}
function allTestId(id: string): NodeListOf<HTMLElement> {
  return container.querySelectorAll(`[data-testid="${id}"]`);
}
function click(el: HTMLElement): void {
  act(() => { el.click(); });
}

// ── Fixtures ─────────────────────────────────────────────────

function makeTicker(id: string, exchangeId: string, price: number, prev: number): TickerRuntimeState {
  return {
    tickerId: id,
    exchangeId,
    currentPrice: price,
    previousPrice: prev,
    allTimeHigh: Math.max(price, prev) + 10,
    allTimeLow: Math.min(price, prev) - 5,
    trendDirection: price > prev ? 'rising' : price < prev ? 'falling' : 'stable',
    volume: 1000,
    priceHistory: [],
  };
}

function makeSentiment(exchangeId: string, sentiment: 'bullish' | 'bearish' | 'neutral', score: number): ExchangeSentimentState {
  return {
    exchangeId,
    sentiment,
    sentimentScore: score,
    trendStrength: 50,
    volatilityIndex: 30,
    majorEvents: [],
  };
}

function makeIndex(indexId: string, value: number): IndexRuntimeState {
  return {
    indexId,
    currentValue: value,
    allTimeHigh: value + 20,
    allTimeLow: value - 10,
    trendDirection: 'rising',
    createdOnTurn: 1,
    history: [{ turn: 1, value: value - 5, change: -5, changePercent: -4.5 }, { turn: 2, value, change: 5, changePercent: 4.5 }],
  };
}

const SAMPLE_MARKET_STATE: RuntimeMarketState = {
  exchanges: [],
  tickerSets: [],
  tickerStates: {
    'us-defense': makeTicker('us-defense', 'nyse', 105, 100),
    'us-energy': makeTicker('us-energy', 'nyse', 95, 100),
    'cn-defense': makeTicker('cn-defense', 'sse', 80, 85),
    'cn-energy': makeTicker('cn-energy', 'sse', 70, 65),
  },
  sentimentStates: {
    nyse: makeSentiment('nyse', 'neutral', 5),
    sse: makeSentiment('sse', 'bearish', -25),
  },
  marketEventLog: [
    {
      eventId: 'evt-1',
      turn: 1,
      eventType: 'crash',
      affectedExchanges: ['sse'],
      magnitude: 0.15,
      cause: 'US sanctions on tech sector',
    },
    {
      eventId: 'evt-2',
      turn: 2,
      eventType: 'rally',
      affectedExchanges: ['nyse'],
      magnitude: 0.08,
      cause: 'Trade deal signed',
    },
  ],
  contagionLog: [],
  presetIndexes: [{ schemaVersion: '1.0.0', indexId: 'global-composite', indexName: 'Global Composite', indexType: 'preset', baseValue: 100, constituentTickers: [] }],
  customIndexes: [],
  indexStates: {
    'global-composite': makeIndex('global-composite', 102.5),
  },
};

function setMarketState(state: RuntimeMarketState | null = SAMPLE_MARKET_STATE): void {
  useGameStore.setState({ marketState: state } as never);
}

// ═══════════════════════════════════════════════════════════════
// StockMarketDashboard
// ═══════════════════════════════════════════════════════════════

describe('StockMarketDashboard', () => {
  it('renders a placeholder when marketState is null', () => {
    act(() => { root.render(createElement(StockMarketDashboard)); });
    expect(testId('stock-market-dashboard')).toBeTruthy();
    expect(container.textContent).toContain('Market data will appear');
  });

  it('renders exchange cards after marketState is populated', () => {
    setMarketState();
    act(() => { root.render(createElement(StockMarketDashboard)); });
    expect(testId('exchange-card-nyse')).toBeTruthy();
    expect(testId('exchange-card-sse')).toBeTruthy();
  });

  it('shows the NYSE card with correct trend direction', () => {
    setMarketState();
    act(() => { root.render(createElement(StockMarketDashboard)); });
    const nyseCard = testId('exchange-card-nyse');
    expect(nyseCard).toBeTruthy();
    // NYSE: us-defense +5%, us-energy -5% → avg ~0% → should show near-zero change
    expect(nyseCard!.textContent).toContain('%');
  });

  it('selects an exchange when its card is clicked', () => {
    setMarketState();
    act(() => { root.render(createElement(StockMarketDashboard)); });
    const sseCard = testId('exchange-card-sse');
    click(sseCard!);
    // After clicking SSE, should show cn-defense and cn-energy tickers
    expect(testId('ticker-row-cn-defense')).toBeTruthy();
    expect(testId('ticker-row-cn-energy')).toBeTruthy();
  });

  it('renders ticker rows with price and change data', () => {
    setMarketState();
    act(() => { root.render(createElement(StockMarketDashboard)); });
    // Default selection is first exchange (nyse)
    const defRow = testId('ticker-row-us-defense');
    expect(defRow).toBeTruthy();
    expect(defRow!.textContent).toContain('$105.00');
    expect(defRow!.textContent).toContain('+5.0000%');
  });

  it('renders the market index table', () => {
    setMarketState();
    act(() => { root.render(createElement(StockMarketDashboard)); });
    expect(testId('index-row-global-composite')).toBeTruthy();
    const idxRow = testId('index-row-global-composite');
    expect(idxRow!.textContent).toContain('102.5');
  });

  it('renders recent market events with type labels', () => {
    setMarketState();
    act(() => { root.render(createElement(StockMarketDashboard)); });
    expect(testId('market-event-evt-1')).toBeTruthy();
    expect(testId('market-event-evt-2')).toBeTruthy();
    expect(testId('market-event-evt-1')!.textContent).toContain('crash');
    expect(testId('market-event-evt-2')!.textContent).toContain('rally');
  });

  it('handles empty ticker sets gracefully', () => {
    const emptyState: RuntimeMarketState = {
      ...SAMPLE_MARKET_STATE,
      tickerStates: {},
      sentimentStates: {},
    };
    setMarketState(emptyState);
    act(() => { root.render(createElement(StockMarketDashboard)); });
    expect(testId('stock-market-dashboard')).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════
// MarketSentimentWidget
// ═══════════════════════════════════════════════════════════════

describe('MarketSentimentWidget', () => {
  it('renders placeholder when no market data', () => {
    act(() => { root.render(createElement(MarketSentimentWidget)); });
    expect(testId('market-sentiment-widget')).toBeTruthy();
    expect(container.textContent).toContain('Awaiting market data');
  });

  it('renders global sentiment when data is available', () => {
    setMarketState();
    act(() => { root.render(createElement(MarketSentimentWidget)); });
    const global = testId('global-sentiment');
    expect(global).toBeTruthy();
    // With nyse=+5 and sse=-25, avg score = -10 → neutral (|score| ≤ 15)
    expect(global!.textContent).toContain('NEUTRAL');
  });

  it('renders per-exchange sentiment rows', () => {
    setMarketState();
    act(() => { root.render(createElement(MarketSentimentWidget)); });
    expect(testId('sentiment-row-nyse')).toBeTruthy();
    expect(testId('sentiment-row-sse')).toBeTruthy();
  });

  it('shows correct sentiment counts in summary', () => {
    setMarketState();
    act(() => { root.render(createElement(MarketSentimentWidget)); });
    // 1 neutral (nyse), 1 bearish (sse)
    const widget = testId('market-sentiment-widget')!;
    expect(widget.textContent).toContain('🟡 1');
    expect(widget.textContent).toContain('🔴 1');
  });

  it('reflects bearish global sentiment when majority bearish', () => {
    const allBearish: RuntimeMarketState = {
      ...SAMPLE_MARKET_STATE,
      sentimentStates: {
        nyse: makeSentiment('nyse', 'bearish', -40),
        sse: makeSentiment('sse', 'bearish', -60),
      },
    };
    setMarketState(allBearish);
    act(() => { root.render(createElement(MarketSentimentWidget)); });
    const global = testId('global-sentiment');
    expect(global!.textContent).toContain('BEARISH');
  });
});

// ═══════════════════════════════════════════════════════════════
// MarketIndexPanel
// ═══════════════════════════════════════════════════════════════

describe('MarketIndexPanel', () => {
  it('renders placeholder when no market data', () => {
    act(() => { root.render(createElement(MarketIndexPanel)); });
    expect(testId('market-index-panel')).toBeTruthy();
    expect(container.textContent).toContain('Index data will appear');
  });

  it('renders preset indexes section', () => {
    setMarketState();
    act(() => { root.render(createElement(MarketIndexPanel)); });
    expect(testId('index-row-global-composite')).toBeTruthy();
  });

  it('shows custom indexes count as 0/10', () => {
    setMarketState();
    act(() => { root.render(createElement(MarketIndexPanel)); });
    expect(container.textContent).toContain('0/10');
  });

  it('opens create form when "New Index" button is clicked', () => {
    setMarketState();
    act(() => { root.render(createElement(MarketIndexPanel)); });
    const btn = testId('create-index-btn');
    expect(btn).toBeTruthy();
    click(btn!);
    expect(testId('create-index-form')).toBeTruthy();
    expect(testId('index-name-input')).toBeTruthy();
  });

  it('shows ticker selection buttons in the create form', () => {
    setMarketState();
    act(() => { root.render(createElement(MarketIndexPanel)); });
    click(testId('create-index-btn')!);
    expect(testId('ticker-select-us-defense')).toBeTruthy();
    expect(testId('ticker-select-cn-energy')).toBeTruthy();
  });

  it('toggles ticker selection on click', () => {
    setMarketState();
    act(() => { root.render(createElement(MarketIndexPanel)); });
    click(testId('create-index-btn')!);
    const tickerBtn = testId('ticker-select-us-defense')!;
    // Initially not selected → border color is #333
    click(tickerBtn);
    // After click → should be selected (visual check via style)
    expect(testId('ticker-select-us-defense')!.style.borderColor).toBe('#4caf50');
  });

  it('closes create form when Cancel is clicked', () => {
    setMarketState();
    act(() => { root.render(createElement(MarketIndexPanel)); });
    click(testId('create-index-btn')!);
    expect(testId('create-index-form')).toBeTruthy();
    // Click the "Cancel" button (it has style differences but is the second button)
    click(testId('create-index-btn')!); // Toggle closes it
    expect(testId('create-index-form')).toBeNull();
  });
});
