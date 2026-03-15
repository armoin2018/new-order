/**
 * Chaotic Events Engine Tests — FR-7005
 */
import { describe, it, expect } from 'vitest';
import {
  initChaoticEventState,
  generateChaoticEvents,
  processChaoticEvents,
  activateDisasterResponse,
  getActiveSeverityForFaction,
} from '../chaotic-events-engine';
import type { ChaoticEvent, ChaoticEventState } from '@/data/types/economic-state.types';
import type { FactionId, TurnNumber } from '@/data/types/enums';
import type { NationState } from '@/data/types/nation.types';

const FACTIONS: readonly FactionId[] = ['us', 'china', 'russia', 'japan', 'iran', 'dprk', 'eu', 'syria'] as const;

function mockNS(factionId: FactionId): NationState {
  return {
    factionId,
    stability: 60,
    treasury: 500,
    gdp: 10000,
    inflation: 5,
    militaryReadiness: 70,
    nuclearThreshold: 30,
    diplomaticInfluence: 60,
    popularity: 55,
    allianceCredibility: 70,
    techLevel: 70,
  };
}

// ─── Initialization ─────────────────────────────────────────────────────────

describe('FR-7005 Chaotic Events — Initialization', () => {
  it('creates empty event state', () => {
    const state = initChaoticEventState();
    expect(state.activeEvents).toEqual([]);
    expect(state.historicalEvents).toEqual([]);
    expect(state.pandemicAlertLevel).toBe(0);
    expect(state.totalDisastersThisGame).toBe(0);
  });
});

// ─── Event Generation ───────────────────────────────────────────────────────

describe('FR-7005 generateChaoticEvents', () => {
  it('generates no events when all rolls are above probability', () => {
    const state = initChaoticEventState();
    const rolls: Record<string, number> = {};
    for (const f of FACTIONS) rolls[f] = 0.99;

    const events = generateChaoticEvents({
      turn: 1 as TurnNumber,
      currentState: state,
      factions: FACTIONS,
      factionRolls: rolls,
      typeRolls: rolls,
      severityRolls: rolls,
    });
    expect(events).toEqual([]);
  });

  it('generates events when roll is below probability', () => {
    const state = initChaoticEventState();
    const factionRolls: Record<string, number> = {};
    const typeRolls: Record<string, number> = {};
    const severityRolls: Record<string, number> = {};
    for (const f of FACTIONS) {
      factionRolls[f] = 0.01; // very low → all should trigger
      typeRolls[f] = 0.5;
      severityRolls[f] = 0.5;
    }

    const events = generateChaoticEvents({
      turn: 1 as TurnNumber,
      currentState: state,
      factions: FACTIONS,
      factionRolls,
      typeRolls,
      severityRolls,
    });
    // At least some events should be generated
    expect(events.length).toBeGreaterThan(0);
    // Each event should have proper structure
    for (const e of events) {
      expect(e.id).toBeTruthy();
      expect(e.type).toBeTruthy();
      expect(e.targetNation).toBeTruthy();
      expect(e.severity).toBeGreaterThanOrEqual(1);
      expect(e.severity).toBeLessThanOrEqual(10);
      expect(e.duration).toBeGreaterThanOrEqual(1);
      expect(e.active).toBe(true);
      expect(e.responseActivated).toBe(false);
    }
  });

  it('respects maxActiveEvents cap', () => {
    const state: ChaoticEventState = {
      activeEvents: Array.from({ length: 4 }, (_, i) => ({
        id: `existing-${i}`,
        type: 'earthquake' as const,
        targetNation: 'us' as FactionId,
        name: `Existing ${i}`,
        severity: 5,
        turnFired: 1 as TurnNumber,
        duration: 2,
        turnsRemaining: 1,
        active: true,
        economicDamage: 0,
        populationImpact: 0,
        infrastructureDamage: 0,
        responseActivated: false,
      })),
      historicalEvents: [],
      pandemicAlertLevel: 0,
      totalDisastersThisGame: 4,
    };

    const factionRolls: Record<string, number> = {};
    for (const f of FACTIONS) factionRolls[f] = 0.01;

    const events = generateChaoticEvents({
      turn: 1 as TurnNumber,
      currentState: state,
      factions: FACTIONS,
      factionRolls,
      typeRolls: factionRolls,
      severityRolls: factionRolls,
    });
    expect(events).toEqual([]);
  });

  it('probability increases with turn number', () => {
    const state = initChaoticEventState();
    // A roll of 0.05 should fail on turn 1 (base prob ~0.06) but succeed more often on turn 50
    const borderlineRolls: Record<string, number> = {};
    for (const f of FACTIONS) borderlineRolls[f] = 0.1;

    const earlyEvents = generateChaoticEvents({
      turn: 1 as TurnNumber,
      currentState: state,
      factions: FACTIONS,
      factionRolls: borderlineRolls,
      typeRolls: borderlineRolls,
      severityRolls: borderlineRolls,
    });

    const lateEvents = generateChaoticEvents({
      turn: 50 as TurnNumber,
      currentState: state,
      factions: FACTIONS,
      factionRolls: borderlineRolls,
      typeRolls: borderlineRolls,
      severityRolls: borderlineRolls,
    });

    expect(lateEvents.length).toBeGreaterThanOrEqual(earlyEvents.length);
  });
});

// ─── Event Processing ───────────────────────────────────────────────────────

describe('FR-7005 processChaoticEvents', () => {
  function makeActiveEvent(overrides: Partial<ChaoticEvent> = {}): ChaoticEvent {
    return {
      id: 'test-event-1',
      type: 'earthquake',
      targetNation: 'japan' as FactionId,
      name: 'Japanese Earthquake (T5)',
      severity: 7,
      turnFired: 5 as TurnNumber,
      duration: 2,
      turnsRemaining: 2,
      active: true,
      economicDamage: 0,
      populationImpact: 0,
      infrastructureDamage: 0,
      responseActivated: false,
      ...overrides,
    };
  }

  it('accumulates economic damage per severity', () => {
    const state: ChaoticEventState = {
      activeEvents: [makeActiveEvent()],
      historicalEvents: [],
      pandemicAlertLevel: 0,
      totalDisastersThisGame: 1,
    };
    const ns: Record<string, NationState> = { japan: mockNS('japan' as FactionId) };
    const result = processChaoticEvents({
      currentState: state,
      nationStates: ns,
      tradePartners: { japan: ['us', 'china'] as FactionId[] },
      spreadRolls: {},
      turn: 6 as TurnNumber,
    });
    expect(result.economicDamageByFaction['japan']).toBeGreaterThan(0);
    expect(result.stabilityImpactByFaction['japan']).toBeLessThan(0);
    expect(result.inflationImpactByFaction['japan']).toBeGreaterThan(0);
    expect(result.gdpPenaltyByFaction['japan']).toBeLessThan(0);
  });

  it('decrements turnsRemaining and resolves expired events', () => {
    const event = makeActiveEvent({ turnsRemaining: 1 });
    const state: ChaoticEventState = {
      activeEvents: [event],
      historicalEvents: [],
      pandemicAlertLevel: 0,
      totalDisastersThisGame: 1,
    };
    const result = processChaoticEvents({
      currentState: state,
      nationStates: { japan: mockNS('japan' as FactionId) },
      tradePartners: {},
      spreadRolls: {},
      turn: 6 as TurnNumber,
    });
    expect(result.state.activeEvents).toHaveLength(0);
    expect(result.state.historicalEvents.length).toBeGreaterThan(0);
  });

  it('generates headlines for active events', () => {
    const event = makeActiveEvent({ turnsRemaining: 2, duration: 2 });
    const state: ChaoticEventState = {
      activeEvents: [event],
      historicalEvents: [],
      pandemicAlertLevel: 0,
      totalDisastersThisGame: 1,
    };
    const result = processChaoticEvents({
      currentState: state,
      nationStates: { japan: mockNS('japan' as FactionId) },
      tradePartners: {},
      spreadRolls: {},
      turn: 5 as TurnNumber,
    });
    expect(result.headlines.length).toBeGreaterThan(0);
    expect(result.headlines[0]).toContain('BREAKING');
  });

  it('disaster response reduces damage', () => {
    const noResponse = makeActiveEvent({ responseActivated: false });
    const withResponse = makeActiveEvent({ responseActivated: true });

    const stateNoResp: ChaoticEventState = {
      activeEvents: [noResponse],
      historicalEvents: [],
      pandemicAlertLevel: 0,
      totalDisastersThisGame: 1,
    };
    const stateWithResp: ChaoticEventState = {
      activeEvents: [withResponse],
      historicalEvents: [],
      pandemicAlertLevel: 0,
      totalDisastersThisGame: 1,
    };

    const ns: Record<string, NationState> = { japan: mockNS('japan' as FactionId) };
    const resultNoResp = processChaoticEvents({
      currentState: stateNoResp, nationStates: ns, tradePartners: {}, spreadRolls: {}, turn: 6 as TurnNumber,
    });
    const resultWithResp = processChaoticEvents({
      currentState: stateWithResp, nationStates: ns, tradePartners: {}, spreadRolls: {}, turn: 6 as TurnNumber,
    });
    expect(resultWithResp.economicDamageByFaction['japan']).toBeLessThan(
      resultNoResp.economicDamageByFaction['japan']!,
    );
  });

  it('virus events can spread to trade partners', () => {
    const virus = makeActiveEvent({
      type: 'virus',
      targetNation: 'china' as FactionId,
      turnsRemaining: 5,
    });
    const state: ChaoticEventState = {
      activeEvents: [virus],
      historicalEvents: [],
      pandemicAlertLevel: 0,
      totalDisastersThisGame: 1,
    };
    // Low spread roll → should trigger
    const result = processChaoticEvents({
      currentState: state,
      nationStates: { china: mockNS('china' as FactionId) },
      tradePartners: { china: ['japan', 'us'] as FactionId[] },
      spreadRolls: { japan: 0.01, us: 0.01 },
      turn: 6 as TurnNumber,
    });
    expect(result.virusSpreadTargets.length).toBeGreaterThan(0);
    expect(result.virusSpreadTargets[0]?.from).toBe('china');
  });

  it('updates pandemic alert level for active viruses', () => {
    const virus = makeActiveEvent({
      type: 'virus',
      severity: 8,
      turnsRemaining: 3,
    });
    const state: ChaoticEventState = {
      activeEvents: [virus],
      historicalEvents: [],
      pandemicAlertLevel: 0,
      totalDisastersThisGame: 1,
    };
    const result = processChaoticEvents({
      currentState: state,
      nationStates: { japan: mockNS('japan' as FactionId) },
      tradePartners: {},
      spreadRolls: {},
      turn: 6 as TurnNumber,
    });
    expect(result.state.pandemicAlertLevel).toBeGreaterThan(0);
  });
});

// ─── Disaster Response ──────────────────────────────────────────────────────

describe('FR-7005 activateDisasterResponse', () => {
  it('activates response and returns cost', () => {
    const event: ChaoticEvent = {
      id: 'test-1',
      type: 'hurricane',
      targetNation: 'us' as FactionId,
      name: 'Hurricane Test',
      severity: 7,
      turnFired: 1 as TurnNumber,
      duration: 2,
      turnsRemaining: 2,
      active: true,
      economicDamage: 0,
      populationImpact: 0,
      infrastructureDamage: 0,
      responseActivated: false,
    };
    const result = activateDisasterResponse(event);
    expect(result.event.responseActivated).toBe(true);
    expect(result.cost).toBe(35); // 7 severity × $5B per severity
  });

  it('does not double-activate', () => {
    const event: ChaoticEvent = {
      id: 'test-1',
      type: 'hurricane',
      targetNation: 'us' as FactionId,
      name: 'Hurricane Test',
      severity: 7,
      turnFired: 1 as TurnNumber,
      duration: 2,
      turnsRemaining: 2,
      active: true,
      economicDamage: 50,
      populationImpact: 100,
      infrastructureDamage: 20,
      responseActivated: true,
    };
    const result = activateDisasterResponse(event);
    expect(result.cost).toBe(0);
  });
});

// ─── Helper Functions ───────────────────────────────────────────────────────

describe('FR-7005 getActiveSeverityForFaction', () => {
  it('sums severity of active events for a faction', () => {
    const state: ChaoticEventState = {
      activeEvents: [
        { id: '1', type: 'earthquake', targetNation: 'japan' as FactionId, name: 'EQ1', severity: 5, turnFired: 1 as TurnNumber, duration: 1, turnsRemaining: 1, active: true, economicDamage: 0, populationImpact: 0, infrastructureDamage: 0, responseActivated: false },
        { id: '2', type: 'flood', targetNation: 'japan' as FactionId, name: 'FL1', severity: 3, turnFired: 1 as TurnNumber, duration: 1, turnsRemaining: 1, active: true, economicDamage: 0, populationImpact: 0, infrastructureDamage: 0, responseActivated: false },
        { id: '3', type: 'wildfire', targetNation: 'us' as FactionId, name: 'WF1', severity: 4, turnFired: 1 as TurnNumber, duration: 1, turnsRemaining: 1, active: true, economicDamage: 0, populationImpact: 0, infrastructureDamage: 0, responseActivated: false },
      ],
      historicalEvents: [],
      pandemicAlertLevel: 0,
      totalDisastersThisGame: 3,
    };
    expect(getActiveSeverityForFaction(state, 'japan' as FactionId)).toBe(8);
    expect(getActiveSeverityForFaction(state, 'us' as FactionId)).toBe(4);
    expect(getActiveSeverityForFaction(state, 'china' as FactionId)).toBe(0);
  });
});
