/**
 * New Order — Currency Exchange Rate Configuration
 *
 * Defines initial exchange rates, foreign reserves, event impact ranges,
 * manipulation thresholds, and reserve mechanics for the currency subsystem.
 *
 * @see FR-3800 — Currency Exchange Rate System
 * @see FR-3801 — Event-Driven Rate Fluctuations
 * @see FR-3803 — Currency Manipulation Mechanics
 * @see FR-3804 — Foreign Reserve Mechanics
 * @see NFR-204 — All game formulas configurable via constants
 */

export const currencyConfig = {
  /** Nation currency definitions — initial rates vs USD. Keys are FactionId values. */
  nationCurrencies: {
    us:   { currencyCode: 'USD', currencyName: 'US Dollar',         initialRateVsUSD: 1.0,    initialReserves: 250,  isSafeHaven: true  },
    china:{ currencyCode: 'CNY', currencyName: 'Chinese Yuan',      initialRateVsUSD: 7.25,   initialReserves: 3200, isSafeHaven: false },
    russia:{ currencyCode: 'RUB', currencyName: 'Russian Ruble',    initialRateVsUSD: 92.5,   initialReserves: 580,  isSafeHaven: false },
    eu:   { currencyCode: 'EUR', currencyName: 'Euro',              initialRateVsUSD: 0.92,   initialReserves: 800,  isSafeHaven: true  },
    japan:{ currencyCode: 'JPY', currencyName: 'Japanese Yen',      initialRateVsUSD: 151.2,  initialReserves: 1200, isSafeHaven: true  },
    iran: { currencyCode: 'IRR', currencyName: 'Iranian Rial',      initialRateVsUSD: 580000, initialReserves: 120,  isSafeHaven: false },
    dprk: { currencyCode: 'KPW', currencyName: 'North Korean Won',  initialRateVsUSD: 8500,   initialReserves: 8,    isSafeHaven: false },
    syria:{ currencyCode: 'SYP', currencyName: 'Syrian Pound',      initialRateVsUSD: 13000,  initialReserves: 1.5,  isSafeHaven: false },
  } as Record<string, { currencyCode: string; currencyName: string; initialRateVsUSD: number; initialReserves: number; isSafeHaven: boolean }>,

  /** Impact ranges for different event types (FR-3801). Min/max are percent. */
  eventImpactRanges: {
    sanctions:              { min: -15, max: -5  },
    trade_deal:             { min:   3, max:  8  },
    market_shock:           { min: -20, max: -5  },
    inflation:              { min: -10, max: -2  },
    military_conflict_zone: { min: -15, max: -5  },
    military_safe_haven:    { min:   2, max:  5  },
  },

  /** Currency manipulation impact ranges (FR-3803). Min/max are percent. */
  manipulationImpacts: {
    devaluation:           { min: -20, max: -10 },
    reserve_weaponization: { min: -10, max: -5  },
    currency_attack:       { min: -30, max: -15 },
    swift_disconnection:   { min: -50, max: -30 },
  },

  /** Reserve thresholds in billions USD (FR-3804). */
  reserves: {
    /** Nations with reserves above this are "high-reserve" and get a buffer. */
    highReserveThreshold: 500,
    /** Percentage of negative impact absorbed when reserves are high. */
    reserveBufferPercent: 10,
    /** Reserves spent per defensive intervention (billions USD). */
    reserveDepletionPerDefense: 50,
    /** Fraction of reserves regenerated per turn from trade surplus. */
    tradeSuplusRegenRate: 0.02,
  },
} as const;
