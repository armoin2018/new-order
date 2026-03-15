/**
 * CNFL-3003 — ProfileBuilder · Component Tests
 *
 * Covers: rendering modes, MBTI selection, slider interaction,
 * real-time preview, validation, save/cancel callbacks.
 * Uses react-dom/client directly (no @testing-library/react).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

import { ProfileBuilder } from '@/ui/ProfileBuilder';
import type { LeaderProfile, ProfileBuilderProps } from '@/ui/ProfileBuilder';
import type { Root } from 'react-dom/client';

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

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

function render(props?: Partial<ProfileBuilderProps>): void {
  const defaults: ProfileBuilderProps = {
    onSave: vi.fn(),
    onCancel: vi.fn(),
    ...props,
  };
  act(() => { root.render(createElement(ProfileBuilder, defaults)); });
}

function testId(id: string): HTMLElement | null {
  return container.querySelector(`[data-testid="${id}"]`);
}

function allTestId(id: string): NodeListOf<Element> {
  return container.querySelectorAll(`[data-testid="${id}"]`);
}

function buttons(): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll('button'));
}

function click(el: HTMLElement): void {
  act(() => { el.click(); });
}

function setInputValue(el: HTMLInputElement, val: string): void {
  act(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    nativeInputValueSetter.call(el, val);
    el.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

// ===========================================================================
// Rendering
// ===========================================================================

describe('ProfileBuilder', () => {
  describe('rendering', () => {
    it('renders the builder panel', () => {
      render();
      expect(testId('profile-builder')).not.toBeNull();
    });

    it('shows the title "Leader Profile Builder"', () => {
      render();
      expect(container.textContent).toContain('Leader Profile Builder');
    });

    it('renders three mode tabs: preset, hybrid, manual', () => {
      render();
      expect(testId('mode-preset')).not.toBeNull();
      expect(testId('mode-hybrid')).not.toBeNull();
      expect(testId('mode-manual')).not.toBeNull();
    });

    it('defaults to preset mode', () => {
      render();
      const presetBtn = testId('mode-preset') as HTMLButtonElement;
      expect(presetBtn.style.border).toContain('#4caf50');
    });

    it('shows MBTI grid in preset mode', () => {
      render();
      expect(testId('mbti-ENTJ')).not.toBeNull();
      expect(testId('mbti-INFP')).not.toBeNull();
    });

    it('shows 16 MBTI buttons', () => {
      render();
      const mbtiButtons = Array.from(container.querySelectorAll('[data-testid^="mbti-"]'));
      expect(mbtiButtons).toHaveLength(16);
    });

    it('shows name and title inputs', () => {
      render();
      expect(testId('input-name')).not.toBeNull();
      expect(testId('input-title')).not.toBeNull();
    });

    it('shows save and cancel buttons', () => {
      render();
      expect(testId('btn-save')).not.toBeNull();
      expect(testId('btn-cancel')).not.toBeNull();
    });

    it('shows gameplay tendency preview', () => {
      render();
      expect(testId('tendency-preview')).not.toBeNull();
    });

    it('shows decision style radio buttons', () => {
      render();
      expect(testId('radio-ds-autocratic')).not.toBeNull();
      expect(testId('radio-ds-consensus')).not.toBeNull();
    });

    it('shows stress response radio buttons', () => {
      render();
      expect(testId('radio-sr-escalate')).not.toBeNull();
      expect(testId('radio-sr-withdraw')).not.toBeNull();
    });

    it('shows motivation selects', () => {
      render();
      expect(testId('select-motiv-primary')).not.toBeNull();
      expect(testId('select-motiv-secondary')).not.toBeNull();
      expect(testId('select-motiv-fear')).not.toBeNull();
    });
  });

  // =========================================================================
  // Mode switching
  // =========================================================================

  describe('mode switching', () => {
    it('shows psychology sliders in manual mode', () => {
      render();
      click(testId('mode-manual')!);
      expect(testId('slider-riskTolerance')).not.toBeNull();
      expect(testId('slider-empathy')).not.toBeNull();
    });

    it('hides MBTI grid in manual mode', () => {
      render();
      click(testId('mode-manual')!);
      expect(testId('mbti-ENTJ')).toBeNull();
    });

    it('shows both MBTI grid and sliders in hybrid mode', () => {
      render();
      click(testId('mode-hybrid')!);
      expect(testId('mbti-ENTJ')).not.toBeNull();
      expect(testId('slider-riskTolerance')).not.toBeNull();
    });

    it('shows dichotomy sliders in hybrid mode', () => {
      render();
      click(testId('mode-hybrid')!);
      expect(testId('slider-EI')).not.toBeNull();
      expect(testId('slider-SN')).not.toBeNull();
      expect(testId('slider-TF')).not.toBeNull();
      expect(testId('slider-JP')).not.toBeNull();
    });
  });

  // =========================================================================
  // MBTI Selection
  // =========================================================================

  describe('MBTI selection', () => {
    it('selects MBTI type on click', () => {
      render();
      click(testId('mbti-INFP')!);
      const btn = testId('mbti-INFP') as HTMLButtonElement;
      expect(btn.style.border).toContain('#4caf50');
    });

    it('shows MBTI name in preview after selection', () => {
      render();
      click(testId('mbti-INFP')!);
      expect(container.textContent).toContain('The Mediator');
    });
  });

  // =========================================================================
  // Preview
  // =========================================================================

  describe('tendency preview', () => {
    it('updates preview when MBTI changes', () => {
      render();
      const before = testId('tendency-preview')!.textContent;
      click(testId('mbti-ISFP')!);
      const after = testId('tendency-preview')!.textContent;
      // ISFP produces different tendencies than ENTJ
      expect(after).not.toBe(before);
    });

    it('contains at least 2 tendency lines', () => {
      render();
      const items = testId('tendency-preview')!.querySelectorAll('li');
      expect(items.length).toBeGreaterThanOrEqual(2);
    });
  });

  // =========================================================================
  // Validation & Callbacks
  // =========================================================================

  describe('validation', () => {
    it('disables save when name is empty', () => {
      render();
      const saveBtn = testId('btn-save') as HTMLButtonElement;
      expect(saveBtn.disabled).toBe(true);
    });

    it('enables save when name is provided', () => {
      render();
      setInputValue(testId('input-name') as HTMLInputElement, 'Test Leader');
      const saveBtn = testId('btn-save') as HTMLButtonElement;
      expect(saveBtn.disabled).toBe(false);
    });
  });

  describe('callbacks', () => {
    it('calls onCancel when cancel clicked', () => {
      const onCancel = vi.fn();
      render({ onCancel });
      click(testId('btn-cancel')!);
      expect(onCancel).toHaveBeenCalledOnce();
    });

    it('calls onSave with profile when save clicked', () => {
      const onSave = vi.fn();
      render({ onSave });
      setInputValue(testId('input-name') as HTMLInputElement, 'Commander Test');
      click(testId('btn-save')!);
      expect(onSave).toHaveBeenCalledOnce();
      const profile: LeaderProfile = onSave.mock.calls[0]![0];
      expect(profile.name).toBe('Commander Test');
      expect(profile.mbtiType).toBe('ENTJ');
      expect(profile.psychology).toBeDefined();
    });

    it('does not call onSave when validation fails', () => {
      const onSave = vi.fn();
      render({ onSave });
      click(testId('btn-save')!);
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Existing profile (edit mode)
  // =========================================================================

  describe('existing profile editing', () => {
    const existing: LeaderProfile = {
      leaderId: 'test-leader',
      name: 'Test Leader',
      title: 'Supreme Commander',
      mbtiType: 'INFJ',
      mbtiDichotomyScores: { EI: 80, SN: 70, TF: 65, JP: 30 },
      decisionStyle: 'consensus',
      stressResponse: 'withdraw',
      psychology: {
        riskTolerance: 30, paranoia: 40, narcissism: 20, pragmatism: 60,
        patience: 70, vengefulIndex: 15, charisma: 50, empathy: 85,
        ideologicalRigidity: 20, corruptibility: 10,
      },
      motivationPrimary: 'legacy',
      motivationSecondary: 'stability',
      motivationFear: 'revolution',
    };

    it('pre-fills name from existing profile', () => {
      render({ existingProfile: existing });
      const nameInput = testId('input-name') as HTMLInputElement;
      expect(nameInput.value).toBe('Test Leader');
    });

    it('starts in hybrid mode with existing profile', () => {
      render({ existingProfile: existing });
      expect(testId('slider-riskTolerance')).not.toBeNull();
      expect(testId('mbti-INFJ')).not.toBeNull();
    });

    it('shows INFJ as selected when editing existing INFJ profile', () => {
      render({ existingProfile: existing });
      expect(container.textContent).toContain('The Advocate');
    });
  });
});
