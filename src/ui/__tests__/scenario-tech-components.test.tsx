/**
 * ScenarioPanel + TechModuleViewer — Tests
 *
 * Uses createRoot + act (from 'react') pattern — no @testing-library/react.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { ScenarioPanel } from '@/ui/ScenarioPanel';
import { TechModuleViewer } from '@/ui/TechModuleViewer';
import { useGameStore } from '@/engine/store';
import type { Root } from 'react-dom/client';
import type { ScenarioScore, TechModuleRegistryState, TechModuleRecord, TechModuleDiscoveryEntry } from '@/data/types/model.types';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => { root.unmount(); });
  container.remove();
  useGameStore.setState({
    gameOver: false,
    gameEndReason: null,
    techModuleRegistry: null,
    eventLog: [],
  } as never);
});

function testId(id: string): HTMLElement | null {
  return container.querySelector(`[data-testid="${id}"]`);
}
function click(el: HTMLElement): void {
  act(() => { el.click(); });
}

// ── Fixtures ─────────────────────────────────────────────────

const SAMPLE_SCORE: ScenarioScore = {
  totalScore: 720,
  dimensions: [
    { dimension: 'stability', rawScore: 75, letterGrade: 'B', weight: 0.2, weightedScore: 15, keyEvents: [] },
    { dimension: 'economy', rawScore: 82, letterGrade: 'A', weight: 0.2, weightedScore: 16.4, keyEvents: [] },
    { dimension: 'military', rawScore: 60, letterGrade: 'C', weight: 0.15, weightedScore: 9, keyEvents: [] },
    { dimension: 'diplomacy', rawScore: 90, letterGrade: 'S', weight: 0.15, weightedScore: 13.5, keyEvents: [] },
    { dimension: 'technology', rawScore: 70, letterGrade: 'B', weight: 0.1, weightedScore: 7, keyEvents: [] },
    { dimension: 'market', rawScore: 65, letterGrade: 'C', weight: 0.1, weightedScore: 6.5, keyEvents: [] },
    { dimension: 'strategic', rawScore: 55, letterGrade: 'C', weight: 0.1, weightedScore: 5.5, keyEvents: [] },
  ],
};

function makeTechModule(techId: string, faction: string, turn: number): TechModuleRecord {
  return {
    techId,
    name: `${techId} Module`,
    domain: 'cyber',
    tier: 2,
    generatedBy: faction,
    generatedOnTurn: turn,
    scenarioId: 'test-scenario',
    actualCostPaid: 500,
    effectiveDurationTurns: 3,
    synergyBonuses: ['adjacent-domain'],
    exportable: true,
  };
}

function makeDiscoveryEntry(techId: string, faction: string, turn: number): TechModuleDiscoveryEntry {
  return {
    techId,
    factionId: faction,
    turnDiscovered: turn,
    actualCost: 500,
    actualDuration: 3,
  };
}

const SAMPLE_REGISTRY: TechModuleRegistryState = {
  modules: {
    'adv-cyber-us': makeTechModule('adv-cyber', 'us', 3),
    'quantum-net-cn': makeTechModule('quantum-net', 'china', 5),
    'stealth-ai-us': makeTechModule('stealth-ai', 'us', 7),
  },
  discoveryLog: [
    makeDiscoveryEntry('adv-cyber', 'us', 3),
    makeDiscoveryEntry('quantum-net', 'china', 5),
    makeDiscoveryEntry('stealth-ai', 'us', 7),
  ],
};

// ═══════════════════════════════════════════════════════════════
// ScenarioPanel
// ═══════════════════════════════════════════════════════════════

describe('ScenarioPanel', () => {
  it('renders the scenario panel container', () => {
    act(() => { root.render(createElement(ScenarioPanel)); });
    expect(testId('scenario-panel')).toBeTruthy();
    expect(container.textContent).toContain('Scenario Analytics');
  });

  it('shows "scoring computed when game ends" message during gameplay', () => {
    useGameStore.setState({ gameOver: false } as never);
    act(() => { root.render(createElement(ScenarioPanel)); });
    expect(container.textContent).toContain('Scenario scoring is computed when the game ends');
  });

  it('shows scoring view with score when game is over', () => {
    useGameStore.setState({ gameOver: true, gameEndReason: 'Time expired' } as never);
    act(() => { root.render(createElement(ScenarioPanel, { scenarioScore: SAMPLE_SCORE })); });
    expect(testId('scoring-view')).toBeTruthy();
    expect(container.textContent).toContain('720');
    expect(container.textContent).toContain('1,000');
  });

  it('renders dimension breakdown rows', () => {
    useGameStore.setState({ gameOver: true, gameEndReason: 'Victory' } as never);
    act(() => { root.render(createElement(ScenarioPanel, { scenarioScore: SAMPLE_SCORE })); });
    expect(testId('dimension-row-stability')).toBeTruthy();
    expect(testId('dimension-row-economy')).toBeTruthy();
    expect(testId('dimension-row-diplomacy')).toBeTruthy();
  });

  it('shows correct letter grades in dimension rows', () => {
    useGameStore.setState({ gameOver: true, gameEndReason: 'Victory' } as never);
    act(() => { root.render(createElement(ScenarioPanel, { scenarioScore: SAMPLE_SCORE })); });
    const diplomacy = testId('dimension-row-diplomacy');
    expect(diplomacy!.textContent).toContain('S');
    const economy = testId('dimension-row-economy');
    expect(economy!.textContent).toContain('A');
  });

  it('switches to history tab when clicked', () => {
    useGameStore.setState({
      currentTurn: 5 as never,
      playerFaction: 'us',
      eventLog: [{ turn: 1, description: 'Test event' }] as never,
    });
    act(() => { root.render(createElement(ScenarioPanel)); });
    click(testId('scenario-tab-history')!);
    expect(testId('history-view')).toBeTruthy();
    expect(container.textContent).toContain('Event Timeline');
  });

  it('switches to export tab when clicked', () => {
    act(() => { root.render(createElement(ScenarioPanel)); });
    click(testId('scenario-tab-export')!);
    expect(testId('export-view')).toBeTruthy();
    expect(testId('export-btn-json')).toBeTruthy();
    expect(testId('export-btn-csv')).toBeTruthy();
    expect(testId('export-btn-html')).toBeTruthy();
  });

  it('shows game-over reason when score not available', () => {
    useGameStore.setState({ gameOver: true, gameEndReason: 'Nuclear war' } as never);
    act(() => { root.render(createElement(ScenarioPanel)); });
    expect(container.textContent).toContain('Nuclear war');
  });

  it('renders export buttons that are clickable', () => {
    act(() => { root.render(createElement(ScenarioPanel)); });
    click(testId('scenario-tab-export')!);
    const jsonBtn = testId('export-btn-json') as HTMLButtonElement;
    expect(jsonBtn.disabled).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// TechModuleViewer
// ═══════════════════════════════════════════════════════════════

describe('TechModuleViewer', () => {
  it('renders placeholder when no tech modules exist', () => {
    act(() => { root.render(createElement(TechModuleViewer)); });
    expect(testId('tech-module-viewer')).toBeTruthy();
    expect(container.textContent).toContain('No tech modules generated yet');
  });

  it('renders module list when registry has modules', () => {
    useGameStore.setState({ techModuleRegistry: SAMPLE_REGISTRY } as never);
    act(() => { root.render(createElement(TechModuleViewer)); });
    expect(testId('module-row-adv-cyber-us')).toBeTruthy();
    expect(testId('module-row-quantum-net-china')).toBeTruthy();
    expect(testId('module-row-stealth-ai-us')).toBeTruthy();
  });

  it('shows correct module count', () => {
    useGameStore.setState({ techModuleRegistry: SAMPLE_REGISTRY } as never);
    act(() => { root.render(createElement(TechModuleViewer)); });
    expect(container.textContent).toContain('Modules (3)');
  });

  it('shows leaderboard with faction counts', () => {
    useGameStore.setState({ techModuleRegistry: SAMPLE_REGISTRY } as never);
    act(() => { root.render(createElement(TechModuleViewer)); });
    expect(testId('leader-all')).toBeTruthy();
    expect(testId('leader-all')!.textContent).toContain('All (3)');
    expect(testId('leader-us')).toBeTruthy();
    expect(testId('leader-us')!.textContent).toContain('US (2)');
    expect(testId('leader-china')).toBeTruthy();
    expect(testId('leader-china')!.textContent).toContain('CHINA (1)');
  });

  it('filters modules by faction when leaderboard button is clicked', () => {
    useGameStore.setState({ techModuleRegistry: SAMPLE_REGISTRY } as never);
    act(() => { root.render(createElement(TechModuleViewer)); });
    click(testId('leader-china')!);
    // Only china module should be visible
    expect(testId('module-row-quantum-net-china')).toBeTruthy();
    expect(testId('module-row-adv-cyber-us')).toBeNull();
    expect(container.textContent).toContain('Modules (1)');
  });

  it('shows module detail when a module row is clicked', () => {
    useGameStore.setState({ techModuleRegistry: SAMPLE_REGISTRY } as never);
    act(() => { root.render(createElement(TechModuleViewer)); });
    click(testId('module-row-adv-cyber-us')!);
    expect(testId('module-detail-adv-cyber')).toBeTruthy();
    expect(container.textContent).toContain('$500');
    expect(container.textContent).toContain('3 turns');
    expect(container.textContent).toContain('adjacent-domain');
  });

  it('hides module detail when same row is clicked again', () => {
    useGameStore.setState({ techModuleRegistry: SAMPLE_REGISTRY } as never);
    act(() => { root.render(createElement(TechModuleViewer)); });
    click(testId('module-row-adv-cyber-us')!);
    expect(testId('module-detail-adv-cyber')).toBeTruthy();
    click(testId('module-row-adv-cyber-us')!);
    expect(testId('module-detail-adv-cyber')).toBeNull();
  });

  it('renders discovery log entries', () => {
    useGameStore.setState({ techModuleRegistry: SAMPLE_REGISTRY } as never);
    act(() => { root.render(createElement(TechModuleViewer)); });
    expect(testId('discovery-log-0')).toBeTruthy();
    expect(container.textContent).toContain('Discovery Log (3 entries)');
  });

  it('has an export all button', () => {
    useGameStore.setState({ techModuleRegistry: SAMPLE_REGISTRY } as never);
    act(() => { root.render(createElement(TechModuleViewer)); });
    expect(testId('export-all-modules-btn')).toBeTruthy();
  });

  it('shows "All" filter resets the list', () => {
    useGameStore.setState({ techModuleRegistry: SAMPLE_REGISTRY } as never);
    act(() => { root.render(createElement(TechModuleViewer)); });
    click(testId('leader-china')!);
    expect(container.textContent).toContain('Modules (1)');
    click(testId('leader-all')!);
    expect(container.textContent).toContain('Modules (3)');
  });
});
