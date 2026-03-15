/**
 * CNFL-3802 — ModuleEditor · Component Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

import { ModuleEditor } from '@/ui/ModuleEditor';
import type { ModuleEditorProps } from '@/ui/ModuleEditor';
import type { JsonSchema } from '@/ui/SchemaForm';
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

const SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', minLength: 1 },
    power: { type: 'number', minimum: 0, maximum: 100 },
  },
  required: ['name'],
};

const INITIAL_DATA = { name: 'Test Leader', power: 50 };

function render(props?: Partial<ModuleEditorProps>): void {
  const defaults: ModuleEditorProps = {
    moduleType: 'leaders',
    moduleId: 'test-leader',
    initialData: INITIAL_DATA,
    schema: SCHEMA,
    onSave: vi.fn().mockResolvedValue(undefined),
    ...props,
  };
  act(() => { root.render(createElement(ModuleEditor, defaults)); });
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

describe('ModuleEditor', () => {
  describe('rendering', () => {
    it('renders the editor root', () => {
      render();
      expect(testId('module-editor')).not.toBeNull();
    });

    it('shows module ID in title', () => {
      render();
      expect(testId('editor-topbar')!.textContent).toContain('test-leader');
    });

    it('shows undo/redo buttons', () => {
      render();
      expect(testId('undo-btn')).not.toBeNull();
      expect(testId('redo-btn')).not.toBeNull();
    });

    it('shows save button', () => {
      render();
      expect(testId('save-btn')).not.toBeNull();
    });

    it('shows embedded schema form', () => {
      render();
      expect(testId('schema-form')).not.toBeNull();
    });

    it('shows close button when onClose provided', () => {
      render({ onClose: vi.fn() });
      expect(testId('close-btn')).not.toBeNull();
    });

    it('shows delete button when onDelete provided', () => {
      render({ onDelete: vi.fn().mockResolvedValue(undefined) });
      expect(testId('delete-btn')).not.toBeNull();
    });

    it('shows clone button when onClone provided', () => {
      render({ onClone: vi.fn() });
      expect(testId('clone-btn')).not.toBeNull();
    });
  });

  describe('dirty detection', () => {
    it('no unsaved badge initially', () => {
      render();
      expect(testId('unsaved-badge')).toBeNull();
    });

    it('shows unsaved badge after editing', () => {
      render();
      setInputValue(testId('input-name') as HTMLInputElement, 'Changed Name');
      expect(testId('unsaved-badge')).not.toBeNull();
    });

    it('save button disabled when not dirty', () => {
      render();
      const btn = testId('save-btn') as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });

    it('save button enabled when dirty', () => {
      render();
      setInputValue(testId('input-name') as HTMLInputElement, 'Changed');
      const btn = testId('save-btn') as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
    });
  });

  describe('undo/redo', () => {
    it('undo button disabled initially', () => {
      render();
      const btn = testId('undo-btn') as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    });

    it('undo enabled after edit', () => {
      render();
      setInputValue(testId('input-name') as HTMLInputElement, 'Changed');
      const btn = testId('undo-btn') as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
    });

    it('undo restores previous value', () => {
      render();
      setInputValue(testId('input-name') as HTMLInputElement, 'Changed');
      click(testId('undo-btn')!);
      const input = testId('input-name') as HTMLInputElement;
      expect(input.value).toBe('Test Leader');
    });

    it('redo after undo', () => {
      render();
      setInputValue(testId('input-name') as HTMLInputElement, 'Changed');
      click(testId('undo-btn')!);
      expect((testId('input-name') as HTMLInputElement).value).toBe('Test Leader');
      click(testId('redo-btn')!);
      expect((testId('input-name') as HTMLInputElement).value).toBe('Changed');
    });

    it('redo disabled after edit (clears redo stack)', () => {
      render();
      setInputValue(testId('input-name') as HTMLInputElement, 'V1');
      click(testId('undo-btn')!);
      // redo should be available
      expect((testId('redo-btn') as HTMLButtonElement).disabled).toBe(false);
      // new edit clears redo
      setInputValue(testId('input-name') as HTMLInputElement, 'V2');
      expect((testId('redo-btn') as HTMLButtonElement).disabled).toBe(true);
    });
  });

  describe('save', () => {
    it('calls onSave with module data', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      render({ onSave });
      setInputValue(testId('input-name') as HTMLInputElement, 'Saved Name');
      await act(async () => {
        click(testId('save-btn')!);
      });
      expect(onSave).toHaveBeenCalledWith('leaders', 'test-leader', expect.objectContaining({ name: 'Saved Name' }));
    });

    it('shows success toast after save', async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      render({ onSave });
      setInputValue(testId('input-name') as HTMLInputElement, 'New');
      await act(async () => {
        click(testId('save-btn')!);
      });
      expect(testId('toast-success')).not.toBeNull();
    });

    it('shows error toast on save failure', async () => {
      const onSave = vi.fn().mockRejectedValue(new Error('Network error'));
      render({ onSave });
      setInputValue(testId('input-name') as HTMLInputElement, 'Fail');
      await act(async () => {
        click(testId('save-btn')!);
      });
      expect(testId('toast-error')).not.toBeNull();
      expect(testId('toast-error')!.textContent).toContain('Network error');
    });
  });

  describe('delete', () => {
    it('shows confirmation dialog on delete click', () => {
      render({ onDelete: vi.fn().mockResolvedValue(undefined) });
      click(testId('delete-btn')!);
      expect(testId('delete-confirm')).not.toBeNull();
    });

    it('cancel hides dialog', () => {
      render({ onDelete: vi.fn().mockResolvedValue(undefined) });
      click(testId('delete-btn')!);
      expect(testId('delete-confirm')).not.toBeNull();
      click(testId('cancel-delete')!);
      expect(testId('delete-confirm')).toBeNull();
    });

    it('confirm calls onDelete', async () => {
      const onDelete = vi.fn().mockResolvedValue(undefined);
      const onClose = vi.fn();
      render({ onDelete, onClose });
      click(testId('delete-btn')!);
      await act(async () => {
        click(testId('confirm-delete')!);
      });
      expect(onDelete).toHaveBeenCalledWith('leaders', 'test-leader');
    });
  });

  describe('clone', () => {
    it('calls onClone with data', () => {
      const onClone = vi.fn();
      render({ onClone });
      click(testId('clone-btn')!);
      expect(onClone).toHaveBeenCalledWith('leaders', 'test-leader', INITIAL_DATA);
    });

    it('shows info toast after clone', () => {
      const onClone = vi.fn();
      render({ onClone });
      click(testId('clone-btn')!);
      expect(testId('toast-info')).not.toBeNull();
    });
  });

  describe('error badge', () => {
    it('shows error badge when validation errors exist', () => {
      render({ initialData: { name: '' } });
      expect(testId('error-badge')).not.toBeNull();
    });

    it('no error badge when data is valid', () => {
      render({ initialData: { name: 'Valid', power: 50 } });
      expect(testId('error-badge')).toBeNull();
    });
  });
});
