/**
 * CNFL-3004 — ProfileSelection · Component Tests
 *
 * Covers: card rendering, selection, default selection, custom profiles,
 * create-custom button, confirm/back callbacks.
 * Uses react-dom/client directly (no @testing-library/react).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

import { ProfileSelection } from '@/ui/ProfileSelection';
import type { ProfileSummary, ProfileSelectionProps } from '@/ui/ProfileSelection';
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

function render(props?: Partial<ProfileSelectionProps>): void {
  const defaults: ProfileSelectionProps = {
    profiles: SAMPLE_PROFILES,
    onSelect: vi.fn(),
    onCreateCustom: vi.fn(),
    onConfirm: vi.fn(),
    onBack: vi.fn(),
    ...props,
  };
  act(() => { root.render(createElement(ProfileSelection, defaults)); });
}

function testId(id: string): HTMLElement | null {
  return container.querySelector(`[data-testid="${id}"]`);
}

function click(el: HTMLElement): void {
  act(() => { el.click(); });
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SAMPLE_PROFILES: ProfileSummary[] = [
  {
    leaderId: 'us-president',
    name: 'US President',
    title: 'President of the United States',
    mbtiType: 'ENTJ',
    factionId: 'us',
    isCustom: false,
    tendencies: ['Favours diplomatic solutions but pivots to coercion when talks stall.'],
    keyTraits: [
      { label: 'Risk Tolerance', value: 55 },
      { label: 'Charisma', value: 75 },
      { label: 'Pragmatism', value: 72 },
      { label: 'Empathy', value: 50 },
    ],
  },
  {
    leaderId: 'xi-jinping',
    name: 'Xi Jinping',
    title: 'President of the PRC',
    mbtiType: 'ISTJ',
    factionId: 'china',
    isCustom: false,
    tendencies: ['Prioritises economic pragmatism over ideological purity.'],
    keyTraits: [
      { label: 'Risk Tolerance', value: 35 },
      { label: 'Charisma', value: 45 },
      { label: 'Pragmatism', value: 80 },
      { label: 'Empathy', value: 25 },
    ],
  },
  {
    leaderId: 'custom-hawk',
    name: 'The Hawk',
    title: 'Custom Warlord',
    mbtiType: 'ESTP',
    factionId: null,
    isCustom: true,
    tendencies: ['Aggressive posture — quick to retaliate and escalate conflicts.'],
    keyTraits: [
      { label: 'Risk Tolerance', value: 90 },
      { label: 'Charisma', value: 60 },
      { label: 'Pragmatism', value: 40 },
      { label: 'Empathy', value: 15 },
    ],
  },
];

// ===========================================================================
// Tests
// ===========================================================================

describe('ProfileSelection', () => {
  describe('rendering', () => {
    it('renders the selection panel', () => {
      render();
      expect(testId('profile-selection')).not.toBeNull();
    });

    it('shows "Select Leader Profile" title', () => {
      render();
      expect(container.textContent).toContain('Select Leader Profile');
    });

    it('renders a card for each profile', () => {
      render();
      expect(testId('profile-card-us-president')).not.toBeNull();
      expect(testId('profile-card-xi-jinping')).not.toBeNull();
      expect(testId('profile-card-custom-hawk')).not.toBeNull();
    });

    it('shows profile name on cards', () => {
      render();
      expect(container.textContent).toContain('US President');
      expect(container.textContent).toContain('Xi Jinping');
    });

    it('shows MBTI type on cards', () => {
      render();
      expect(container.textContent).toContain('ENTJ');
      expect(container.textContent).toContain('ISTJ');
    });

    it('marks custom profiles with CUSTOM badge', () => {
      render();
      const hawkCard = testId('profile-card-custom-hawk')!;
      expect(hawkCard.textContent).toContain('CUSTOM');
    });

    it('shows Create Custom card', () => {
      render();
      expect(testId('btn-create-custom')).not.toBeNull();
      expect(container.textContent).toContain('Create Custom');
    });

    it('shows trait bars on cards', () => {
      render();
      const card = testId('profile-card-us-president')!;
      expect(card.textContent).toContain('Risk Tolerance');
      expect(card.textContent).toContain('Charisma');
    });

    it('shows tendency text on cards', () => {
      render();
      const card = testId('profile-card-us-president')!;
      expect(card.textContent).toContain('diplomatic');
    });

    it('shows back and confirm buttons', () => {
      render();
      expect(testId('btn-back')).not.toBeNull();
      expect(testId('btn-confirm')).not.toBeNull();
    });
  });

  describe('selection', () => {
    it('highlights selected card on click', () => {
      render();
      click(testId('profile-card-us-president')!);
      const card = testId('profile-card-us-president') as HTMLButtonElement;
      expect(card.style.border).toContain('#4caf50');
    });

    it('calls onSelect when card is clicked', () => {
      const onSelect = vi.fn();
      render({ onSelect });
      click(testId('profile-card-xi-jinping')!);
      expect(onSelect).toHaveBeenCalledWith('xi-jinping');
    });

    it('pre-selects default profile', () => {
      render({ defaultProfileId: 'us-president' });
      const card = testId('profile-card-us-president') as HTMLButtonElement;
      expect(card.style.border).toContain('#4caf50');
    });
  });

  describe('confirm', () => {
    it('disables confirm when nothing selected', () => {
      render();
      const confirmBtn = testId('btn-confirm') as HTMLButtonElement;
      expect(confirmBtn.disabled).toBe(true);
    });

    it('enables confirm when profile selected', () => {
      render({ defaultProfileId: 'us-president' });
      const confirmBtn = testId('btn-confirm') as HTMLButtonElement;
      expect(confirmBtn.disabled).toBe(false);
    });

    it('calls onConfirm with selected profileId', () => {
      const onConfirm = vi.fn();
      render({ onConfirm, defaultProfileId: 'us-president' });
      click(testId('btn-confirm')!);
      expect(onConfirm).toHaveBeenCalledWith('us-president');
    });
  });

  describe('navigation', () => {
    it('calls onBack when back clicked', () => {
      const onBack = vi.fn();
      render({ onBack });
      click(testId('btn-back')!);
      expect(onBack).toHaveBeenCalledOnce();
    });

    it('calls onCreateCustom when create custom clicked', () => {
      const onCreateCustom = vi.fn();
      render({ onCreateCustom });
      click(testId('btn-create-custom')!);
      expect(onCreateCustom).toHaveBeenCalledOnce();
    });
  });

  describe('empty state', () => {
    it('renders with zero profiles', () => {
      render({ profiles: [] });
      expect(testId('profile-selection')).not.toBeNull();
      expect(testId('btn-create-custom')).not.toBeNull();
    });
  });
});
