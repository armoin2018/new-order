/**
 * CNFL-3800 — ModuleBrowser · Component Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

import { ModuleBrowser } from '@/ui/ModuleBrowser';
import type { ModuleBrowserProps, ModuleSummary } from '@/ui/ModuleBrowser';
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

function render(props?: Partial<ModuleBrowserProps>): void {
  const defaults: ModuleBrowserProps = { modules: SAMPLE, ...props };
  act(() => { root.render(createElement(ModuleBrowser, defaults)); });
}

function testId(id: string): HTMLElement | null {
  return container.querySelector(`[data-testid="${id}"]`);
}

function click(el: HTMLElement): void {
  act(() => { el.click(); });
}

function setInputValue(el: HTMLInputElement, val: string): void {
  act(() => {
    const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    nativeSet.call(el, val);
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function setSelectValue(el: HTMLSelectElement, val: string): void {
  act(() => {
    const nativeSet = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!;
    nativeSet.call(el, val);
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

const SAMPLE: ModuleSummary[] = [
  { id: 'washington', name: 'George Washington', moduleType: 'leaders', description: 'First president', tags: ['usa', 'historic'] },
  { id: 'napoleon', name: 'Napoleon Bonaparte', moduleType: 'leaders', description: 'French emperor', tags: ['france'] },
  { id: 'm1a2', name: 'M1A2 Abrams', moduleType: 'military', subcategory: 'ground', description: 'Main battle tank', tags: ['ground'] },
  { id: 'democracy', name: 'Democracy', moduleType: 'political-systems', description: 'Democratic government' },
  { id: 'quantum', name: 'Quantum Computing', moduleType: 'technology', description: 'Advanced tech', tags: ['advanced'] },
];

describe('ModuleBrowser', () => {
  describe('rendering', () => {
    it('renders the browser root', () => {
      render();
      expect(testId('module-browser')).not.toBeNull();
    });

    it('shows Module Builder title', () => {
      render();
      expect(container.textContent).toContain('Module Builder');
    });

    it('renders type tabs including all', () => {
      render();
      expect(testId('type-tabs')).not.toBeNull();
      expect(testId('tab-all')).not.toBeNull();
      expect(testId('tab-leaders')).not.toBeNull();
      expect(testId('tab-military')).not.toBeNull();
      expect(testId('tab-technology')).not.toBeNull();
    });

    it('shows toolbar with search, sort, view toggle', () => {
      render();
      expect(testId('toolbar')).not.toBeNull();
      expect(testId('search-input')).not.toBeNull();
      expect(testId('sort-select')).not.toBeNull();
      expect(testId('view-grid')).not.toBeNull();
      expect(testId('view-list')).not.toBeNull();
    });

    it('renders all modules in grid view by default', () => {
      render();
      expect(testId('grid-view')).not.toBeNull();
      expect(testId('card-washington')).not.toBeNull();
      expect(testId('card-napoleon')).not.toBeNull();
      expect(testId('card-m1a2')).not.toBeNull();
    });

    it('shows module count badges', () => {
      render();
      // "All" tab should show the total count
      const allTab = testId('tab-all')!;
      expect(allTab.textContent).toContain('5');
    });
  });

  describe('type tabs', () => {
    it('filters by type when tab clicked', () => {
      render();
      click(testId('tab-leaders')!);
      expect(testId('card-washington')).not.toBeNull();
      expect(testId('card-napoleon')).not.toBeNull();
      expect(testId('card-m1a2')).toBeNull();
    });

    it('returns to all on "All" tab click', () => {
      render();
      click(testId('tab-leaders')!);
      expect(testId('card-m1a2')).toBeNull();
      click(testId('tab-all')!);
      expect(testId('card-m1a2')).not.toBeNull();
    });

    it('shows create button when specific tab selected', () => {
      const onCreate = vi.fn();
      render({ onCreateModule: onCreate });
      expect(testId('create-btn')).toBeNull(); // "all" tab — no create
      click(testId('tab-leaders')!);
      expect(testId('create-btn')).not.toBeNull();
    });

    it('create button calls onCreateModule with type', () => {
      const onCreate = vi.fn();
      render({ onCreateModule: onCreate });
      click(testId('tab-military')!);
      click(testId('create-btn')!);
      expect(onCreate).toHaveBeenCalledWith('military');
    });
  });

  describe('search', () => {
    it('filters modules by search text', async () => {
      vi.useFakeTimers();
      render();
      setInputValue(testId('search-input') as HTMLInputElement, 'Napoleon');
      act(() => { vi.advanceTimersByTime(300); }); // debounce
      expect(testId('card-napoleon')).not.toBeNull();
      expect(testId('card-washington')).toBeNull();
      vi.useRealTimers();
    });

    it('searches descriptions', async () => {
      vi.useFakeTimers();
      render();
      setInputValue(testId('search-input') as HTMLInputElement, 'battle tank');
      act(() => { vi.advanceTimersByTime(300); });
      expect(testId('card-m1a2')).not.toBeNull();
      expect(testId('card-napoleon')).toBeNull();
      vi.useRealTimers();
    });

    it('searches tags', async () => {
      vi.useFakeTimers();
      render();
      setInputValue(testId('search-input') as HTMLInputElement, 'advanced');
      act(() => { vi.advanceTimersByTime(300); });
      expect(testId('card-quantum')).not.toBeNull();
      expect(testId('card-m1a2')).toBeNull();
      vi.useRealTimers();
    });

    it('shows empty state when no results', async () => {
      vi.useFakeTimers();
      render();
      setInputValue(testId('search-input') as HTMLInputElement, 'zzzznoexist');
      act(() => { vi.advanceTimersByTime(300); });
      expect(testId('empty-state')).not.toBeNull();
      vi.useRealTimers();
    });
  });

  describe('view mode toggle', () => {
    it('switches to list view', () => {
      render();
      click(testId('view-list')!);
      expect(testId('list-view')).not.toBeNull();
      expect(testId('grid-view')).toBeNull();
    });

    it('switches back to grid view', () => {
      render();
      click(testId('view-list')!);
      expect(testId('list-view')).not.toBeNull();
      click(testId('view-grid')!);
      expect(testId('grid-view')).not.toBeNull();
    });

    it('list view shows module rows', () => {
      render();
      click(testId('view-list')!);
      expect(testId('row-washington')).not.toBeNull();
      expect(testId('row-napoleon')).not.toBeNull();
    });
  });

  describe('sorting', () => {
    it('sort direction toggles', () => {
      render();
      const btn = testId('sort-dir')!;
      expect(btn.textContent).toContain('↑'); // default asc
      click(btn);
      expect(btn.textContent).toContain('↓');
    });

    it('can change sort key', () => {
      render();
      setSelectValue(testId('sort-select') as HTMLSelectElement, 'moduleType');
      // Should still render without error
      expect(testId('grid-view')).not.toBeNull();
    });
  });

  describe('actions', () => {
    it('calls onSelectModule when card clicked', () => {
      const onSelect = vi.fn();
      render({ onSelectModule: onSelect });
      click(testId('card-washington')!);
      expect(onSelect).toHaveBeenCalledWith('leaders', 'washington');
    });

    it('calls onCloneModule on clone button', () => {
      const onClone = vi.fn();
      render({ onCloneModule: onClone });
      click(testId('clone-washington')!);
      expect(onClone).toHaveBeenCalledWith('leaders', 'washington');
    });

    it('calls onDeleteModule on delete button', () => {
      const onDelete = vi.fn();
      render({ onDeleteModule: onDelete });
      click(testId('delete-washington')!);
      expect(onDelete).toHaveBeenCalledWith('leaders', 'washington');
    });

    it('clone button uses stopPropagation (onSelect not called)', () => {
      const onSelect = vi.fn();
      const onClone = vi.fn();
      render({ onSelectModule: onSelect, onCloneModule: onClone });
      click(testId('clone-washington')!);
      expect(onClone).toHaveBeenCalled();
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('calls onSelectModule when list row clicked', () => {
      const onSelect = vi.fn();
      render({ onSelectModule: onSelect });
      click(testId('view-list')!);
      click(testId('row-napoleon')!);
      expect(onSelect).toHaveBeenCalledWith('leaders', 'napoleon');
    });
  });

  describe('empty state', () => {
    it('renders empty state with no modules', () => {
      render({ modules: [] });
      expect(testId('empty-state')).not.toBeNull();
      expect(container.textContent).toContain('No modules found');
    });
  });

  describe('moduleCounts prop', () => {
    it('uses provided counts for badges', () => {
      render({ moduleCounts: { leaders: 42, military: 7 } });
      const leaderTab = testId('tab-leaders')!;
      expect(leaderTab.textContent).toContain('42');
    });
  });

  describe('pagination', () => {
    it('shows pagination when modules exceed page size', () => {
      // create 25 modules to exceed PAGE_SIZE=20
      const mods: ModuleSummary[] = Array.from({ length: 25 }, (_, i) => ({
        id: `mod-${i}`,
        name: `Module ${i}`,
        moduleType: 'leaders',
      }));
      render({ modules: mods });
      expect(testId('pagination')).not.toBeNull();
    });

    it('does not show pagination with few modules', () => {
      render();
      expect(testId('pagination')).toBeNull(); // only 5 modules
    });
  });
});
