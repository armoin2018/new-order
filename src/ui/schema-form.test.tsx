/**
 * CNFL-3801 — SchemaForm · Component Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

import { SchemaForm } from '@/ui/SchemaForm';
import type { SchemaFormProps, JsonSchema } from '@/ui/SchemaForm';
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

function render(props?: Partial<SchemaFormProps>): void {
  const defaults: SchemaFormProps = {
    schema: BASIC_SCHEMA,
    value: { name: 'Test Module', age: 25 },
    onChange: vi.fn(),
    ...props,
  };
  act(() => { root.render(createElement(SchemaForm, defaults)); });
}

function testId(id: string): HTMLElement | null {
  return container.querySelector(`[data-testid="${id}"]`);
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

function click(el: HTMLElement): void {
  act(() => { el.click(); });
}

const BASIC_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Module name', minLength: 1 },
    age: { type: 'number', minimum: 0, maximum: 200 },
  },
  required: ['name'],
};

const ENUM_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    category: { type: 'string', enum: ['ground', 'air', 'naval'] },
  },
};

const BOOLEAN_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    active: { type: 'boolean' },
  },
};

const NESTED_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    stats: {
      type: 'object',
      properties: {
        attack: { type: 'number', minimum: 0 },
        defense: { type: 'number', minimum: 0 },
      },
      required: ['attack'],
    },
  },
};

const ARRAY_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    tags: { type: 'array', items: { type: 'string' } },
  },
};

describe('SchemaForm', () => {
  describe('rendering', () => {
    it('renders the form root', () => {
      render();
      expect(testId('schema-form')).not.toBeNull();
    });

    it('renders fields from schema properties', () => {
      render();
      expect(testId('field-name')).not.toBeNull();
      expect(testId('field-age')).not.toBeNull();
    });

    it('renders text input for string type', () => {
      render();
      const input = testId('input-name') as HTMLInputElement;
      expect(input).not.toBeNull();
      expect(input.type).toBe('text');
      expect(input.value).toBe('Test Module');
    });

    it('renders number input for number type', () => {
      render();
      const input = testId('input-age') as HTMLInputElement;
      expect(input).not.toBeNull();
      expect(input.type).toBe('number');
    });

    it('shows required markers for required fields', () => {
      render();
      const nameField = testId('field-name')!;
      expect(nameField.textContent).toContain('*');
    });

    it('does not show required marker for optional fields', () => {
      render();
      const ageField = testId('field-age')!;
      // field label area should NOT have *
      const labels = ageField.querySelectorAll('label');
      const labelText = labels[0]?.textContent ?? '';
      expect(labelText).not.toContain('*');
    });

    it('shows JSON preview panel by default', () => {
      render();
      expect(testId('json-preview')).not.toBeNull();
    });

    it('hides JSON preview when showJsonPreview=false', () => {
      render({ showJsonPreview: false });
      expect(testId('json-preview')).toBeNull();
    });

    it('JSON preview contains current value', () => {
      render();
      const preview = testId('json-preview')!;
      expect(preview.textContent).toContain('Test Module');
      expect(preview.textContent).toContain('25');
    });

    it('shows error count in header', () => {
      render({ value: { name: '' } }); // name is required, so there's an error
      const formRoot = testId('schema-form')!;
      expect(formRoot.textContent).toContain('error');
    });
  });

  describe('enum fields', () => {
    it('renders select for enum properties', () => {
      render({ schema: ENUM_SCHEMA, value: { category: 'air' } });
      const select = testId('input-category') as HTMLSelectElement;
      expect(select).not.toBeNull();
      expect(select.tagName).toBe('SELECT');
    });

    it('enum select has options', () => {
      render({ schema: ENUM_SCHEMA, value: { category: '' } });
      const select = testId('input-category') as HTMLSelectElement;
      // 3 values + 1 "— Select —" placeholder
      expect(select.options.length).toBe(4);
    });

    it('calls onChange when enum value selected', () => {
      const onChange = vi.fn();
      render({ schema: ENUM_SCHEMA, value: { category: '' }, onChange });
      setSelectValue(testId('input-category') as HTMLSelectElement, 'naval');
      expect(onChange).toHaveBeenCalled();
      const arg = onChange.mock.calls[0][0];
      expect(arg.category).toBe('naval');
    });
  });

  describe('boolean fields', () => {
    it('renders checkbox for boolean type', () => {
      render({ schema: BOOLEAN_SCHEMA, value: { active: true } });
      const cb = testId('input-active') as HTMLInputElement;
      expect(cb).not.toBeNull();
      expect(cb.type).toBe('checkbox');
      expect(cb.checked).toBe(true);
    });

    it('calls onChange when checkbox toggled', () => {
      const onChange = vi.fn();
      render({ schema: BOOLEAN_SCHEMA, value: { active: false }, onChange });
      click(testId('input-active')!);
      expect(onChange).toHaveBeenCalled();
    });
  });

  describe('nested objects', () => {
    it('renders collapsible section for nested object', () => {
      render({ schema: NESTED_SCHEMA, value: { stats: { attack: 50, defense: 30 } } });
      expect(testId('section-stats')).not.toBeNull();
    });

    it('renders nested fields', () => {
      render({ schema: NESTED_SCHEMA, value: { stats: { attack: 50, defense: 30 } } });
      expect(testId('field-stats.attack')).not.toBeNull();
      expect(testId('field-stats.defense')).not.toBeNull();
    });

    it('collapses and expands section', () => {
      render({ schema: NESTED_SCHEMA, value: { stats: { attack: 50 } } });
      // nested fields should be visible initially
      expect(testId('field-stats.attack')).not.toBeNull();
      // click the section header to collapse
      const header = testId('section-stats')!.querySelector('[style]') as HTMLElement;
      click(header);
      // nested fields should be hidden
      expect(testId('field-stats.attack')).toBeNull();
    });
  });

  describe('array fields', () => {
    it('renders array container', () => {
      render({ schema: ARRAY_SCHEMA, value: { tags: ['a', 'b'] } });
      expect(testId('array-tags')).not.toBeNull();
    });

    it('renders array items', () => {
      render({ schema: ARRAY_SCHEMA, value: { tags: ['alpha', 'beta'] } });
      expect(testId('input-tags.0')).not.toBeNull();
      expect(testId('input-tags.1')).not.toBeNull();
    });

    it('shows add button', () => {
      render({ schema: ARRAY_SCHEMA, value: { tags: [] } });
      expect(testId('add-tags')).not.toBeNull();
    });

    it('add button calls onChange with new item', () => {
      const onChange = vi.fn();
      render({ schema: ARRAY_SCHEMA, value: { tags: ['a'] }, onChange });
      click(testId('add-tags')!);
      expect(onChange).toHaveBeenCalled();
      const newVal = onChange.mock.calls[0][0];
      expect(newVal.tags).toHaveLength(2);
    });

    it('remove button calls onChange without item', () => {
      const onChange = vi.fn();
      render({ schema: ARRAY_SCHEMA, value: { tags: ['a', 'b'] }, onChange });
      click(testId('remove-tags.0')!);
      expect(onChange).toHaveBeenCalled();
      const newVal = onChange.mock.calls[0][0];
      expect(newVal.tags).toHaveLength(1);
      expect(newVal.tags[0]).toBe('b');
    });
  });

  describe('validation', () => {
    it('shows error for missing required field', () => {
      render({ value: { name: '' } });
      expect(testId('error-name')).not.toBeNull();
      expect(testId('error-name')!.textContent).toContain('length');
    });

    it('calls onValidate with errors', () => {
      const onValidate = vi.fn();
      render({ value: { name: '' }, onValidate });
      expect(onValidate).toHaveBeenCalled();
      const errors = onValidate.mock.calls[0][0];
      expect(errors.length).toBeGreaterThan(0);
    });

    it('no error shown for valid data', () => {
      render({ value: { name: 'Valid' } });
      expect(testId('error-name')).toBeNull();
    });

    it('validates minimum value', () => {
      render({ value: { name: 'ok', age: -5 } });
      expect(testId('error-age')).not.toBeNull();
      expect(testId('error-age')!.textContent).toContain('Minimum');
    });

    it('validates maximum value', () => {
      render({ value: { name: 'ok', age: 999 } });
      expect(testId('error-age')).not.toBeNull();
      expect(testId('error-age')!.textContent).toContain('Maximum');
    });
  });

  describe('read-only mode', () => {
    it('disables inputs in read-only mode', () => {
      render({ readOnly: true });
      const input = testId('input-name') as HTMLInputElement;
      expect(input.disabled).toBe(true);
    });

    it('hides array add/remove buttons in read-only mode', () => {
      render({ schema: ARRAY_SCHEMA, value: { tags: ['a'] }, readOnly: true });
      expect(testId('add-tags')).toBeNull();
      expect(testId('remove-tags.0')).toBeNull();
    });
  });

  describe('onChange', () => {
    it('calls onChange with updated value when text input changes', () => {
      const onChange = vi.fn();
      render({ onChange });
      setInputValue(testId('input-name') as HTMLInputElement, 'New Name');
      expect(onChange).toHaveBeenCalled();
      expect(onChange.mock.calls[0][0].name).toBe('New Name');
    });
  });
});
