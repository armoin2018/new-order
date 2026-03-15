/**
 * CNFL-3103 — TickerEditorPanel + ModuleEditor Ticker Integration · Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import type { Root } from 'react-dom/client';

import { TickerEditorPanel, MARKET_SECTORS, MARKET_EVENT_TYPES } from '@/ui/TickerEditorPanel';
import type { TickerEditorPanelProps } from '@/ui/TickerEditorPanel';
import { ModuleEditor } from '@/ui/ModuleEditor';
import type { ModuleEditorProps } from '@/ui/ModuleEditor';
import type { JsonSchema } from '@/ui/SchemaForm';

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

function testId(id: string): HTMLElement | null {
  return container.querySelector(`[data-testid="${id}"]`);
}

function allTestId(id: string): NodeListOf<HTMLElement> {
  return container.querySelectorAll(`[data-testid="${id}"]`);
}

// ═════════════════════════════════════════════════════════════════════════════
// TickerEditorPanel
// ═════════════════════════════════════════════════════════════════════════════

const TICKER_DATA: Record<string, unknown> = {
  tickerId: 'US-DEF-001',
  sectorName: 'defense',
  initialPrice: 150,
  volatilityMultiplier: 1.2,
  eventSensitivityWeights: {
    'military-conflict': 2.5,
    'sanctions-imposed': 1.0,
  },
};

function renderTickerEditor(props?: Partial<TickerEditorPanelProps>): void {
  const defaults: TickerEditorPanelProps = {
    value: TICKER_DATA,
    onChange: vi.fn(),
    ...props,
  };
  act(() => { root.render(createElement(TickerEditorPanel, defaults)); });
}

describe('TickerEditorPanel', () => {
  describe('rendering', () => {
    it('renders the panel root', () => {
      renderTickerEditor();
      expect(testId('ticker-editor-panel')).not.toBeNull();
    });

    it('shows TICKER MODEL badge', () => {
      renderTickerEditor();
      expect(testId('ticker-editor-panel')!.textContent).toContain('TICKER MODEL');
    });

    it('renders ticker ID input with value', () => {
      renderTickerEditor();
      const input = testId('ticker-id-input') as HTMLInputElement;
      expect(input).not.toBeNull();
      expect(input.value).toBe('US-DEF-001');
    });

    it('renders initial price input with value', () => {
      renderTickerEditor();
      const input = testId('initial-price-input') as HTMLInputElement;
      expect(input).not.toBeNull();
      expect(Number(input.value)).toBe(150);
    });

    it('renders sector dropdown with correct value', () => {
      renderTickerEditor();
      const select = testId('sector-dropdown') as HTMLSelectElement;
      expect(select).not.toBeNull();
      expect(select.value).toBe('defense');
    });

    it('sector dropdown contains all market sectors', () => {
      renderTickerEditor();
      const select = testId('sector-dropdown') as HTMLSelectElement;
      const options = Array.from(select.options).map((o) => o.value);
      for (const sector of MARKET_SECTORS) {
        expect(options).toContain(sector);
      }
    });

    it('renders a sensitivity slider for each event type', () => {
      renderTickerEditor();
      for (const eventType of MARKET_EVENT_TYPES) {
        expect(testId(`sensitivity-row-${eventType}`)).not.toBeNull();
        expect(testId(`sensitivity-slider-${eventType}`)).not.toBeNull();
        expect(testId(`sensitivity-value-${eventType}`)).not.toBeNull();
      }
    });

    it('displays correct sensitivity values', () => {
      renderTickerEditor();
      expect(testId('sensitivity-value-military-conflict')!.textContent).toBe('2.5');
      expect(testId('sensitivity-value-sanctions-imposed')!.textContent).toBe('1.0');
      expect(testId('sensitivity-value-tech-breakthrough')!.textContent).toBe('0.0');
    });

    it('renders volatility multiplier slider', () => {
      renderTickerEditor();
      const slider = testId('volatility-slider') as HTMLInputElement;
      expect(slider).not.toBeNull();
      expect(Number(slider.value)).toBeCloseTo(1.2, 1);
    });

    it('renders volatility value display', () => {
      renderTickerEditor();
      expect(testId('volatility-value')!.textContent).toBe('1.20');
    });
  });

  describe('interactions', () => {
    it('calls onChange when ticker ID changes', () => {
      const onChange = vi.fn();
      renderTickerEditor({ onChange });
      const input = testId('ticker-id-input') as HTMLInputElement;
      act(() => {
        const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
        nativeSet.call(input, 'US-ENR-002');
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ tickerId: 'US-ENR-002' }),
      );
    });

    it('calls onChange when sector changes', () => {
      const onChange = vi.fn();
      renderTickerEditor({ onChange });
      const select = testId('sector-dropdown') as HTMLSelectElement;
      act(() => {
        const nativeSet = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!;
        nativeSet.call(select, 'energy');
        select.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ sectorName: 'energy' }),
      );
    });

    it('calls onChange when sensitivity slider changes', () => {
      const onChange = vi.fn();
      renderTickerEditor({ onChange });
      const slider = testId('sensitivity-slider-civil-unrest') as HTMLInputElement;
      act(() => {
        const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
        nativeSet.call(slider, '3.0');
        slider.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          eventSensitivityWeights: expect.objectContaining({ 'civil-unrest': 3.0 }),
        }),
      );
    });

    it('calls onChange when volatility slider changes', () => {
      const onChange = vi.fn();
      renderTickerEditor({ onChange });
      const slider = testId('volatility-slider') as HTMLInputElement;
      act(() => {
        const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
        nativeSet.call(slider, '2.0');
        slider.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ volatilityMultiplier: 2.0 }),
      );
    });

    it('strips zero-weight sensitivities from output', () => {
      const onChange = vi.fn();
      renderTickerEditor({ onChange });
      const slider = testId('sensitivity-slider-sanctions-imposed') as HTMLInputElement;
      act(() => {
        const nativeSet = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
        nativeSet.call(slider, '0');
        slider.dispatchEvent(new Event('change', { bubbles: true }));
      });
      const callArg = onChange.mock.calls[0]![0] as Record<string, unknown>;
      const weights = callArg.eventSensitivityWeights as Record<string, number>;
      expect(weights['sanctions-imposed']).toBeUndefined();
      expect(weights['military-conflict']).toBe(2.5);
    });
  });

  describe('defaults', () => {
    it('handles empty value gracefully', () => {
      renderTickerEditor({ value: {} });
      const tickerInput = testId('ticker-id-input') as HTMLInputElement;
      expect(tickerInput.value).toBe('');
      const priceInput = testId('initial-price-input') as HTMLInputElement;
      expect(Number(priceInput.value)).toBe(100);
      const volSlider = testId('volatility-slider') as HTMLInputElement;
      expect(Number(volSlider.value)).toBe(1);
    });

    it('readOnly disables all inputs', () => {
      renderTickerEditor({ readOnly: true });
      expect((testId('ticker-id-input') as HTMLInputElement).disabled).toBe(true);
      expect((testId('initial-price-input') as HTMLInputElement).disabled).toBe(true);
      expect((testId('sector-dropdown') as HTMLSelectElement).disabled).toBe(true);
      expect((testId('volatility-slider') as HTMLInputElement).disabled).toBe(true);
      for (const et of MARKET_EVENT_TYPES) {
        expect((testId(`sensitivity-slider-${et}`) as HTMLInputElement).disabled).toBe(true);
      }
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// ModuleEditor — Ticker Model Detection
// ═════════════════════════════════════════════════════════════════════════════

const GENERIC_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1 },
  },
  required: ['name'],
};

function renderModuleEditor(props?: Partial<ModuleEditorProps>): void {
  const defaults: ModuleEditorProps = {
    moduleType: 'leaders',
    moduleId: 'test-leader',
    initialData: { name: 'Test Leader' },
    schema: GENERIC_SCHEMA,
    onSave: vi.fn().mockResolvedValue(undefined),
    ...props,
  };
  act(() => { root.render(createElement(ModuleEditor, defaults)); });
}

describe('ModuleEditor — ticker model type detection', () => {
  it('renders SchemaForm for non-ticker moduleType', () => {
    renderModuleEditor({ moduleType: 'leaders' });
    expect(testId('schema-form')).not.toBeNull();
    expect(testId('ticker-editor-panel')).toBeNull();
  });

  it('renders TickerEditorPanel for tickers moduleType', () => {
    renderModuleEditor({
      moduleType: 'tickers',
      initialData: TICKER_DATA,
    });
    expect(testId('ticker-editor-panel')).not.toBeNull();
    expect(testId('schema-form')).toBeNull();
  });

  it('ticker editor shows correct data in ModuleEditor context', () => {
    renderModuleEditor({
      moduleType: 'tickers',
      initialData: TICKER_DATA,
    });
    expect((testId('ticker-id-input') as HTMLInputElement).value).toBe('US-DEF-001');
    expect((testId('sector-dropdown') as HTMLSelectElement).value).toBe('defense');
    expect(testId('sensitivity-value-military-conflict')!.textContent).toBe('2.5');
  });

  it('ModuleEditor still shows topbar for ticker type', () => {
    renderModuleEditor({
      moduleType: 'tickers',
      moduleId: 'us-defense-ticker',
      initialData: TICKER_DATA,
    });
    expect(testId('editor-topbar')).not.toBeNull();
    expect(testId('editor-topbar')!.textContent).toContain('us-defense-ticker');
  });

  it('save/undo/redo still work with ticker editor', () => {
    renderModuleEditor({
      moduleType: 'tickers',
      initialData: TICKER_DATA,
    });
    // Buttons are rendered
    expect(testId('save-btn')).not.toBeNull();
    expect(testId('undo-btn')).not.toBeNull();
    expect(testId('redo-btn')).not.toBeNull();
  });
});
