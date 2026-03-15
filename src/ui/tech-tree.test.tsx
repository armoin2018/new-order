/**
 * Tests for TechTree — CNFL-3304
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act, createElement } from 'react';
import { TechTree, type TechTreeProps, type TechNode, type ResearchQueueItem, type NationTechLevel, type TechDomain } from './TechTree';

let container: HTMLDivElement;
let root: Root;

function mkTech(overrides: Partial<TechNode> = {}): TechNode {
  return {
    techId: 'tech-1',
    name: 'Quantum Computing',
    domain: 'cyber',
    tier: 2,
    description: 'Advanced quantum computing research.',
    prerequisites: [],
    researchCost: 100,
    turnsToComplete: 5,
    currentProgress: 0,
    status: 'available',
    effects: ['+10% cyber defense'],
    ...overrides,
  };
}

function mkQueue(overrides: Partial<ResearchQueueItem> = {}): ResearchQueueItem {
  return { techId: 'tech-q1', name: 'AI Core', priority: 1, estimatedTurns: 3, ...overrides };
}

function mkNation(overrides: Partial<NationTechLevel> = {}): NationTechLevel {
  return { nationId: 'us', nationName: 'United States', techCount: 15, averageTier: 3.2, leadingDomain: 'cyber', ...overrides };
}

const defaultTechs: TechNode[] = [
  mkTech(),
  mkTech({ techId: 'tech-2', name: 'Stealth Drones', domain: 'military', tier: 3, status: 'researching', currentProgress: 40 }),
  mkTech({ techId: 'tech-3', name: 'Fusion Reactor', domain: 'energy', tier: 4, status: 'locked' }),
  mkTech({ techId: 'tech-4', name: 'Neural Interface', domain: 'ai', tier: 1, status: 'completed' }),
];

function render(props: Partial<TechTreeProps> = {}) {
  const all: TechTreeProps = {
    technologies: defaultTechs,
    researchQueue: [mkQueue()],
    researchBudget: 50,
    maxBudget: 200,
    nationComparison: [mkNation()],
    ...props,
  };
  act(() => { root.render(createElement(TechTree, all)); });
}

const q = (id: string) => container.querySelector(`[data-testid="${id}"]`);

beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });

describe('TechTree', () => {
  describe('rendering', () => {
    it('renders the main panel', () => { render(); expect(q('tech-tree')).toBeTruthy(); });
    it('shows stats bar', () => { render(); expect(q('stats-bar')).toBeTruthy(); expect(q('stats-bar')!.textContent).toContain('1'); /* 1 completed */ });
    it('shows domain filter buttons', () => { render(); expect(q('domain-filter')).toBeTruthy(); expect(q('domain-all')).toBeTruthy(); });
    it('shows tech nodes', () => { render(); expect(q('tech-tech-1')).toBeTruthy(); expect(q('tech-tech-2')).toBeTruthy(); });
    it('groups by tier', () => { render(); expect(q('tier-1')).toBeTruthy(); expect(q('tier-2')).toBeTruthy(); });
    it('shows progress bar for researching tech', () => { render(); expect(q('progress-tech-2')).toBeTruthy(); });
    it('dims locked techs', () => {
      render();
      const locked = q('tech-tech-3') as HTMLElement;
      expect(locked.style.opacity).toBe('0.45');
    });
  });

  describe('domain filter', () => {
    it('filters by domain', () => {
      render();
      act(() => { (q('domain-military') as HTMLButtonElement).click(); });
      expect(q('tech-tech-2')).toBeTruthy();
      expect(q('tech-tech-1')).toBeFalsy(); // cyber, not military
    });
    it('shows all when all clicked', () => {
      render();
      act(() => { (q('domain-military') as HTMLButtonElement).click(); });
      act(() => { (q('domain-all') as HTMLButtonElement).click(); });
      expect(q('tech-tech-1')).toBeTruthy();
      expect(q('tech-tech-2')).toBeTruthy();
    });
  });

  describe('detail panel', () => {
    it('shows detail when tech clicked', () => {
      render();
      act(() => { (q('tech-tech-1') as HTMLElement).click(); });
      expect(q('tech-detail')).toBeTruthy();
      expect(q('tech-detail')!.textContent).toContain('Quantum Computing');
    });
    it('shows effects list', () => {
      render();
      act(() => { (q('tech-tech-1') as HTMLElement).click(); });
      expect(q('tech-detail')!.textContent).toContain('+10% cyber defense');
    });
    it('shows start research button for available tech', () => {
      const fn = vi.fn();
      render({ onStartResearch: fn });
      act(() => { (q('tech-tech-1') as HTMLElement).click(); });
      expect(q('btn-start-research')).toBeTruthy();
      act(() => { (q('btn-start-research') as HTMLButtonElement).click(); });
      expect(fn).toHaveBeenCalledWith('tech-1');
    });
    it('shows cancel button for researching tech', () => {
      const fn = vi.fn();
      render({ onCancelResearch: fn });
      act(() => { (q('tech-tech-2') as HTMLElement).click(); });
      expect(q('btn-cancel-research')).toBeTruthy();
      act(() => { (q('btn-cancel-research') as HTMLButtonElement).click(); });
      expect(fn).toHaveBeenCalledWith('tech-2');
    });
  });

  describe('budget slider', () => {
    it('renders budget slider when handler provided', () => {
      render({ onBudgetChange: vi.fn() });
      expect(q('budget-slider')).toBeTruthy();
    });
    it('hides slider when no handler', () => {
      render({ onBudgetChange: undefined });
      expect(q('budget-slider')).toBeFalsy();
    });
  });

  describe('research queue', () => {
    it('shows queue items', () => { render(); expect(q('queue-tech-q1')).toBeTruthy(); expect(q('queue-tech-q1')!.textContent).toContain('AI Core'); });
    it('shows empty state', () => { render({ researchQueue: [] }); expect(container.textContent).toContain('Queue is empty'); });
  });

  describe('nation comparison', () => {
    it('shows nation comparison', () => { render(); expect(q('nation-comparison')).toBeTruthy(); });
    it('shows nation name and stats', () => { render(); expect(q('nation-us')!.textContent).toContain('United States'); expect(q('nation-us')!.textContent).toContain('15 techs'); });
    it('hides section when empty', () => { render({ nationComparison: [] }); expect(q('nation-comparison')).toBeFalsy(); });
  });
});
