/**
 * Tests for EducationDashboard — CNFL-3402
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act, createElement } from 'react';
import {
  EducationDashboard,
  type EducationDashboardProps,
  type EducationSector,
  type EducationMetrics,
  type NationEducationLevel,
  type AdvisorRecommendation,
  type ProjectedEffect,
} from './EducationDashboard';

let container: HTMLDivElement;
let root: Root;

function mkSector(overrides: Partial<EducationSector> = {}): EducationSector {
  return {
    sectorId: 'primary',
    name: 'Primary Education',
    currentBudget: 50,
    maxBudget: 200,
    qualityIndex: 65,
    enrollmentRate: 92,
    impactDelay: 3,
    ...overrides,
  };
}

function mkMetrics(overrides: Partial<EducationMetrics> = {}): EducationMetrics {
  return { literacyRate: 88, averageQuality: 72, stemIndex: 60, brainDrainRate: 25, totalBudget: 120, gdpPercent: 5.5, ...overrides };
}

function mkNation(overrides: Partial<NationEducationLevel> = {}): NationEducationLevel {
  return { nationId: 'us', nationName: 'United States', literacyRate: 99, qualityIndex: 80, stemIndex: 75, ...overrides };
}

function mkRec(overrides: Partial<AdvisorRecommendation> = {}): AdvisorRecommendation {
  return { id: 'rec-1', text: 'Increase STEM funding', priority: 'high', ...overrides };
}

function mkEffect(overrides: Partial<ProjectedEffect> = {}): ProjectedEffect {
  return { turn: 5, literacyRate: 90, qualityIndex: 75, ...overrides };
}

function render(props: Partial<EducationDashboardProps> = {}) {
  const all: EducationDashboardProps = {
    sectors: [mkSector(), mkSector({ sectorId: 'secondary', name: 'Secondary Education', qualityIndex: 58 })],
    metrics: mkMetrics(),
    nationComparison: [mkNation()],
    recommendations: [mkRec()],
    projectedEffects: [mkEffect(), mkEffect({ turn: 10, literacyRate: 93, qualityIndex: 80 })],
    ...props,
  };
  act(() => { root.render(createElement(EducationDashboard, all)); });
}

const q = (id: string) => container.querySelector(`[data-testid="${id}"]`);

beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });

describe('EducationDashboard', () => {
  describe('rendering', () => {
    it('renders the main panel', () => { render(); expect(q('education-dashboard')).toBeTruthy(); });
    it('shows metric cards', () => { render(); expect(q('metrics-row')).toBeTruthy(); expect(q('metrics-row')!.textContent).toContain('88%'); });
    it('shows brain drain indicator', () => { render(); expect(q('brain-drain')).toBeTruthy(); expect(q('brain-drain')!.textContent).toContain('25%'); expect(q('brain-drain')!.textContent).toContain('Low'); });
    it('shows STEM index', () => { render(); expect(q('metrics-row')!.textContent).toContain('60%'); });
    it('shows budget and GDP', () => { render(); expect(q('metrics-row')!.textContent).toContain('$120B'); expect(q('metrics-row')!.textContent).toContain('5.5% GDP'); });
  });

  describe('brain drain severity', () => {
    it('shows Critical for high brain drain', () => {
      render({ metrics: mkMetrics({ brainDrainRate: 70 }) });
      expect(q('brain-drain')!.textContent).toContain('Critical');
    });
    it('shows Moderate for medium brain drain', () => {
      render({ metrics: mkMetrics({ brainDrainRate: 45 }) });
      expect(q('brain-drain')!.textContent).toContain('Moderate');
    });
  });

  describe('sectors', () => {
    it('renders sector cards', () => { render(); expect(q('sector-primary')).toBeTruthy(); expect(q('sector-secondary')).toBeTruthy(); });
    it('shows sector name and quality', () => { render(); expect(q('sector-primary')!.textContent).toContain('Primary Education'); expect(q('sector-primary')!.textContent).toContain('65%'); });
    it('expands sector on click', () => {
      render({ onBudgetChange: vi.fn() });
      expect(q('sector-detail-primary')).toBeFalsy();
      act(() => { (q('sector-primary')!.querySelector('div') as HTMLElement).click(); });
      expect(q('sector-detail-primary')).toBeTruthy();
    });
    it('shows slider when expanded and handler provided', () => {
      render({ onBudgetChange: vi.fn() });
      act(() => { (q('sector-primary')!.querySelector('div') as HTMLElement).click(); });
      expect(q('slider-primary')).toBeTruthy();
    });
  });

  describe('projected effects', () => {
    it('renders projected effects', () => { render(); expect(q('projected-effects')).toBeTruthy(); });
    it('shows turn data', () => { render(); expect(q('proj-turn-5')).toBeTruthy(); expect(q('proj-turn-5')!.textContent).toContain('90%'); });
    it('hides when empty', () => { render({ projectedEffects: [] }); expect(q('projected-effects')).toBeFalsy(); });
  });

  describe('recommendations', () => {
    it('renders recommendations', () => { render(); expect(q('recommendations')).toBeTruthy(); });
    it('shows recommendation text and priority', () => { render(); expect(q('rec-rec-1')!.textContent).toContain('Increase STEM funding'); expect(q('rec-rec-1')!.textContent).toContain('high'); });
    it('hides when empty', () => { render({ recommendations: [] }); expect(q('recommendations')).toBeFalsy(); });
  });

  describe('nation comparison', () => {
    it('renders nation comparison', () => { render(); expect(q('nation-comparison')).toBeTruthy(); });
    it('shows nation stats', () => { render(); expect(q('nation-us')!.textContent).toContain('United States'); expect(q('nation-us')!.textContent).toContain('99%'); });
    it('hides when empty', () => { render({ nationComparison: [] }); expect(q('nation-comparison')).toBeFalsy(); });
  });
});
