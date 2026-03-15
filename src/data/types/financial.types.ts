/**
 * Financial Warfare Types — DR-128, DR-129, DR-137
 *
 * Sanctions, SWIFT disconnection, alternative payment systems,
 * and the Global Financial Stability Index.
 */

import type { FactionId, SanctionTier, SwiftStatus, TurnNumber } from './enums';

// ---------------------------------------------------------------------------
// DR-128 — Sanctions Registry
// ---------------------------------------------------------------------------

/**
 * A secondary sanction — penalty on a third party for trading with a sanctioned nation.
 */
export interface SecondarySanction {
  /** The nation imposing the secondary sanction. */
  imposer: FactionId;
  /** The third-party nation being pressured. */
  thirdParty: FactionId;
  /** Whether the third party is currently compliant. */
  compliant: boolean;
}

/**
 * A single sanctions entry in the global registry (DR-128).
 */
export interface Sanction {
  /** Nation imposing the sanctions. */
  imposer: FactionId;
  /** Nation being sanctioned. */
  target: FactionId;
  /** Severity tier. */
  tier: SanctionTier;
  /** How many turns these sanctions have been active. */
  turnsActive: number;
  /**
   * Cumulative effectiveness decay from sanctions fatigue.
   * Starts at 0; increases ~5%/turn as evasion grows.
   */
  fatigueDecay: number;
  /** Known sanctions evasion networks the target has developed. */
  evasionNetworks: string[];
  /** Secondary sanctions imposed on third parties. */
  secondarySanctions: SecondarySanction[];
}

/**
 * Global sanctions registry — all active sanctions.
 */
export type SanctionsRegistry = Sanction[];

// ---------------------------------------------------------------------------
// DR-129 — Financial Network State
// ---------------------------------------------------------------------------

/**
 * Per-nation financial network posture.
 */
export interface NationFinancialState {
  factionId: FactionId;
  /** SWIFT messaging network connection status. */
  swiftStatus: SwiftStatus;
  /**
   * Maturity of alternative payment systems (e.g. CIPS, SPFS, INSTEX).
   * Range: 0–100.
   */
  altPaymentMaturity: number;
  /**
   * Cryptocurrency infrastructure readiness.
   * Range: 0–100.
   */
  cryptoInfrastructure: number;
  /** Whether this nation is operating in war-economy mode. */
  warEconomy: boolean;
}

/**
 * A currency attack event.
 */
export interface CurrencyAttack {
  /** Attacker faction. */
  attacker: FactionId;
  /** Target faction whose currency is under attack. */
  target: FactionId;
  /** Severity of the attack. Range: 0–100. */
  severity: number;
  /** Turn the attack was initiated. */
  turnInitiated: TurnNumber;
  /** Whether the attack is still active. */
  active: boolean;
}

/**
 * Global financial network state (DR-129).
 */
export interface FinancialNetworkState {
  /** Per-nation financial posture. */
  nations: Record<FactionId, NationFinancialState>;
  /** Global Financial Stability Index. Range: 0–100. */
  gfsi: number;
  /** Active currency attacks. */
  currencyAttacks: CurrencyAttack[];
}

// ---------------------------------------------------------------------------
// DR-137 — Global Financial Stability Index
// ---------------------------------------------------------------------------

/**
 * Contributing factors to the GFSI calculation.
 */
export interface GFSIContributingFactors {
  /** Impact from active sanctions. Range: 0–100. */
  sanctions: number;
  /** Impact from trade wars. Range: 0–100. */
  tradeWars: number;
  /** Impact from currency attacks. Range: 0–100. */
  currencyAttacks: number;
  /** Impact from sovereign debt crises. Range: 0–100. */
  debtCrises: number;
}

/**
 * Global Financial Stability Index snapshot (DR-137).
 *
 * Tracks overall health of the global financial system.
 */
export interface GlobalFinancialStabilityIndex {
  turn: TurnNumber;
  /** GFSI composite score. Range: 0–100. Higher = more stable. */
  gfsi: number;
  /** Breakdown of factors affecting stability. */
  contributingFactors: GFSIContributingFactors;
  /** Whether financial contagion is actively spreading. */
  contagionActive: boolean;
  /** Nations currently affected by financial contagion. */
  affectedNations: FactionId[];
  /** Recovery trajectory description. */
  recoveryTrajectory: string;
}
