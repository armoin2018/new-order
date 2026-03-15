/**
 * Tests for MilitaryDashboard — CNFL-3206
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, type Root } from 'react-dom/client';
import { act, createElement } from 'react';
import { MilitaryDashboard, type MilitaryDashboardProps, type InventoryEntry, type ProcurementOrder, type MilitaryBudget } from './MilitaryDashboard';

let container: HTMLDivElement;
let root: Root;

function mkInventory(overrides: Partial<InventoryEntry> = {}): InventoryEntry {
  return {
    equipmentId: 'eq-1',
    name: 'M1A2 Abrams',
    category: 'Ground',
    quantity: 100,
    deployed: 40,
    inTransit: 10,
    readinessPercent: 85,
    maintenanceCostPerTurn: 0.5,
    ...overrides,
  };
}

function mkBudget(overrides: Partial<MilitaryBudget> = {}): MilitaryBudget {
  return { totalBudget: 800, maintenanceCost: 200, procurementSpending: 100, available: 500, ...overrides };
}

function mkOrder(overrides: Partial<ProcurementOrder> = {}): ProcurementOrder {
  return { orderId: 'ord-1', equipmentId: 'eq-2', name: 'F-35 Lightning', quantity: 5, turnsRemaining: 3, totalCost: 50, ...overrides };
}

function render(props: Partial<MilitaryDashboardProps> = {}) {
  const all: MilitaryDashboardProps = {
    inventory: [mkInventory(), mkInventory({ equipmentId: 'eq-2', name: 'F-16', category: 'Air', quantity: 50, deployed: 20, inTransit: 5, readinessPercent: 70 })],
    procurementQueue: [mkOrder()],
    budget: mkBudget(),
    overallReadiness: 82,
    ...props,
  };
  act(() => { root.render(createElement(MilitaryDashboard, all)); });
}

const q = (id: string) => container.querySelector(`[data-testid="${id}"]`);
const qa = (id: string) => container.querySelectorAll(`[data-testid="${id}"]`);

beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });

describe('MilitaryDashboard', () => {
  describe('rendering', () => {
    it('renders the main panel', () => { render(); expect(q('military-dashboard')).toBeTruthy(); });
    it('shows metric cards', () => { render(); expect(q('metrics-row')).toBeTruthy(); expect(q('metrics-row')!.textContent).toContain('82%'); });
    it('shows total units count', () => { render(); expect(q('metrics-row')!.textContent).toContain('150'); }); // 100 + 50
    it('shows deployed count', () => { render(); expect(q('metrics-row')!.textContent).toContain('60'); }); // 40 + 20
    it('shows available budget', () => { render(); expect(q('metrics-row')!.textContent).toContain('$500B'); });
  });

  describe('budget breakdown', () => {
    it('renders budget breakdown', () => { render(); expect(q('budget-breakdown')).toBeTruthy(); });
    it('shows total budget', () => { render(); expect(q('budget-breakdown')!.textContent).toContain('$800B'); });
    it('shows maintenance cost', () => { render(); expect(q('budget-breakdown')!.textContent).toContain('$200B'); });
  });

  describe('inventory', () => {
    it('renders inventory table', () => { render(); expect(q('inventory-table')).toBeTruthy(); });
    it('shows rows for each inventory item', () => { render(); expect(q('inv-row-eq-1')).toBeTruthy(); expect(q('inv-row-eq-2')).toBeTruthy(); });
    it('shows equipment name', () => { render(); expect(q('inv-row-eq-1')!.textContent).toContain('M1A2 Abrams'); });
    it('shows readiness percent', () => { render(); expect(q('inv-row-eq-1')!.textContent).toContain('85%'); });
  });

  describe('category filter', () => {
    it('renders category select', () => { render(); expect(q('select-inv-category')).toBeTruthy(); });
    it('filters by category', () => {
      render();
      const select = q('select-inv-category') as HTMLSelectElement;
      act(() => {
        const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!;
        setter.call(select, 'Air');
        select.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(q('inv-row-eq-1')).toBeFalsy();
      expect(q('inv-row-eq-2')).toBeTruthy();
    });
  });

  describe('procurement', () => {
    it('renders procurement table', () => { render(); expect(q('procurement-table')).toBeTruthy(); });
    it('shows order row', () => { render(); expect(q('order-ord-1')).toBeTruthy(); expect(q('order-ord-1')!.textContent).toContain('F-35 Lightning'); });
    it('shows empty state when no orders', () => {
      render({ procurementQueue: [] });
      expect(q('procurement-table')).toBeFalsy();
      expect(container.textContent).toContain('No active orders');
    });
  });

  describe('quick actions', () => {
    it('shows action buttons when handler provided', () => {
      const fn = vi.fn();
      render({ onQuickAction: fn });
      expect(q('action-buy-eq-1')).toBeTruthy();
      expect(q('action-sell-eq-1')).toBeTruthy();
    });
    it('fires callback on click', () => {
      const fn = vi.fn();
      render({ onQuickAction: fn });
      act(() => { (q('action-relocate-eq-1') as HTMLButtonElement).click(); });
      expect(fn).toHaveBeenCalledWith('relocate', 'eq-1');
    });
    it('hides action column when no handler', () => {
      render({ onQuickAction: undefined });
      expect(q('action-buy-eq-1')).toBeFalsy();
    });
  });
});
