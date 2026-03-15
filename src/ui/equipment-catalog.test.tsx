/**
 * CNFL-3205 — EquipmentCatalog · Component Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

import { EquipmentCatalog } from '@/ui/EquipmentCatalog';
import type { EquipmentItem, EquipmentCatalogProps } from '@/ui/EquipmentCatalog';
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

function render(props?: Partial<EquipmentCatalogProps>): void {
  const defaults: EquipmentCatalogProps = { items: SAMPLE_ITEMS, ...props };
  act(() => { root.render(createElement(EquipmentCatalog, defaults)); });
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

const SAMPLE_ITEMS: EquipmentItem[] = [
  { equipmentId: 'm1a2-abrams', name: 'M1A2 Abrams', category: 'ground', subcategory: 'mbt', nation: 'USA', description: 'American main battle tank', purchaseCost: 35, maintenanceCostPerTurn: 4, attackPower: 80, defensePower: 85, range: 4, speed: 3, stealthRating: 5, buildTime: 4, tags: ['mbt', 'heavy-armor'] },
  { equipmentId: 't-14-armata', name: 'T-14 Armata', category: 'ground', subcategory: 'mbt', nation: 'Russia', description: 'Russian next-gen tank', purchaseCost: 25, maintenanceCostPerTurn: 3, attackPower: 75, defensePower: 80, range: 4, speed: 4, stealthRating: 10, buildTime: 5, tags: ['mbt', 'unmanned-turret'] },
  { equipmentId: 'f-35a', name: 'F-35A Lightning II', category: 'air', subcategory: 'fighter', nation: 'USA', description: 'Stealth multirole fighter', purchaseCost: 50, maintenanceCostPerTurn: 6, attackPower: 70, defensePower: 60, range: 8, speed: 9, stealthRating: 90, buildTime: 6, tags: ['stealth', 'multirole'] },
];

describe('EquipmentCatalog', () => {
  describe('rendering', () => {
    it('renders the catalog panel', () => {
      render();
      expect(testId('equipment-catalog')).not.toBeNull();
    });

    it('shows title', () => {
      render();
      expect(container.textContent).toContain('Military Equipment Catalog');
    });

    it('renders all equipment items', () => {
      render();
      expect(testId('item-m1a2-abrams')).not.toBeNull();
      expect(testId('item-t-14-armata')).not.toBeNull();
      expect(testId('item-f-35a')).not.toBeNull();
    });

    it('shows result count', () => {
      render();
      expect(testId('result-count')!.textContent).toContain('3');
    });

    it('shows filter bar', () => {
      render();
      expect(testId('filter-bar')).not.toBeNull();
      expect(testId('input-search')).not.toBeNull();
      expect(testId('select-category')).not.toBeNull();
      expect(testId('select-sort')).not.toBeNull();
    });

    it('shows grid and list view buttons', () => {
      render();
      expect(testId('view-grid')).not.toBeNull();
      expect(testId('view-list')).not.toBeNull();
    });
  });

  describe('filtering', () => {
    it('filters by search text', () => {
      render();
      setInputValue(testId('input-search') as HTMLInputElement, 'Abrams');
      expect(testId('item-m1a2-abrams')).not.toBeNull();
      expect(testId('item-f-35a')).toBeNull();
    });

    it('shows updated count after filter', () => {
      render();
      setInputValue(testId('input-search') as HTMLInputElement, 'Abrams');
      expect(testId('result-count')!.textContent).toContain('1');
    });
  });

  describe('comparison', () => {
    it('shows compare button on items', () => {
      render();
      expect(testId('compare-m1a2-abrams')).not.toBeNull();
    });

    it('shows comparison panel when 2+ items compared', () => {
      render();
      click(testId('compare-m1a2-abrams')!);
      expect(testId('comparison-panel')).toBeNull(); // Only 1 selected
      click(testId('compare-t-14-armata')!);
      expect(testId('comparison-panel')).not.toBeNull();
    });

    it('comparison panel shows item names', () => {
      render();
      click(testId('compare-m1a2-abrams')!);
      click(testId('compare-t-14-armata')!);
      const panel = testId('comparison-panel')!;
      expect(panel.textContent).toContain('M1A2 Abrams');
      expect(panel.textContent).toContain('T-14 Armata');
    });
  });

  describe('detail panel', () => {
    it('shows detail panel on item click', () => {
      render();
      click(testId('item-m1a2-abrams')!);
      expect(testId('detail-panel')).not.toBeNull();
    });

    it('shows equipment description in detail', () => {
      render();
      click(testId('item-m1a2-abrams')!);
      expect(testId('detail-panel')!.textContent).toContain('American main battle tank');
    });

    it('shows tags in detail panel', () => {
      render();
      click(testId('item-f-35a')!);
      expect(testId('detail-panel')!.textContent).toContain('stealth');
    });
  });

  describe('wishlist', () => {
    it('shows wishlist button when callback provided', () => {
      const onAdd = vi.fn();
      render({ onAddToWishlist: onAdd });
      expect(testId('wishlist-m1a2-abrams')).not.toBeNull();
    });

    it('calls onAddToWishlist on click', () => {
      const onAdd = vi.fn();
      render({ onAddToWishlist: onAdd });
      click(testId('wishlist-m1a2-abrams')!);
      expect(onAdd).toHaveBeenCalledWith('m1a2-abrams');
    });
  });

  describe('empty state', () => {
    it('renders with no items', () => {
      render({ items: [] });
      expect(testId('equipment-catalog')).not.toBeNull();
      expect(testId('result-count')!.textContent).toContain('0');
    });
  });
});
