/**
 * CNFL-3804 — ModuleDetailView · Component Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

import { ModuleDetailView } from '@/ui/ModuleDetailView';
import type { ModuleDetailViewProps, ModuleRelationship, UsageStat } from '@/ui/ModuleDetailView';
import type { Root } from 'react-dom/client';

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
});

const LEADER_DATA: Record<string, unknown> = {
  name: 'Napoleon Bonaparte',
  description: 'French emperor and military commander',
  riskTolerance: 80,
  charisma: 90,
  patience: 30,
  empathy: 20,
  psychology: { narcissism: 85, pragmatism: 70, paranoia: 60 },
};

const MILITARY_DATA: Record<string, unknown> = {
  name: 'M1A2 Abrams',
  description: 'American main battle tank',
  attackPower: 80,
  defensePower: 85,
  range: 4,
  speed: 3,
  stealthRating: 5,
  category: 'ground',
};

const RELATIONSHIPS: ModuleRelationship[] = [
  { targetType: 'military', targetId: 'grand-army', targetName: 'Grand Army', relationship: 'commands' },
  { targetType: 'political-systems', targetId: 'empire', targetName: 'French Empire', relationship: 'governs' },
];

const USAGE: UsageStat[] = [
  { scenarioId: 'ww-alt', scenarioName: 'Alternate WW Scenario' },
  { scenarioId: 'europe-1805', scenarioName: 'Europe 1805' },
];

function render(props?: Partial<ModuleDetailViewProps>): void {
  const defaults: ModuleDetailViewProps = {
    moduleType: 'leaders',
    moduleId: 'napoleon',
    data: LEADER_DATA,
    ...props,
  };
  act(() => { root.render(createElement(ModuleDetailView, defaults)); });
}

function testId(id: string): HTMLElement | null {
  return container.querySelector(`[data-testid="${id}"]`);
}

function click(el: HTMLElement): void {
  act(() => { el.click(); });
}

describe('ModuleDetailView', () => {
  describe('rendering', () => {
    it('renders the detail root', () => {
      render();
      expect(testId('module-detail')).not.toBeNull();
    });

    it('shows module name', () => {
      render();
      expect(container.textContent).toContain('Napoleon Bonaparte');
    });

    it('shows module type and id subtitle', () => {
      render();
      expect(container.textContent).toContain('leaders');
      expect(container.textContent).toContain('napoleon');
    });

    it('shows description', () => {
      render();
      expect(container.textContent).toContain('French emperor and military commander');
    });

    it('shows edit button when onEdit provided', () => {
      render({ onEdit: vi.fn() });
      expect(testId('edit-btn')).not.toBeNull();
    });

    it('shows preview button when onPreviewInGame provided', () => {
      render({ onPreviewInGame: vi.fn() });
      expect(testId('preview-btn')).not.toBeNull();
    });

    it('hides edit button when onEdit not provided', () => {
      render();
      expect(testId('edit-btn')).toBeNull();
    });
  });

  describe('tabs', () => {
    it('renders all four tabs', () => {
      render();
      expect(testId('detail-tabs')).not.toBeNull();
      expect(testId('tab-fields')).not.toBeNull();
      expect(testId('tab-relationships')).not.toBeNull();
      expect(testId('tab-usage')).not.toBeNull();
      expect(testId('tab-json')).not.toBeNull();
    });

    it('fields tab is active by default', () => {
      render();
      expect(testId('fields-tab')).not.toBeNull();
    });

    it('shows relationship count badge', () => {
      render({ relationships: RELATIONSHIPS });
      expect(testId('tab-relationships')!.textContent).toContain('(2)');
    });

    it('shows usage count badge', () => {
      render({ usage: USAGE });
      expect(testId('tab-usage')!.textContent).toContain('(2)');
    });
  });

  describe('fields tab', () => {
    it('displays field labels and values', () => {
      render();
      const fieldsTab = testId('fields-tab')!;
      expect(fieldsTab.textContent).toContain('name');
      expect(fieldsTab.textContent).toContain('Napoleon Bonaparte');
    });

    it('displays nested objects as JSON', () => {
      render();
      const fieldsTab = testId('fields-tab')!;
      expect(fieldsTab.textContent).toContain('psychology');
      expect(fieldsTab.textContent).toContain('narcissism');
    });

    it('skips underscore-prefixed fields', () => {
      render({ data: { ...LEADER_DATA, _internal: 'hidden' } });
      const fieldsTab = testId('fields-tab')!;
      expect(fieldsTab.textContent).not.toContain('_internal');
    });
  });

  describe('relationships tab', () => {
    it('shows relationships when present', () => {
      render({ relationships: RELATIONSHIPS });
      click(testId('tab-relationships')!);
      const tab = testId('relationships-tab')!;
      expect(tab.textContent).toContain('Grand Army');
      expect(tab.textContent).toContain('commands');
      expect(tab.textContent).toContain('French Empire');
    });

    it('shows empty message when no relationships', () => {
      render({ relationships: [] });
      click(testId('tab-relationships')!);
      expect(testId('relationships-tab')!.textContent).toContain('No relationships found');
    });

    it('calls onNavigateTo when relationship clicked', () => {
      const onNav = vi.fn();
      render({ relationships: RELATIONSHIPS, onNavigateTo: onNav });
      click(testId('tab-relationships')!);
      // Click on the link text (Grand Army)
      const links = testId('relationships-tab')!.querySelectorAll('[style*="cursor: pointer"]');
      click(links[0] as HTMLElement);
      expect(onNav).toHaveBeenCalledWith('military', 'grand-army');
    });
  });

  describe('usage tab', () => {
    it('shows usage scenarios', () => {
      render({ usage: USAGE });
      click(testId('tab-usage')!);
      const tab = testId('usage-tab')!;
      expect(tab.textContent).toContain('Alternate WW Scenario');
      expect(tab.textContent).toContain('Europe 1805');
    });

    it('shows empty message when no usage', () => {
      render({ usage: [] });
      click(testId('tab-usage')!);
      expect(testId('usage-tab')!.textContent).toContain('Not used in any scenarios');
    });

    it('calls onNavigateTo for scenario link', () => {
      const onNav = vi.fn();
      render({ usage: USAGE, onNavigateTo: onNav });
      click(testId('tab-usage')!);
      const links = testId('usage-tab')!.querySelectorAll('[style*="cursor: pointer"]');
      click(links[0] as HTMLElement);
      expect(onNav).toHaveBeenCalledWith('scenarios', 'ww-alt');
    });
  });

  describe('json tab', () => {
    it('shows JSON data', () => {
      render();
      click(testId('tab-json')!);
      const tab = testId('json-tab')!;
      expect(tab.textContent).toContain('Napoleon Bonaparte');
      expect(tab.textContent).toContain('riskTolerance');
    });
  });

  describe('stat bars', () => {
    it('shows stat bars for leaders with matching fields', () => {
      render();
      expect(testId('stat-bars')).not.toBeNull();
    });

    it('shows stat bars for military data', () => {
      render({ moduleType: 'military', moduleId: 'abrams', data: MILITARY_DATA });
      expect(testId('stat-bars')).not.toBeNull();
    });

    it('does not show stat bars for types without stat config', () => {
      render({ moduleType: 'technology', moduleId: 'quantum', data: { name: 'Quantum' } });
      expect(testId('stat-bars')).toBeNull();
    });

    it('stat bars display field names and values', () => {
      render({ moduleType: 'military', moduleId: 'abrams', data: MILITARY_DATA });
      const bars = testId('stat-bars')!;
      expect(bars.textContent).toContain('attack');
      expect(bars.textContent).toContain('80');
      expect(bars.textContent).toContain('defense');
      expect(bars.textContent).toContain('85');
    });
  });

  describe('actions', () => {
    it('calls onEdit when edit button clicked', () => {
      const onEdit = vi.fn();
      render({ onEdit });
      click(testId('edit-btn')!);
      expect(onEdit).toHaveBeenCalled();
    });

    it('calls onPreviewInGame when preview button clicked', () => {
      const onPreview = vi.fn();
      render({ onPreviewInGame: onPreview });
      click(testId('preview-btn')!);
      expect(onPreview).toHaveBeenCalled();
    });
  });

  describe('fallback name', () => {
    it('uses moduleId when no name in data', () => {
      render({ data: { power: 50 } });
      expect(container.textContent).toContain('napoleon');
    });

    it('uses leaderId when present', () => {
      render({ data: { leaderId: 'gen-patton', power: 70 } });
      expect(container.textContent).toContain('gen-patton');
    });
  });
});
