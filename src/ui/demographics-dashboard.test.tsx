/**
 * Tests for DemographicsDashboard — CNFL-3504
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act, createElement } from 'react';
import {
  DemographicsDashboard,
  type DemographicsDashboardProps,
  type DemographicsMetrics,
  type AgeBracket,
  type MigrationFlow,
  type ReligiousGroup,
  type RegionData,
  type PopulationForecast,
} from './DemographicsDashboard';

let container: HTMLDivElement;
let root: Root;

function mkMetrics(overrides: Partial<DemographicsMetrics> = {}): DemographicsMetrics {
  return { totalPopulation: 330_000_000, urbanPercent: 83, ruralPercent: 17, medianAge: 38, growthRate: 0.7, fertilityRate: 1.7, lifeExpectancy: 78, ...overrides };
}

function mkAge(label: string, m: number, f: number): AgeBracket {
  return { label, malePercent: m, femalePercent: f };
}

function mkFlow(overrides: Partial<MigrationFlow> = {}): MigrationFlow {
  return { fromNation: 'Mexico', toNation: 'USA', volume: 500_000, reason: 'Economic', ...overrides };
}

function mkReligion(overrides: Partial<ReligiousGroup> = {}): ReligiousGroup {
  return { religionId: 'christian', name: 'Christianity', percent: 65, radicalizationRisk: 10, trend: 'stable', ...overrides };
}

function mkRegion(overrides: Partial<RegionData> = {}): RegionData {
  return { regionId: 'northeast', name: 'Northeast', population: 55_000_000, urbanPercent: 90, dominantReligion: 'Christianity', growthRate: 0.3, ...overrides };
}

function mkForecast(overrides: Partial<PopulationForecast> = {}): PopulationForecast {
  return { turn: 10, totalPopulation: 340_000_000, urbanPercent: 85, medianAge: 39, ...overrides };
}

function render(props: Partial<DemographicsDashboardProps> = {}) {
  const all: DemographicsDashboardProps = {
    metrics: mkMetrics(),
    agePyramid: [mkAge('0-14', 9, 8.5), mkAge('15-24', 6.5, 6.2), mkAge('25-54', 20, 19.5)],
    migrationFlows: [mkFlow()],
    religions: [mkReligion(), mkReligion({ religionId: 'islam', name: 'Islam', percent: 3, radicalizationRisk: 25, trend: 'growing' })],
    regions: [mkRegion(), mkRegion({ regionId: 'south', name: 'South', population: 125_000_000 })],
    forecasts: [mkForecast()],
    nationName: 'United States',
    ...props,
  };
  act(() => { root.render(createElement(DemographicsDashboard, all)); });
}

const q = (id: string) => container.querySelector(`[data-testid="${id}"]`);

beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });

describe('DemographicsDashboard', () => {
  describe('rendering', () => {
    it('renders the main panel', () => { render(); expect(q('demographics-dashboard')).toBeTruthy(); });
    it('shows nation name', () => { render(); expect(container.textContent).toContain('United States'); });
    it('shows metric cards', () => { render(); expect(q('metrics-row')).toBeTruthy(); expect(q('metrics-row')!.textContent).toContain('330.0M'); });
    it('shows median age', () => { render(); expect(q('metrics-row')!.textContent).toContain('38'); });
    it('shows growth rate', () => { render(); expect(q('metrics-row')!.textContent).toContain('+0.7%'); });
    it('shows life expectancy', () => { render(); expect(q('metrics-row')!.textContent).toContain('78'); });
    it('shows negative growth rate without +', () => {
      render({ metrics: mkMetrics({ growthRate: -0.3 }) });
      expect(q('metrics-row')!.textContent).toContain('-0.3%');
    });
  });

  describe('urbanization', () => {
    it('renders urbanization bar', () => { render(); expect(q('urbanization')).toBeTruthy(); expect(q('urbanization')!.textContent).toContain('Urban 83%'); });
  });

  describe('age pyramid', () => {
    it('renders age brackets', () => { render(); expect(q('age-pyramid')).toBeTruthy(); expect(q('age-0-14')).toBeTruthy(); expect(q('age-15-24')).toBeTruthy(); });
    it('hides when empty', () => { render({ agePyramid: [] }); expect(q('age-pyramid')).toBeFalsy(); });
  });

  describe('migration', () => {
    it('renders migration flows', () => { render(); expect(q('migration-flows')).toBeTruthy(); expect(q('flow-0')!.textContent).toContain('Mexico'); });
    it('shows volume', () => { render(); expect(q('flow-0')!.textContent).toContain('500.0K'); });
    it('hides when empty', () => { render({ migrationFlows: [] }); expect(q('migration-flows')).toBeFalsy(); });
  });

  describe('religions', () => {
    it('renders religions', () => { render(); expect(q('religions')).toBeTruthy(); expect(q('religion-christian')).toBeTruthy(); });
    it('shows percent and risk', () => { render(); expect(q('religion-christian')!.textContent).toContain('65%'); expect(q('religion-christian')!.textContent).toContain('Risk: 10%'); });
    it('shows overall radicalization', () => {
      render();
      expect(q('radicalization-overall')).toBeTruthy();
      // weighted: 65*10/100 + 3*25/100 = 6.5 + 0.75 = 7.25 → 7
      expect(q('radicalization-overall')!.textContent).toContain('7%');
    });
    it('hides when empty', () => { render({ religions: [] }); expect(q('religions')).toBeFalsy(); });
  });

  describe('forecasts', () => {
    it('renders forecast', () => { render(); expect(q('forecasts')).toBeTruthy(); expect(q('forecast-10')).toBeTruthy(); });
    it('shows population', () => { render(); expect(q('forecast-10')!.textContent).toContain('340.0M'); });
    it('hides when empty', () => { render({ forecasts: [] }); expect(q('forecasts')).toBeFalsy(); });
  });

  describe('regions', () => {
    it('renders region cards', () => { render(); expect(q('regions')).toBeTruthy(); expect(q('region-northeast')).toBeTruthy(); expect(q('region-south')).toBeTruthy(); });
    it('shows region drill-down on click', () => {
      render();
      expect(q('region-detail')).toBeFalsy();
      act(() => { (q('region-northeast') as HTMLElement).click(); });
      expect(q('region-detail')).toBeTruthy();
      expect(q('region-detail')!.textContent).toContain('Northeast');
    });
    it('hides when empty', () => { render({ regions: [] }); expect(q('regions')).toBeFalsy(); });
  });
});
