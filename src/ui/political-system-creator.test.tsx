/**
 * CNFL-3103 — PoliticalSystemCreator · Component Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

import { PoliticalSystemCreator } from '@/ui/PoliticalSystemCreator';
import type { PoliticalSystemPreset, PoliticalSystemCreatorProps } from '@/ui/PoliticalSystemCreator';
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

function render(props?: Partial<PoliticalSystemCreatorProps>): void {
  const defaults: PoliticalSystemCreatorProps = {
    presets: SAMPLE_PRESETS,
    onSave: vi.fn(),
    onCancel: vi.fn(),
    ...props,
  };
  act(() => { root.render(createElement(PoliticalSystemCreator, defaults)); });
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

const SAMPLE_PRESETS: PoliticalSystemPreset[] = [
  {
    systemId: 'liberal-democracy',
    systemName: 'Liberal Democracy',
    description: 'Representative government with separation of powers.',
    modifiers: { decisionSpeedModifier: -20, stabilityBaseline: 12, civilLibertyIndex: 90, pressFreedomIndex: 85, corruptionBaseline: 25, successionRisk: 10, reformCapacity: 80 },
    gameplayModifiers: { stabilityRecoveryRate: 1.3, crisisResistance: 1.2, controversialActionDelay: 2, propagandaEffectiveness: 0.5, civilUnrestThreshold: 0.7 },
  },
  {
    systemId: 'authoritarian-republic',
    systemName: 'Authoritarian Republic',
    description: 'Centralized power with limited political participation.',
    modifiers: { decisionSpeedModifier: 30, stabilityBaseline: 8, civilLibertyIndex: 20, pressFreedomIndex: 15, corruptionBaseline: 65, successionRisk: 60, reformCapacity: 25 },
    gameplayModifiers: { stabilityRecoveryRate: 0.8, crisisResistance: 0.9, controversialActionDelay: 0, propagandaEffectiveness: 1.5, civilUnrestThreshold: 0.3 },
  },
];

describe('PoliticalSystemCreator', () => {
  describe('rendering', () => {
    it('renders the creator panel', () => {
      render();
      expect(testId('polsys-creator')).not.toBeNull();
    });

    it('shows title', () => {
      render();
      expect(container.textContent).toContain('Political System Creator');
    });

    it('shows preset buttons', () => {
      render();
      expect(testId('preset-liberal-democracy')).not.toBeNull();
      expect(testId('preset-authoritarian-republic')).not.toBeNull();
    });

    it('shows system modifier sliders', () => {
      render();
      expect(testId('slider-civilLibertyIndex')).not.toBeNull();
      expect(testId('slider-reformCapacity')).not.toBeNull();
    });

    it('shows gameplay modifier sliders', () => {
      render();
      expect(testId('slider-stabilityRecoveryRate')).not.toBeNull();
      expect(testId('slider-propagandaEffectiveness')).not.toBeNull();
    });

    it('shows system summary', () => {
      render();
      expect(testId('system-summary')).not.toBeNull();
    });

    it('shows save and cancel buttons', () => {
      render();
      expect(testId('btn-save')).not.toBeNull();
      expect(testId('btn-cancel')).not.toBeNull();
    });

    it('shows name, description, and tags inputs', () => {
      render();
      expect(testId('input-system-name')).not.toBeNull();
      expect(testId('input-description')).not.toBeNull();
      expect(testId('input-tags')).not.toBeNull();
    });
  });

  describe('preset loading', () => {
    it('populates name from preset click', () => {
      render();
      click(testId('preset-liberal-democracy')!);
      const nameInput = testId('input-system-name') as HTMLInputElement;
      expect(nameInput.value).toContain('Liberal Democracy');
    });

    it('populates description from preset', () => {
      render();
      click(testId('preset-authoritarian-republic')!);
      const descInput = testId('input-description') as HTMLTextAreaElement;
      expect(descInput.value).toContain('Centralized power');
    });
  });

  describe('validation', () => {
    it('disables save when name is empty', () => {
      render();
      const saveBtn = testId('btn-save') as HTMLButtonElement;
      expect(saveBtn.disabled).toBe(true);
    });

    it('enables save when name is provided', () => {
      render();
      setInputValue(testId('input-system-name') as HTMLInputElement, 'My System');
      const saveBtn = testId('btn-save') as HTMLButtonElement;
      expect(saveBtn.disabled).toBe(false);
    });
  });

  describe('callbacks', () => {
    it('calls onCancel', () => {
      const onCancel = vi.fn();
      render({ onCancel });
      click(testId('btn-cancel')!);
      expect(onCancel).toHaveBeenCalledOnce();
    });

    it('calls onSave with system profile', () => {
      const onSave = vi.fn();
      render({ onSave });
      setInputValue(testId('input-system-name') as HTMLInputElement, 'Test System');
      click(testId('btn-save')!);
      expect(onSave).toHaveBeenCalledOnce();
      const sys = onSave.mock.calls[0]![0];
      expect(sys.systemName).toBe('Test System');
      expect(sys.modifiers).toBeDefined();
      expect(sys.gameplayModifiers).toBeDefined();
    });
  });

  describe('no presets', () => {
    it('renders without presets', () => {
      render({ presets: [] });
      expect(testId('polsys-creator')).not.toBeNull();
    });
  });
});
