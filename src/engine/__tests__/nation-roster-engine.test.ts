/**
 * Expanded Nation Roster Engine — Test Suite
 *
 * 60+ Vitest tests covering all 12 pure functions in nation-roster-engine.ts.
 *
 * @see FR-4801 — Nation roster definitions
 * @see FR-4802 — Regional groupings
 * @see FR-4803 — Alliance eligibility
 * @see FR-4804 — Exchange / currency mapping
 * @see FR-4805 — Default leader assignments
 * @see FR-4806 — Relationship seeds
 * @see FR-4807 — Flashpoint definitions
 */

import { describe, it, expect } from 'vitest';
import {
  initializeRosterState,
  getNation,
  getNationsByRegion,
  getNewNations,
  getOriginalNations,
  getFlashpointsForNation,
  getRelationshipSeed,
  buildExpandedRelationshipMatrix,
  getNationsWithAllianceEligibility,
  getNuclearCapableNations,
  validateRosterCompleteness,
  getRosterSummary,
} from '@/engine/nation-roster-engine';
import { nationRosterConfig } from '@/engine/config/nation-roster';
import type {
  NationRosterState,
  NationCapabilitySummary,
  NationRosterEntry,
} from '@/data/types/nation-roster.types';
import {
  ALL_NATIONS,
  ORIGINAL_NATIONS,
  NEW_NATIONS,
  EXPANDED_NATION_COUNT,
} from '@/data/types/nation-roster.types';

// ── Shared fixture ──────────────────────────────────────────────────────────

/** Full state built from the production config. */
const fullState: NationRosterState = initializeRosterState(nationRosterConfig);

// ═══════════════════════════════════════════════════════════════════════════
// Constants & guards
// ═══════════════════════════════════════════════════════════════════════════

describe('Nation roster constants', () => {
  it('ORIGINAL_NATIONS has exactly 8 entries', () => {
    expect(ORIGINAL_NATIONS).toHaveLength(8);
  });

  it('NEW_NATIONS has exactly 10 entries', () => {
    expect(NEW_NATIONS).toHaveLength(10);
  });

  it('ALL_NATIONS has exactly 18 entries', () => {
    expect(ALL_NATIONS).toHaveLength(18);
  });

  it('EXPANDED_NATION_COUNT equals 18', () => {
    expect(EXPANDED_NATION_COUNT).toBe(18);
  });

  it('ALL_NATIONS is the union of ORIGINAL + NEW', () => {
    expect([...ALL_NATIONS]).toEqual([...ORIGINAL_NATIONS, ...NEW_NATIONS]);
  });

  it('no duplicates in ALL_NATIONS', () => {
    const unique = new Set(ALL_NATIONS);
    expect(unique.size).toBe(ALL_NATIONS.length);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 1 — initializeRosterState
// ═══════════════════════════════════════════════════════════════════════════

describe('initializeRosterState', () => {
  it('creates a state with the correct number of nations', () => {
    expect(fullState.nations).toHaveLength(18);
  });

  it('creates a state with the correct number of flashpoints', () => {
    expect(fullState.flashpoints).toHaveLength(9);
  });

  it('creates a state with relationship seeds', () => {
    expect(fullState.relationshipSeeds.length).toBeGreaterThanOrEqual(30);
  });

  it('returns a new array reference (defensive copy)', () => {
    expect(fullState.nations).not.toBe(nationRosterConfig.nations);
  });

  it('handles empty config gracefully', () => {
    const empty = initializeRosterState({ nations: [], flashpoints: [], relationshipSeeds: [] });
    expect(empty.nations).toHaveLength(0);
    expect(empty.flashpoints).toHaveLength(0);
    expect(empty.relationshipSeeds).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 2 — getNation
// ═══════════════════════════════════════════════════════════════════════════

describe('getNation', () => {
  it('returns the US entry', () => {
    const us = getNation(fullState, 'us');
    expect(us).toBeDefined();
    expect(us!.displayName).toBe('United States');
    expect(us!.isOriginal).toBe(true);
  });

  it('returns Mexico entry (new nation)', () => {
    const mx = getNation(fullState, 'mexico');
    expect(mx).toBeDefined();
    expect(mx!.displayName).toBe('Mexico');
    expect(mx!.isOriginal).toBe(false);
  });

  it('returns India with correct fields', () => {
    const india = getNation(fullState, 'india');
    expect(india).toBeDefined();
    expect(india!.region).toBe('South Asia');
    expect(india!.currencyCode).toBe('INR');
    expect(india!.defaultLeaderId).toBe('narendra-modi');
  });

  it('returns Afghanistan with null exchangeId', () => {
    const af = getNation(fullState, 'afghanistan');
    expect(af).toBeDefined();
    expect(af!.exchangeId).toBeNull();
  });

  it('returns undefined for an invalid nation ID', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = getNation(fullState, 'atlantis' as any);
    expect(result).toBeUndefined();
  });

  it.each([
    ['taiwan', 'Taiwan', 'TWD'],
    ['brazil', 'Brazil', 'BRL'],
    ['pakistan', 'Pakistan', 'PKR'],
    ['saudi_arabia', 'Saudi Arabia', 'SAR'],
    ['egypt', 'Egypt', 'EGP'],
    ['lebanon', 'Lebanon', 'LBP'],
    ['australia', 'Australia', 'AUD'],
  ] as const)('returns %s with displayName=%s and currency=%s', (id, name, currency) => {
    const n = getNation(fullState, id);
    expect(n).toBeDefined();
    expect(n!.displayName).toBe(name);
    expect(n!.currencyCode).toBe(currency);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 3 — getNationsByRegion
// ═══════════════════════════════════════════════════════════════════════════

describe('getNationsByRegion', () => {
  it('returns Middle East nations', () => {
    const me = getNationsByRegion(fullState, 'Middle East');
    const ids = me.map((n) => n.id);
    expect(ids).toContain('iran');
    expect(ids).toContain('saudi_arabia');
    expect(ids).toContain('lebanon');
    expect(ids).toContain('syria');
  });

  it('returns East Asia nations', () => {
    const ea = getNationsByRegion(fullState, 'East Asia');
    const ids = ea.map((n) => n.id);
    expect(ids).toContain('china');
    expect(ids).toContain('japan');
    expect(ids).toContain('taiwan');
    expect(ids).toContain('dprk');
  });

  it('returns South Asia nations (India + Pakistan)', () => {
    const sa = getNationsByRegion(fullState, 'South Asia');
    expect(sa).toHaveLength(2);
    expect(sa.map((n) => n.id)).toEqual(expect.arrayContaining(['india', 'pakistan']));
  });

  it('returns North America nations (US + Mexico)', () => {
    const na = getNationsByRegion(fullState, 'North America');
    expect(na).toHaveLength(2);
    expect(na.map((n) => n.id)).toEqual(expect.arrayContaining(['us', 'mexico']));
  });

  it('returns empty array for unknown region', () => {
    expect(getNationsByRegion(fullState, 'Antarctica')).toHaveLength(0);
  });

  it('is case-sensitive', () => {
    expect(getNationsByRegion(fullState, 'middle east')).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 4 — getNewNations
// ═══════════════════════════════════════════════════════════════════════════

describe('getNewNations', () => {
  it('returns exactly 10 new nations', () => {
    expect(getNewNations(fullState)).toHaveLength(10);
  });

  it('every returned nation has isOriginal === false', () => {
    for (const n of getNewNations(fullState)) {
      expect(n.isOriginal).toBe(false);
    }
  });

  it('includes all expected new nation IDs', () => {
    const ids = getNewNations(fullState).map((n) => n.id);
    for (const expected of NEW_NATIONS) {
      expect(ids).toContain(expected);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 5 — getOriginalNations
// ═══════════════════════════════════════════════════════════════════════════

describe('getOriginalNations', () => {
  it('returns exactly 8 original nations', () => {
    expect(getOriginalNations(fullState)).toHaveLength(8);
  });

  it('every returned nation has isOriginal === true', () => {
    for (const n of getOriginalNations(fullState)) {
      expect(n.isOriginal).toBe(true);
    }
  });

  it('includes all expected original nation IDs', () => {
    const ids = getOriginalNations(fullState).map((n) => n.id);
    for (const expected of ORIGINAL_NATIONS) {
      expect(ids).toContain(expected);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6 — getFlashpointsForNation
// ═══════════════════════════════════════════════════════════════════════════

describe('getFlashpointsForNation', () => {
  it('returns Kashmir flashpoint for India', () => {
    const fps = getFlashpointsForNation(fullState, 'india');
    expect(fps.some((fp) => fp.id === 'WS-06')).toBe(true);
  });

  it('returns Kashmir flashpoint for Pakistan', () => {
    const fps = getFlashpointsForNation(fullState, 'pakistan');
    expect(fps.some((fp) => fp.id === 'WS-06')).toBe(true);
  });

  it('returns Taiwan Strait for China', () => {
    const fps = getFlashpointsForNation(fullState, 'china');
    expect(fps.some((fp) => fp.id === 'WS-07')).toBe(true);
  });

  it('returns Taiwan Strait for Taiwan', () => {
    const fps = getFlashpointsForNation(fullState, 'taiwan');
    expect(fps.some((fp) => fp.id === 'WS-07')).toBe(true);
  });

  it('returns AUKUS flashpoint for Australia', () => {
    const fps = getFlashpointsForNation(fullState, 'australia');
    expect(fps.some((fp) => fp.id === 'WS-14')).toBe(true);
  });

  it('returns Saudi-Iran rivalry for Saudi Arabia', () => {
    const fps = getFlashpointsForNation(fullState, 'saudi_arabia');
    expect(fps.some((fp) => fp.id === 'WS-08')).toBe(true);
  });

  it('returns Lebanon Collapse for Lebanon', () => {
    const fps = getFlashpointsForNation(fullState, 'lebanon');
    expect(fps.some((fp) => fp.id === 'WS-10')).toBe(true);
  });

  it('returns multiple flashpoints for US (Taiwan + Cartels + AUKUS)', () => {
    const fps = getFlashpointsForNation(fullState, 'us');
    expect(fps.length).toBeGreaterThanOrEqual(3);
  });

  it('returns multiple flashpoints for Iran (Saudi rivalry + Lebanon)', () => {
    const fps = getFlashpointsForNation(fullState, 'iran');
    expect(fps.length).toBeGreaterThanOrEqual(2);
  });

  it('returns empty for nation with no flashpoints', () => {
    const fps = getFlashpointsForNation(fullState, 'eu');
    // EU is not a primary nation in any of the 9 new flashpoints
    expect(fps).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7 — getRelationshipSeed
// ═══════════════════════════════════════════════════════════════════════════

describe('getRelationshipSeed', () => {
  it('returns 75 for India-Pakistan', () => {
    expect(getRelationshipSeed(fullState, 'india', 'pakistan')).toBe(75);
  });

  it('is bidirectional (Pakistan-India also returns 75)', () => {
    expect(getRelationshipSeed(fullState, 'pakistan', 'india')).toBe(75);
  });

  it('returns 80 for Taiwan-China', () => {
    expect(getRelationshipSeed(fullState, 'taiwan', 'china')).toBe(80);
  });

  it('returns negative value for India-US (friendly)', () => {
    expect(getRelationshipSeed(fullState, 'india', 'us')).toBeLessThan(0);
  });

  it('returns positive value for Australia-China (tense)', () => {
    expect(getRelationshipSeed(fullState, 'australia', 'china')).toBeGreaterThan(0);
  });

  it('returns negative value for Australia-US (allied)', () => {
    expect(getRelationshipSeed(fullState, 'australia', 'us')).toBeLessThan(0);
  });

  it('returns 0 for an unseeded pair', () => {
    expect(getRelationshipSeed(fullState, 'japan', 'egypt')).toBe(0);
  });

  it('returns 0 for same-nation pair', () => {
    expect(getRelationshipSeed(fullState, 'us', 'us')).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8 — buildExpandedRelationshipMatrix
// ═══════════════════════════════════════════════════════════════════════════

describe('buildExpandedRelationshipMatrix', () => {
  const matrix = buildExpandedRelationshipMatrix(fullState);

  it('has 18 row keys', () => {
    expect(Object.keys(matrix)).toHaveLength(18);
  });

  it('each row has 18 column keys', () => {
    for (const row of Object.values(matrix)) {
      expect(Object.keys(row)).toHaveLength(18);
    }
  });

  it('diagonal is always 0', () => {
    for (const id of Object.keys(matrix)) {
      expect(matrix[id]![id]).toBe(0);
    }
  });

  it('is symmetric: matrix[a][b] === matrix[b][a]', () => {
    const ids = Object.keys(matrix);
    for (const a of ids) {
      for (const b of ids) {
        expect(matrix[a]![b]).toBe(matrix[b]![a]);
      }
    }
  });

  it('seeded pair India-Pakistan is populated', () => {
    expect(matrix['india']!['pakistan']).toBe(75);
  });

  it('unseeded pair defaults to 0', () => {
    expect(matrix['japan']!['egypt']).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 9 — getNationsWithAllianceEligibility
// ═══════════════════════════════════════════════════════════════════════════

describe('getNationsWithAllianceEligibility', () => {
  it('BRICS includes China, Russia, Brazil, India', () => {
    const brics = getNationsWithAllianceEligibility(fullState, 'BRICS');
    const ids = brics.map((n) => n.id);
    expect(ids).toContain('china');
    expect(ids).toContain('russia');
    expect(ids).toContain('brazil');
    expect(ids).toContain('india');
  });

  it('NATO includes US and EU', () => {
    const nato = getNationsWithAllianceEligibility(fullState, 'NATO');
    const ids = nato.map((n) => n.id);
    expect(ids).toContain('us');
    expect(ids).toContain('eu');
  });

  it('Quad includes US, Japan, Australia, India', () => {
    const quad = getNationsWithAllianceEligibility(fullState, 'Quad');
    const ids = quad.map((n) => n.id);
    expect(ids).toContain('us');
    expect(ids).toContain('japan');
    expect(ids).toContain('australia');
    expect(ids).toContain('india');
  });

  it('AUKUS includes US and Australia', () => {
    const aukus = getNationsWithAllianceEligibility(fullState, 'AUKUS');
    const ids = aukus.map((n) => n.id);
    expect(ids).toContain('us');
    expect(ids).toContain('australia');
  });

  it('SCO includes correct members', () => {
    const sco = getNationsWithAllianceEligibility(fullState, 'SCO');
    const ids = sco.map((n) => n.id);
    expect(ids).toContain('china');
    expect(ids).toContain('russia');
    expect(ids).toContain('india');
    expect(ids).toContain('pakistan');
    expect(ids).toContain('iran');
  });

  it('OPEC includes Iran and Saudi Arabia', () => {
    const opec = getNationsWithAllianceEligibility(fullState, 'OPEC');
    const ids = opec.map((n) => n.id);
    expect(ids).toContain('iran');
    expect(ids).toContain('saudi_arabia');
  });

  it('returns empty for unknown alliance', () => {
    expect(getNationsWithAllianceEligibility(fullState, 'UNKNOWN')).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 10 — getNuclearCapableNations
// ═══════════════════════════════════════════════════════════════════════════

describe('getNuclearCapableNations', () => {
  const capabilities: NationCapabilitySummary[] = [
    { nationId: 'us', stability: 80, gdp: 25_000, militaryPower: 95, techLevel: 95, diplomaticInfluence: 90, nuclearCapable: true },
    { nationId: 'india', stability: 65, gdp: 3_500, militaryPower: 60, techLevel: 55, diplomaticInfluence: 50, nuclearCapable: true },
    { nationId: 'pakistan', stability: 40, gdp: 350, militaryPower: 45, techLevel: 30, diplomaticInfluence: 25, nuclearCapable: true },
    { nationId: 'brazil', stability: 55, gdp: 2_000, militaryPower: 30, techLevel: 40, diplomaticInfluence: 35, nuclearCapable: false },
    { nationId: 'egypt', stability: 50, gdp: 400, militaryPower: 35, techLevel: 25, diplomaticInfluence: 30, nuclearCapable: false },
  ];

  it('filters only nuclear-capable nations', () => {
    const result = getNuclearCapableNations(capabilities);
    expect(result).toHaveLength(3);
  });

  it('includes US, India, Pakistan', () => {
    const ids = getNuclearCapableNations(capabilities).map((c) => c.nationId);
    expect(ids).toEqual(expect.arrayContaining(['us', 'india', 'pakistan']));
  });

  it('excludes non-nuclear nations', () => {
    const ids = getNuclearCapableNations(capabilities).map((c) => c.nationId);
    expect(ids).not.toContain('brazil');
    expect(ids).not.toContain('egypt');
  });

  it('returns empty for all-false input', () => {
    const allFalse: NationCapabilitySummary[] = [
      { nationId: 'mexico', stability: 50, gdp: 1_300, militaryPower: 20, techLevel: 30, diplomaticInfluence: 25, nuclearCapable: false },
    ];
    expect(getNuclearCapableNations(allFalse)).toHaveLength(0);
  });

  it('returns empty for empty input', () => {
    expect(getNuclearCapableNations([])).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 11 — validateRosterCompleteness
// ═══════════════════════════════════════════════════════════════════════════

describe('validateRosterCompleteness', () => {
  it('full roster is complete', () => {
    const result = validateRosterCompleteness(fullState);
    expect(result.complete).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it('detects missing nations in a partial roster', () => {
    const partial: NationRosterState = {
      nations: fullState.nations.filter((n) => n.isOriginal),
      flashpoints: [],
      relationshipSeeds: [],
    };
    const result = validateRosterCompleteness(partial);
    expect(result.complete).toBe(false);
    expect(result.missing).toHaveLength(10);
    expect(result.missing).toContain('mexico');
    expect(result.missing).toContain('taiwan');
  });

  it('empty roster reports all 18 missing', () => {
    const empty: NationRosterState = { nations: [], flashpoints: [], relationshipSeeds: [] };
    const result = validateRosterCompleteness(empty);
    expect(result.complete).toBe(false);
    expect(result.missing).toHaveLength(18);
  });

  it('detects a single missing nation', () => {
    const withoutLebanon: NationRosterState = {
      nations: fullState.nations.filter((n) => n.id !== 'lebanon'),
      flashpoints: [],
      relationshipSeeds: [],
    };
    const result = validateRosterCompleteness(withoutLebanon);
    expect(result.complete).toBe(false);
    expect(result.missing).toEqual(['lebanon']);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 12 — getRosterSummary
// ═══════════════════════════════════════════════════════════════════════════

describe('getRosterSummary', () => {
  it('total is 18', () => {
    expect(getRosterSummary(fullState).total).toBe(18);
  });

  it('original is 8', () => {
    expect(getRosterSummary(fullState).original).toBe(8);
  });

  it('new is 10', () => {
    expect(getRosterSummary(fullState).new).toBe(10);
  });

  it('flashpointCount is 9', () => {
    expect(getRosterSummary(fullState).flashpointCount).toBe(9);
  });

  it('regions are sorted alphabetically', () => {
    const { regions } = getRosterSummary(fullState);
    const sorted = [...regions].sort();
    expect(regions).toEqual(sorted);
  });

  it('regions include expected values', () => {
    const { regions } = getRosterSummary(fullState);
    expect(regions).toContain('North America');
    expect(regions).toContain('East Asia');
    expect(regions).toContain('South Asia');
    expect(regions).toContain('Middle East');
  });

  it('summary for empty roster shows zeros', () => {
    const empty: NationRosterState = { nations: [], flashpoints: [], relationshipSeeds: [] };
    const summary = getRosterSummary(empty);
    expect(summary.total).toBe(0);
    expect(summary.original).toBe(0);
    expect(summary.new).toBe(0);
    expect(summary.flashpointCount).toBe(0);
    expect(summary.regions).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Cross-cutting: data integrity                                   FR-4804
// ═══════════════════════════════════════════════════════════════════════════

describe('Data integrity', () => {
  it('all nations have non-empty displayName', () => {
    for (const n of fullState.nations) {
      expect(n.displayName.length).toBeGreaterThan(0);
    }
  });

  it('all nations have non-empty region', () => {
    for (const n of fullState.nations) {
      expect(n.region.length).toBeGreaterThan(0);
    }
  });

  it('all nations have non-empty currencyCode', () => {
    for (const n of fullState.nations) {
      expect(n.currencyCode.length).toBeGreaterThan(0);
    }
  });

  it('all nations have non-empty defaultLeaderId', () => {
    for (const n of fullState.nations) {
      expect(n.defaultLeaderId.length).toBeGreaterThan(0);
    }
  });

  it('only Afghanistan and DPRK have null exchangeId', () => {
    const nullExchanges = fullState.nations.filter((n) => n.exchangeId === null);
    expect(nullExchanges).toHaveLength(2);
    expect(nullExchanges.map((n) => n.id)).toEqual(expect.arrayContaining(['afghanistan', 'dprk']));
  });

  it('all flashpoints have at least one primary nation', () => {
    for (const fp of fullState.flashpoints) {
      expect(fp.primaryNations.length).toBeGreaterThan(0);
    }
  });

  it('all flashpoints have valid maxSeverity (1-100)', () => {
    for (const fp of fullState.flashpoints) {
      expect(fp.maxSeverity).toBeGreaterThanOrEqual(1);
      expect(fp.maxSeverity).toBeLessThanOrEqual(100);
    }
  });

  it('all relationship seeds have tension in [-100, +100]', () => {
    for (const rs of fullState.relationshipSeeds) {
      expect(rs.initialTension).toBeGreaterThanOrEqual(-100);
      expect(rs.initialTension).toBeLessThanOrEqual(100);
    }
  });

  it('no duplicate relationship seeds', () => {
    const keys = fullState.relationshipSeeds.map(
      (rs) => [rs.nation1, rs.nation2].sort().join(':'),
    );
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  it('all relationship seed nations exist in roster', () => {
    const ids = new Set(fullState.nations.map((n) => n.id));
    for (const rs of fullState.relationshipSeeds) {
      expect(ids.has(rs.nation1)).toBe(true);
      expect(ids.has(rs.nation2)).toBe(true);
    }
  });
});
