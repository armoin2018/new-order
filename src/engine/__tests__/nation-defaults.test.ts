import { describe, it, expect } from 'vitest';
import {
  NATION_POLITICAL_SYSTEMS,
  NATION_EQUIPMENT_DEFAULTS,
  NATION_EDUCATION_DEFAULTS,
  getNationDefaults,
  getAllNationDefaults,
} from '@/engine/nation-defaults';
import type { FactionId } from '@/data/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ALL_FACTIONS: readonly FactionId[] = [
  'us', 'china', 'russia', 'japan', 'iran', 'dprk', 'eu', 'syria',
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NationDefaults', () => {
  // ── Map completeness ────────────────────────────────────────────────

  it('NATION_POLITICAL_SYSTEMS has all 8 factions', () => {
    for (const fid of ALL_FACTIONS) {
      expect(NATION_POLITICAL_SYSTEMS[fid]).toBeDefined();
    }
    expect(Object.keys(NATION_POLITICAL_SYSTEMS)).toHaveLength(8);
  });

  it('NATION_EQUIPMENT_DEFAULTS has all 8 factions', () => {
    for (const fid of ALL_FACTIONS) {
      expect(NATION_EQUIPMENT_DEFAULTS[fid]).toBeDefined();
    }
    expect(Object.keys(NATION_EQUIPMENT_DEFAULTS)).toHaveLength(8);
  });

  it('NATION_EDUCATION_DEFAULTS has all 8 factions', () => {
    for (const fid of ALL_FACTIONS) {
      expect(NATION_EDUCATION_DEFAULTS[fid]).toBeDefined();
    }
    expect(Object.keys(NATION_EDUCATION_DEFAULTS)).toHaveLength(8);
  });

  // ── Political system mappings ───────────────────────────────────────

  it('USA is mapped to liberal-democracy', () => {
    expect(NATION_POLITICAL_SYSTEMS.us).toBe('liberal-democracy');
  });

  it('China is mapped to one-party-state', () => {
    expect(NATION_POLITICAL_SYSTEMS.china).toBe('one-party-state');
  });

  it('Russia is mapped to authoritarian-republic', () => {
    expect(NATION_POLITICAL_SYSTEMS.russia).toBe('authoritarian-republic');
  });

  it('Iran is mapped to theocracy', () => {
    expect(NATION_POLITICAL_SYSTEMS.iran).toBe('theocracy');
  });

  it('DPRK is mapped to communist-state', () => {
    expect(NATION_POLITICAL_SYSTEMS.dprk).toBe('communist-state');
  });

  // ── Equipment constraints ───────────────────────────────────────────

  it('each faction has at least 3 equipment entries', () => {
    for (const fid of ALL_FACTIONS) {
      expect(NATION_EQUIPMENT_DEFAULTS[fid].length).toBeGreaterThanOrEqual(3);
    }
  });

  it('equipment entries have valid readiness (0-100)', () => {
    for (const fid of ALL_FACTIONS) {
      for (const entry of NATION_EQUIPMENT_DEFAULTS[fid]) {
        expect(entry.readiness).toBeGreaterThanOrEqual(0);
        expect(entry.readiness).toBeLessThanOrEqual(100);
      }
    }
  });

  it('equipment entries have positive quantity', () => {
    for (const fid of ALL_FACTIONS) {
      for (const entry of NATION_EQUIPMENT_DEFAULTS[fid]) {
        expect(entry.quantity).toBeGreaterThan(0);
      }
    }
  });

  // ── Education constraints ───────────────────────────────────────────

  it('each faction has at least 2 education entries', () => {
    for (const fid of ALL_FACTIONS) {
      expect(NATION_EDUCATION_DEFAULTS[fid].length).toBeGreaterThanOrEqual(2);
    }
  });

  // ── getNationDefaults ───────────────────────────────────────────────

  it('getNationDefaults returns correct structure for each faction', () => {
    for (const fid of ALL_FACTIONS) {
      const defaults = getNationDefaults(fid);
      expect(defaults.factionId).toBe(fid);
      expect(defaults.politicalSystemId).toBe(NATION_POLITICAL_SYSTEMS[fid]);
      expect(defaults.equipment).toBe(NATION_EQUIPMENT_DEFAULTS[fid]);
      expect(defaults.education).toBe(NATION_EDUCATION_DEFAULTS[fid]);
    }
  });

  // ── getAllNationDefaults ─────────────────────────────────────────────

  it('getAllNationDefaults returns 8 entries', () => {
    const all = getAllNationDefaults();
    expect(all).toHaveLength(8);
  });

  it('getAllNationDefaults entries match getNationDefaults output', () => {
    const all = getAllNationDefaults();
    for (const entry of all) {
      const direct = getNationDefaults(entry.factionId);
      expect(entry).toEqual(direct);
    }
  });
});
