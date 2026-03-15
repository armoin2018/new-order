import { describe, it, expect } from 'vitest';
import {
  initializeCurrencyState,
  applyEventToRate,
  applyCurrencyManipulation,
  processEndOfTurnCurrency,
  getCurrencyTopMovers,
  getCrossRateMatrix,
} from '@/engine/currency-engine';
import { GAME_CONFIG } from '@/engine/config';
import { ALL_FACTIONS, FactionId } from '@/data/types';
import type {
  CurrencyRecord,
  CurrencyState,
  CurrencyEvent,
  CurrencyManipulationAction,
} from '@/data/types/currency.types';

// ---------------------------------------------------------------------------
// Deterministic RNG stub — returns a pre-set sequence of values
// ---------------------------------------------------------------------------

function stubRng(values: number[] = [0.5]) {
  let idx = 0;
  return {
    next(): number {
      const v = values[idx % values.length];
      idx++;
      return v;
    },
  };
}

/** Shortcut: build a record for a specific nation from a fresh state. */
function makeRecord(nationId: FactionId): CurrencyRecord {
  const state = initializeCurrencyState([nationId]);
  return state.records[nationId];
}

// ===========================================================================
// initializeCurrencyState
// ===========================================================================

describe('initializeCurrencyState', () => {
  const state = initializeCurrencyState(ALL_FACTIONS as unknown as FactionId[]);

  it('initializes all 8 nations', () => {
    const keys = Object.keys(state.records);
    expect(keys).toHaveLength(8);
  });

  it('creates an empty history array for every nation', () => {
    for (const id of Object.keys(state.records)) {
      expect(state.history[id as FactionId]).toEqual([]);
    }
  });

  it('US Dollar starts at rate 1.0', () => {
    const r = state.records[FactionId.US];
    expect(r.currencyCode).toBe('USD');
    expect(r.currencyName).toBe('US Dollar');
    expect(r.exchangeRateVsUSD).toBe(1.0);
  });

  it('Chinese Yuan starts at 7.25', () => {
    const r = state.records[FactionId.China];
    expect(r.currencyCode).toBe('CNY');
    expect(r.exchangeRateVsUSD).toBe(7.25);
  });

  it('Russian Ruble starts at 92.5', () => {
    const r = state.records[FactionId.Russia];
    expect(r.currencyCode).toBe('RUB');
    expect(r.exchangeRateVsUSD).toBe(92.5);
  });

  it('Euro starts at 0.92', () => {
    const r = state.records[FactionId.EU];
    expect(r.currencyCode).toBe('EUR');
    expect(r.exchangeRateVsUSD).toBe(0.92);
  });

  it('Japanese Yen starts at 151.2', () => {
    const r = state.records[FactionId.Japan];
    expect(r.currencyCode).toBe('JPY');
    expect(r.exchangeRateVsUSD).toBe(151.2);
  });

  it('Iranian Rial starts at 580000', () => {
    const r = state.records[FactionId.Iran];
    expect(r.currencyCode).toBe('IRR');
    expect(r.exchangeRateVsUSD).toBe(580000);
  });

  it('North Korean Won starts at 8500', () => {
    const r = state.records[FactionId.DPRK];
    expect(r.currencyCode).toBe('KPW');
    expect(r.exchangeRateVsUSD).toBe(8500);
  });

  it('Syrian Pound starts at 13000', () => {
    const r = state.records[FactionId.Syria];
    expect(r.currencyCode).toBe('SYP');
    expect(r.exchangeRateVsUSD).toBe(13000);
  });

  it('all records have zero percent change on init', () => {
    for (const rec of Object.values(state.records)) {
      expect(rec.percentChange).toBe(0);
      expect(rec.reserveChangeAmount).toBe(0);
      expect(rec.rateDriverEvents).toEqual([]);
    }
  });

  it('previousRate equals the initial rate', () => {
    for (const rec of Object.values(state.records)) {
      expect(rec.previousRate).toBe(rec.exchangeRateVsUSD);
    }
  });

  it('skips unknown factionIds gracefully', () => {
    const s = initializeCurrencyState(['nonexistent' as FactionId]);
    expect(Object.keys(s.records)).toHaveLength(0);
  });

  it('handles empty nationIds array', () => {
    const s = initializeCurrencyState([]);
    expect(Object.keys(s.records)).toHaveLength(0);
    expect(Object.keys(s.history)).toHaveLength(0);
  });
});

// ===========================================================================
// applyEventToRate
// ===========================================================================

describe('applyEventToRate', () => {
  it('sanctions decrease the exchange rate', () => {
    const rec = makeRecord(FactionId.Iran);
    const event: CurrencyEvent = {
      eventId: 'e1',
      eventType: 'sanctions',
      affectedNation: FactionId.Iran,
      rateImpactPercent: -10,
      description: 'New sanctions on Iran',
    };
    const result = applyEventToRate(rec, event, stubRng([0.5]));
    // Sanctions range: min -15, max -5 → lerp(0.5) = -10
    expect(result.exchangeRateVsUSD).toBeLessThan(rec.exchangeRateVsUSD);
    expect(result.rateDriverEvents).toContain('New sanctions on Iran');
  });

  it('trade deal increases the exchange rate', () => {
    const rec = makeRecord(FactionId.Japan);
    const event: CurrencyEvent = {
      eventId: 'e2',
      eventType: 'trade_deal',
      affectedNation: FactionId.Japan,
      rateImpactPercent: 5,
      description: 'Japan trade deal',
    };
    const result = applyEventToRate(rec, event, stubRng([0.5]));
    // trade_deal range: min 3, max 8 → lerp(0.5) = 5.5
    expect(result.exchangeRateVsUSD).toBeGreaterThan(rec.exchangeRateVsUSD);
  });

  it('market shock decreases the rate', () => {
    const rec = makeRecord(FactionId.Russia);
    const event: CurrencyEvent = {
      eventId: 'e3',
      eventType: 'market_shock',
      affectedNation: FactionId.Russia,
      rateImpactPercent: -15,
      description: 'Market shock',
    };
    const result = applyEventToRate(rec, event, stubRng([0.5]));
    // market_shock range: min -20, max -5 → lerp(0.5) = -12.5
    expect(result.exchangeRateVsUSD).toBeLessThan(rec.exchangeRateVsUSD);
  });

  it('inflation decreases the rate', () => {
    const rec = makeRecord(FactionId.China);
    const event: CurrencyEvent = {
      eventId: 'e4',
      eventType: 'inflation',
      affectedNation: FactionId.China,
      rateImpactPercent: -5,
      description: 'Inflation event',
    };
    const result = applyEventToRate(rec, event, stubRng([0.5]));
    // inflation range: min -10, max -2 → lerp(0.5) = -6
    expect(result.exchangeRateVsUSD).toBeLessThan(rec.exchangeRateVsUSD);
  });

  it('military_conflict hurts non-safe-haven nations', () => {
    const rec = makeRecord(FactionId.Iran);
    const event: CurrencyEvent = {
      eventId: 'e5',
      eventType: 'military_conflict',
      affectedNation: FactionId.Iran,
      rateImpactPercent: -10,
      description: 'Military conflict',
    };
    // Iran is NOT a safe haven — military_conflict_zone range applies
    const result = applyEventToRate(rec, event, stubRng([0.5]));
    expect(result.exchangeRateVsUSD).toBeLessThan(rec.exchangeRateVsUSD);
  });

  it('military_conflict benefits safe-haven nations', () => {
    const rec = makeRecord(FactionId.Japan);
    const event: CurrencyEvent = {
      eventId: 'e6',
      eventType: 'military_conflict',
      affectedNation: FactionId.Japan,
      rateImpactPercent: -10,
      description: 'Global military conflict',
    };
    // Japan IS a safe haven — military_safe_haven range applies (positive)
    const result = applyEventToRate(rec, event, stubRng([0.5]));
    expect(result.exchangeRateVsUSD).toBeGreaterThan(rec.exchangeRateVsUSD);
  });

  it('manipulation events pass through rateImpactPercent directly', () => {
    // Use Iran (120B reserves, below 500B threshold) so no buffer applies
    const rec = makeRecord(FactionId.Iran);
    const event: CurrencyEvent = {
      eventId: 'e7',
      eventType: 'manipulation',
      affectedNation: FactionId.Iran,
      rateImpactPercent: -25,
      description: 'Currency manipulation',
    };
    const result = applyEventToRate(rec, event, stubRng());
    // manipulation uses the event's own rateImpactPercent (no config range roll)
    const expected = rec.exchangeRateVsUSD * (1 + -25 / 100);
    expect(result.exchangeRateVsUSD).toBeCloseTo(expected, 2);
  });

  it('rate never goes below 0.0001', () => {
    const rec: CurrencyRecord = {
      ...makeRecord(FactionId.DPRK),
      exchangeRateVsUSD: 0.001,
    };
    const event: CurrencyEvent = {
      eventId: 'e8',
      eventType: 'manipulation',
      affectedNation: FactionId.DPRK,
      rateImpactPercent: -99.99,
      description: 'Catastrophic collapse',
    };
    const result = applyEventToRate(rec, event, stubRng());
    expect(result.exchangeRateVsUSD).toBeGreaterThanOrEqual(0.0001);
  });

  it('appends event description to rateDriverEvents', () => {
    const rec = makeRecord(FactionId.US);
    const event: CurrencyEvent = {
      eventId: 'e9',
      eventType: 'trade_deal',
      affectedNation: FactionId.US,
      rateImpactPercent: 3,
      description: 'NAFTA expansion',
    };
    const result = applyEventToRate(rec, event, stubRng());
    expect(result.rateDriverEvents).toContain('NAFTA expansion');
  });
});

// ===========================================================================
// applyCurrencyManipulation
// ===========================================================================

describe('applyCurrencyManipulation', () => {
  it('devaluation lowers the rate', () => {
    const rec = makeRecord(FactionId.China);
    const result = applyCurrencyManipulation(rec, 'devaluation', stubRng([0.5]));
    // devaluation range: min -20, max -10 → lerp(0.5) = -15
    expect(result.rateChangePercent).toBeLessThan(0);
    expect(result.newRate).toBeLessThan(rec.exchangeRateVsUSD);
    expect(result.manipulationType).toBe('devaluation');
  });

  it('reserve_weaponization lowers the rate', () => {
    const rec = makeRecord(FactionId.Russia);
    const result = applyCurrencyManipulation(rec, 'reserve_weaponization', stubRng([0.5]));
    // reserve_weaponization range: min -10, max -5 → lerp(0.5) = -7.5
    expect(result.rateChangePercent).toBeLessThan(0);
    expect(result.newRate).toBeLessThan(rec.exchangeRateVsUSD);
  });

  it('currency_attack has a large negative impact', () => {
    const rec = makeRecord(FactionId.Iran);
    const result = applyCurrencyManipulation(rec, 'currency_attack', stubRng([0.5]));
    // currency_attack range: min -30, max -15 → lerp(0.5) = -22.5
    expect(result.rateChangePercent).toBeLessThan(-15);
    expect(result.newRate).toBeLessThan(rec.exchangeRateVsUSD);
  });

  it('swift_disconnection has the most severe impact', () => {
    const rec = makeRecord(FactionId.Russia);
    const result = applyCurrencyManipulation(rec, 'swift_disconnection', stubRng([0.5]));
    // swift_disconnection range: min -50, max -30 → lerp(0.5) = -40
    expect(result.rateChangePercent).toBeLessThanOrEqual(-30);
    expect(result.newRate).toBeLessThan(rec.exchangeRateVsUSD);
    expect(result.description).toContain('SWIFT');
  });

  it('returns the correct targetNation', () => {
    const rec = makeRecord(FactionId.China);
    const result = applyCurrencyManipulation(rec, 'devaluation', stubRng());
    expect(result.targetNation).toBe(FactionId.China);
  });

  it('reports a non-zero reserveImpact', () => {
    const rec = makeRecord(FactionId.Japan);
    const result = applyCurrencyManipulation(rec, 'currency_attack', stubRng([0.5]));
    expect(result.reserveImpact).toBeLessThan(0);
  });

  it('newRate never goes below 0.0001', () => {
    const rec: CurrencyRecord = {
      ...makeRecord(FactionId.DPRK),
      exchangeRateVsUSD: 0.001,
    };
    const result = applyCurrencyManipulation(rec, 'swift_disconnection', stubRng([0.0]));
    // min impact is -50, so 0.001 * 0.50 = 0.0005 which is still > 0.0001
    expect(result.newRate).toBeGreaterThanOrEqual(0.0001);
  });

  it('description contains the currency code', () => {
    const rec = makeRecord(FactionId.EU);
    const result = applyCurrencyManipulation(rec, 'devaluation', stubRng());
    expect(result.description).toContain('EUR');
  });
});

// ===========================================================================
// processEndOfTurnCurrency
// ===========================================================================

describe('processEndOfTurnCurrency', () => {
  it('appends previous records to history', () => {
    const state = initializeCurrencyState([FactionId.US, FactionId.China]);
    const events: CurrencyEvent[] = [];
    const result = processEndOfTurnCurrency(state, events, stubRng());

    // History should now have one entry per nation (the initial snapshot)
    expect(result.history[FactionId.US]).toHaveLength(1);
    expect(result.history[FactionId.China]).toHaveLength(1);
  });

  it('processes events on the affected nation', () => {
    const state = initializeCurrencyState([FactionId.Iran]);
    const events: CurrencyEvent[] = [
      {
        eventId: 't1',
        eventType: 'sanctions',
        affectedNation: FactionId.Iran,
        rateImpactPercent: -10,
        description: 'Sanctions on Iran',
      },
    ];
    const result = processEndOfTurnCurrency(state, events, stubRng([0.5]));
    expect(result.records[FactionId.Iran].exchangeRateVsUSD).not.toBe(
      state.records[FactionId.Iran].exchangeRateVsUSD,
    );
  });

  it('multiple events accumulate on the same nation', () => {
    const state = initializeCurrencyState([FactionId.Russia]);
    const initialRate = state.records[FactionId.Russia].exchangeRateVsUSD;
    const events: CurrencyEvent[] = [
      {
        eventId: 't2a',
        eventType: 'sanctions',
        affectedNation: FactionId.Russia,
        rateImpactPercent: -10,
        description: 'First sanctions',
      },
      {
        eventId: 't2b',
        eventType: 'market_shock',
        affectedNation: FactionId.Russia,
        rateImpactPercent: -15,
        description: 'Market shock',
      },
    ];
    const result = processEndOfTurnCurrency(state, events, stubRng([0.5]));
    // Both negative events → rate should drop significantly
    expect(result.records[FactionId.Russia].exchangeRateVsUSD).toBeLessThan(initialRate);
  });

  it('applies trade surplus reserve regeneration', () => {
    const state = initializeCurrencyState([FactionId.US]);
    const initialReserves = state.records[FactionId.US].foreignReserves;
    const result = processEndOfTurnCurrency(state, [], stubRng());
    // Reserve regen = reserves * tradeSuplusRegenRate = 250 * 0.02 = 5
    expect(result.records[FactionId.US].foreignReserves).toBeGreaterThan(initialReserves);
  });

  it('does not mutate the input state', () => {
    const state = initializeCurrencyState([FactionId.US]);
    const beforeRate = state.records[FactionId.US].exchangeRateVsUSD;
    processEndOfTurnCurrency(state, [], stubRng());
    expect(state.records[FactionId.US].exchangeRateVsUSD).toBe(beforeRate);
    expect(state.history[FactionId.US]).toHaveLength(0);
  });

  it('ignores events targeting nations not in state', () => {
    const state = initializeCurrencyState([FactionId.US]);
    const events: CurrencyEvent[] = [
      {
        eventId: 't3',
        eventType: 'sanctions',
        affectedNation: FactionId.Iran,
        rateImpactPercent: -10,
        description: 'Sanctions on Iran',
      },
    ];
    const result = processEndOfTurnCurrency(state, events, stubRng());
    // US should be unaffected
    expect(result.records[FactionId.US]).toBeDefined();
    expect(result.records[FactionId.Iran]).toBeUndefined();
  });
});

// ===========================================================================
// getCurrencyTopMovers
// ===========================================================================

describe('getCurrencyTopMovers', () => {
  function stateWithChanges(changes: Record<FactionId, number>): CurrencyState {
    const state = initializeCurrencyState(Object.keys(changes) as FactionId[]);
    for (const [id, pct] of Object.entries(changes)) {
      const rec = state.records[id as FactionId];
      if (rec) {
        state.records[id as FactionId] = { ...rec, percentChange: pct };
      }
    }
    return state;
  }

  it('returns nations sorted by absolute percent change descending', () => {
    const state = stateWithChanges({
      [FactionId.US]: -1,
      [FactionId.China]: 5,
      [FactionId.Russia]: -10,
    } as Record<FactionId, number>);
    const movers = getCurrencyTopMovers(state, 3);
    expect(movers[0].nation).toBe(FactionId.Russia);
    expect(movers[0].change).toBe(-10);
    expect(movers[1].nation).toBe(FactionId.China);
    expect(movers[2].nation).toBe(FactionId.US);
  });

  it('defaults to 5 results', () => {
    const ids = [FactionId.US, FactionId.China, FactionId.Russia,
                 FactionId.Japan, FactionId.Iran, FactionId.EU,
                 FactionId.DPRK, FactionId.Syria] as FactionId[];
    const changes: Record<string, number> = {};
    ids.forEach((id, i) => { changes[id] = (i + 1) * 2; });
    const state = stateWithChanges(changes as Record<FactionId, number>);
    const movers = getCurrencyTopMovers(state);
    expect(movers).toHaveLength(5);
  });

  it('handles count larger than number of nations', () => {
    const state = stateWithChanges({
      [FactionId.US]: 2,
      [FactionId.EU]: -3,
    } as Record<FactionId, number>);
    const movers = getCurrencyTopMovers(state, 10);
    expect(movers).toHaveLength(2);
  });

  it('returns empty array for empty state', () => {
    const state: CurrencyState = { records: {} as Record<FactionId, CurrencyRecord>, history: {} as Record<FactionId, CurrencyRecord[]> };
    const movers = getCurrencyTopMovers(state);
    expect(movers).toHaveLength(0);
  });
});

// ===========================================================================
// getCrossRateMatrix
// ===========================================================================

describe('getCrossRateMatrix', () => {
  it('computes correct cross rates between USD and EUR', () => {
    const state = initializeCurrencyState([FactionId.US, FactionId.EU]);
    const matrix = getCrossRateMatrix(state, [FactionId.US, FactionId.EU]);

    // USD/USD = 1
    expect(matrix['USD']['USD']).toBeCloseTo(1, 5);
    // EUR/EUR = 1
    expect(matrix['EUR']['EUR']).toBeCloseTo(1, 5);
    // USD vs EUR: 1.0 / 0.92 ≈ 1.087
    expect(matrix['USD']['EUR']).toBeCloseTo(1.0 / 0.92, 3);
    // EUR vs USD: 0.92 / 1.0 = 0.92
    expect(matrix['EUR']['USD']).toBeCloseTo(0.92, 5);
  });

  it('self-rate is always 1', () => {
    const state = initializeCurrencyState([FactionId.China, FactionId.Japan]);
    const matrix = getCrossRateMatrix(state, [FactionId.China, FactionId.Japan]);
    expect(matrix['CNY']['CNY']).toBeCloseTo(1, 5);
    expect(matrix['JPY']['JPY']).toBeCloseTo(1, 5);
  });

  it('reciprocal rates are consistent: A/B * B/A ≈ 1', () => {
    const state = initializeCurrencyState([FactionId.US, FactionId.Japan]);
    const matrix = getCrossRateMatrix(state, [FactionId.US, FactionId.Japan]);
    const ab = matrix['USD']['JPY'];
    const ba = matrix['JPY']['USD'];
    expect(ab * ba).toBeCloseTo(1, 5);
  });

  it('handles a single nation', () => {
    const state = initializeCurrencyState([FactionId.US]);
    const matrix = getCrossRateMatrix(state, [FactionId.US]);
    expect(matrix['USD']['USD']).toBeCloseTo(1, 5);
  });

  it('skips nations not in state', () => {
    const state = initializeCurrencyState([FactionId.US]);
    const matrix = getCrossRateMatrix(state, [FactionId.US, FactionId.Iran]);
    // Only USD row should exist
    expect(matrix['USD']).toBeDefined();
    expect(matrix['IRR']).toBeUndefined();
  });
});

// ===========================================================================
// Reserve buffer mechanics  (FR-3804)
// ===========================================================================

describe('reserve buffer', () => {
  const highReserveThreshold = GAME_CONFIG.currency.reserves.highReserveThreshold;

  it('high-reserve nation absorbs part of negative impact', () => {
    // China has 3200 B reserves — well above threshold of 500
    const rec = makeRecord(FactionId.China);
    expect(rec.foreignReserves).toBeGreaterThan(highReserveThreshold);

    const event: CurrencyEvent = {
      eventId: 'rb1',
      eventType: 'sanctions',
      affectedNation: FactionId.China,
      rateImpactPercent: -10,
      description: 'Test sanctions',
    };
    const withBuffer = applyEventToRate(rec, event, stubRng([0.5]));

    // Compare to a low-reserve nation with same rate
    const lowRec: CurrencyRecord = { ...rec, foreignReserves: 50 };
    const withoutBuffer = applyEventToRate(lowRec, event, stubRng([0.5]));

    // The high-reserve nation's rate should drop LESS (closer to original)
    const highDrop = rec.exchangeRateVsUSD - withBuffer.exchangeRateVsUSD;
    const lowDrop = rec.exchangeRateVsUSD - withoutBuffer.exchangeRateVsUSD;
    expect(Math.abs(highDrop)).toBeLessThan(Math.abs(lowDrop));
  });

  it('low-reserve nation gets no buffer', () => {
    // DPRK has 8 B reserves — far below threshold
    const rec = makeRecord(FactionId.DPRK);
    expect(rec.foreignReserves).toBeLessThan(highReserveThreshold);

    const event: CurrencyEvent = {
      eventId: 'rb2',
      eventType: 'sanctions',
      affectedNation: FactionId.DPRK,
      rateImpactPercent: -10,
      description: 'Test sanctions',
    };
    const result = applyEventToRate(rec, event, stubRng([0.5]));

    // Reserves should not have changed (no defense depletion)
    expect(result.foreignReserves).toBe(rec.foreignReserves);
  });

  it('buffer depletes reserves when activated', () => {
    const rec = makeRecord(FactionId.China);
    const event: CurrencyEvent = {
      eventId: 'rb3',
      eventType: 'market_shock',
      affectedNation: FactionId.China,
      rateImpactPercent: -20,
      description: 'Market crash',
    };
    const result = applyEventToRate(rec, event, stubRng([0.5]));
    expect(result.foreignReserves).toBeLessThan(rec.foreignReserves);
    expect(result.reserveChangeAmount).toBeLessThan(0);
  });

  it('positive events do not trigger reserve buffer', () => {
    const rec = makeRecord(FactionId.Japan);
    expect(rec.foreignReserves).toBeGreaterThan(highReserveThreshold);

    const event: CurrencyEvent = {
      eventId: 'rb4',
      eventType: 'trade_deal',
      affectedNation: FactionId.Japan,
      rateImpactPercent: 5,
      description: 'Trade deal',
    };
    const result = applyEventToRate(rec, event, stubRng([0.5]));
    // No reserve depletion on positive events
    expect(result.reserveChangeAmount).toBe(0);
    expect(result.foreignReserves).toBe(rec.foreignReserves);
  });
});

// ===========================================================================
// Edge cases
// ===========================================================================

describe('edge cases', () => {
  it('rate does not go below 0.0001 even with extreme negative impact', () => {
    const rec: CurrencyRecord = {
      ...makeRecord(FactionId.DPRK),
      exchangeRateVsUSD: 0.01,
    };
    const event: CurrencyEvent = {
      eventId: 'ec1',
      eventType: 'manipulation',
      affectedNation: FactionId.DPRK,
      rateImpactPercent: -99.99,
      description: 'Total collapse',
    };
    const result = applyEventToRate(rec, event, stubRng());
    expect(result.exchangeRateVsUSD).toBeGreaterThanOrEqual(0.0001);
  });

  it('handles zero-impact event gracefully', () => {
    const rec = makeRecord(FactionId.US);
    const event: CurrencyEvent = {
      eventId: 'ec2',
      eventType: 'manipulation',
      affectedNation: FactionId.US,
      rateImpactPercent: 0,
      description: 'No-op event',
    };
    const result = applyEventToRate(rec, event, stubRng());
    expect(result.exchangeRateVsUSD).toBe(rec.exchangeRateVsUSD);
  });

  it('multiple sequential turns accumulate history', () => {
    let state = initializeCurrencyState([FactionId.US]);
    const rng = stubRng([0.5]);

    // Turn 1
    state = processEndOfTurnCurrency(state, [], rng);
    expect(state.history[FactionId.US]).toHaveLength(1);

    // Turn 2
    state = processEndOfTurnCurrency(state, [], rng);
    expect(state.history[FactionId.US]).toHaveLength(2);

    // Turn 3
    state = processEndOfTurnCurrency(state, [], rng);
    expect(state.history[FactionId.US]).toHaveLength(3);
  });

  it('reserves cannot go below zero', () => {
    const rec: CurrencyRecord = {
      ...makeRecord(FactionId.China),
      foreignReserves: 510, // just above threshold
    };
    // Many shocks to drain reserves
    let current = rec;
    const event: CurrencyEvent = {
      eventId: 'ec3',
      eventType: 'market_shock',
      affectedNation: FactionId.China,
      rateImpactPercent: -20,
      description: 'Repeated shock',
    };
    for (let i = 0; i < 20; i++) {
      current = applyEventToRate(current, event, stubRng([0.5]));
    }
    expect(current.foreignReserves).toBeGreaterThanOrEqual(0);
  });
});
