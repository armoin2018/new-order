/**
 * Proxy Wars and Non-State Actor Types — DR-135, DR-136, DR-140
 *
 * Proxy network relationships, the black-market arms bazaar,
 * and the non-state actor registry.
 */

import type {
  FactionId,
  ActorId,
  NonStateActorType,
  ProxyEscalationLevel,
  TurnNumber,
} from './enums';

// ---------------------------------------------------------------------------
// DR-135 — Proxy Network Graph
// ---------------------------------------------------------------------------

/**
 * A single operation in a proxy's history.
 */
export interface ProxyOperation {
  /** Human-readable operation name. */
  operationName: string;
  /** Turn the operation was executed. */
  turn: TurnNumber;
  /** Target of the operation. */
  target: FactionId | string;
  /** Whether the operation succeeded. */
  success: boolean;
  /** Whether the sponsor's involvement was exposed. */
  blowback: boolean;
}

/**
 * A single proxy relationship in the network graph (DR-135).
 *
 * Directed edge: sponsor → proxy actor.
 */
export interface ProxyRelationship {
  /** State sponsor funding/directing this proxy. */
  sponsor: FactionId;
  /** Name of the proxy group. */
  proxyName: string;
  /** Reference to the non-state actor (DR-140). */
  actorId: ActorId;
  /** Category of the proxy actor. */
  type: NonStateActorType;
  /** Proxy's loyalty to the sponsor. Range: 0–100. */
  loyalty: number;
  /** Military/operational capability. Range: 0–100. */
  capability: number;
  /** How independently the proxy acts. Range: 0–100. Higher = more autonomous. */
  autonomy: number;
  /** Plausible deniability of the sponsor's involvement. Range: 0–100. */
  deniability: number;
  /** Primary region of operations. */
  region: string;
  /** History of operations conducted by this proxy. */
  operationHistory: ProxyOperation[];
  /**
   * Current escalation level (1–4).
   * 1 = Shadow War, 2 = Acknowledged Support,
   * 3 = Limited Intervention, 4 = Direct Confrontation.
   */
  escalationLevel: ProxyEscalationLevel;
}

/**
 * The full proxy network graph — all sponsor-proxy relationships.
 */
export type ProxyNetworkGraph = ProxyRelationship[];

// ---------------------------------------------------------------------------
// DR-136 — Arms Bazaar Transaction Log
// ---------------------------------------------------------------------------

/**
 * A single black-market arms transaction.
 */
export interface ArmsBazaarTransaction {
  /** Selling nation or actor. */
  seller: FactionId | string;
  /** Buying nation or proxy actor. */
  buyer: FactionId | string;
  /** Type of arms/equipment traded. */
  itemType: string;
  /** Number of units traded. */
  quantity: number;
  /** Price in billions (USD equivalent). */
  price: number;
  /** Turn the transaction was completed. */
  turnCompleted: TurnNumber;
  /**
   * How traceable this transaction is to the seller.
   * Range: 0–100. Higher = more traceable.
   */
  traceability: number;
  /** Whether the sold equipment is defective. */
  defective: boolean;
}

/**
 * The full arms bazaar transaction log — append-only.
 */
export type ArmsBazaarTransactionLog = ArmsBazaarTransaction[];

// ---------------------------------------------------------------------------
// DR-140 — Non-State Actor Registry
// ---------------------------------------------------------------------------

/**
 * A single non-state actor in the global registry (DR-140).
 *
 * Non-state actors may be sponsored by a state (linked via ProxyNetworkGraph)
 * or may operate independently.
 */
export interface NonStateActor {
  readonly id: ActorId;
  /** Display name of the group. */
  name: string;
  /** Category of the actor. */
  type: NonStateActorType;
  /** Sponsoring nation (null if independent). */
  sponsor: FactionId | null;
  /** Primary region of operations. */
  region: string;
  /** Military/operational capability. Range: 0–100. */
  capability: number;
  /** Loyalty to sponsor (0 if independent). Range: 0–100. */
  loyalty: number;
  /** How independently the actor operates. Range: 0–100. */
  autonomy: number;
  /** Plausible deniability of any state connection. Range: 0–100. */
  deniability: number;
  /** Factions this actor is hostile towards. */
  hostileTowards: FactionId[];
  /** Currently active operations. */
  activeOps: string[];
  /** Whether this actor operates without any state sponsor. */
  independent: boolean;
}

/**
 * The full non-state actor registry keyed by ActorId.
 */
export type NonStateActorRegistry = Record<ActorId, NonStateActor>;
