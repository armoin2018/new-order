/**
 * CNFL-3801 — Schema-Driven Form Editor
 *
 * Dynamically generates edit forms from JSON Schema definitions
 * with live validation, inline errors, and a JSON preview panel.
 * Supports strings, numbers, booleans, enums, arrays, and nested objects.
 */

import { useState, useMemo, useCallback } from 'react';
import type { FC, CSSProperties, ReactNode } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface JsonSchemaProperty {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  description?: string;
  default?: unknown;
  enum?: (string | number)[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface JsonSchema {
  type: 'object';
  properties: Record<string, JsonSchemaProperty>;
  required?: string[];
  description?: string;
}

export interface ValidationError {
  path: string;
  message: string;
}

export interface SchemaFormProps {
  schema: JsonSchema;
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
  onValidate?: (errors: ValidationError[]) => void;
  showJsonPreview?: boolean;
  readOnly?: boolean;
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const formRoot: CSSProperties = { display: 'flex', gap: 24, fontFamily: 'system-ui, -apple-system, sans-serif', color: '#e0e0e0' };
const formPanel: CSSProperties = { flex: 1, minWidth: 0 };
const previewPanel: CSSProperties = { width: 400, maxHeight: '80vh', overflow: 'auto', background: '#0a0a0a', border: '1px solid #333', borderRadius: 8, padding: 16 };
const fieldGroup: CSSProperties = { marginBottom: 16 };
const labelStyle: CSSProperties = { display: 'block', fontSize: 12, fontWeight: 600, color: '#aaa', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.03em' };
const requiredMark: CSSProperties = { color: '#ff4a4a', marginLeft: 2 };
const inputBase: CSSProperties = { width: '100%', padding: '8px 12px', backgroundColor: '#111', border: '1px solid #333', borderRadius: 4, color: '#e0e0e0', fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' };
const inputError: CSSProperties = { ...inputBase, borderColor: '#ff4a4a' };
const checkboxRow: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8 };
const errorText: CSSProperties = { fontSize: 11, color: '#ff4a4a', marginTop: 2 };
const descText: CSSProperties = { fontSize: 11, color: '#666', marginTop: 2 };
const sectionStyle: CSSProperties = { border: '1px solid #222', borderRadius: 6, padding: 16, marginBottom: 12, background: '#0d0d0d' };
const sectionHeader: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' };
const sectionTitle: CSSProperties = { fontSize: 13, fontWeight: 600, color: '#ccc' };
const arrayItemRow: CSSProperties = { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 };
const smallBtn: CSSProperties = { padding: '4px 10px', border: '1px solid #333', borderRadius: 3, background: 'transparent', color: '#aaa', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' };
const addBtn: CSSProperties = { ...smallBtn, color: '#4fc3f7', borderColor: '#4fc3f7' };
const removeBtn: CSSProperties = { ...smallBtn, color: '#ff4a4a', borderColor: '#ff4a4a' };
const jsonPre: CSSProperties = { margin: 0, fontSize: 12, lineHeight: 1.5, color: '#4fc3f7', whiteSpace: 'pre-wrap', wordBreak: 'break-word' };
const headerRow: CSSProperties = { fontSize: 11, color: '#666', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #222', paddingBottom: 8 };

// ─── Validation ─────────────────────────────────────────────────────────────

function validate(schema: JsonSchema, data: Record<string, unknown>): ValidationError[] {
  const errors: ValidationError[] = [];

  function check(props: Record<string, JsonSchemaProperty>, obj: Record<string, unknown>, required: string[], path: string) {
    for (const key of required) {
      const val = obj[key];
      if (val === undefined || val === null || val === '') {
        errors.push({ path: path ? `${path}.${key}` : key, message: 'This field is required' });
      }
    }
    for (const [key, prop] of Object.entries(props)) {
      const val = obj[key];
      const p = path ? `${path}.${key}` : key;
      if (val === undefined || val === null) continue;

      if (prop.type === 'string' && typeof val === 'string') {
        if (prop.minLength !== undefined && val.length < prop.minLength) errors.push({ path: p, message: `Minimum length is ${prop.minLength}` });
        if (prop.maxLength !== undefined && val.length > prop.maxLength) errors.push({ path: p, message: `Maximum length is ${prop.maxLength}` });
        if (prop.pattern && !new RegExp(prop.pattern).test(val)) errors.push({ path: p, message: `Must match pattern: ${prop.pattern}` });
      }
      if ((prop.type === 'number' || prop.type === 'integer') && typeof val === 'number') {
        if (prop.minimum !== undefined && val < prop.minimum) errors.push({ path: p, message: `Minimum value is ${prop.minimum}` });
        if (prop.maximum !== undefined && val > prop.maximum) errors.push({ path: p, message: `Maximum value is ${prop.maximum}` });
      }
      if (prop.type === 'object' && prop.properties && typeof val === 'object' && !Array.isArray(val)) {
        check(prop.properties, val as Record<string, unknown>, prop.required ?? [], p);
      }
    }
  }

  check(schema.properties, data, schema.required ?? [], '');
  return errors;
}

// ─── Component ──────────────────────────────────────────────────────────────

export const SchemaForm: FC<SchemaFormProps> = ({
  schema,
  value,
  onChange,
  onValidate,
  showJsonPreview = true,
  readOnly = false,
}) => {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const errors = useMemo(() => {
    const errs = validate(schema, value);
    onValidate?.(errs);
    return errs;
  }, [schema, value, onValidate]);

  const errorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of errors) map.set(e.path, e.message);
    return map;
  }, [errors]);

  const setField = useCallback((path: string, val: unknown) => {
    const parts = path.split('.');
    const next = { ...value };
    let cursor: Record<string, unknown> = next;
    for (let i = 0; i < parts.length - 1; i++) {
      const key = parts[i]!;
      cursor[key] = { ...(cursor[key] as Record<string, unknown> | undefined) };
      cursor = cursor[key] as Record<string, unknown>;
    }
    cursor[parts[parts.length - 1]!] = val;
    onChange(next);
  }, [value, onChange]);

  const toggleSection = useCallback((key: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  function renderField(key: string, prop: JsonSchemaProperty, parentPath: string, isRequired: boolean): ReactNode {
    const path = parentPath ? `${parentPath}.${key}` : key;
    const currentVal = getNestedValue(value, path);
    const error = errorMap.get(path);
    const hasError = !!error;

    return (
      <div key={path} data-testid={`field-${path}`} style={fieldGroup}>
        <label style={labelStyle}>
          {key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}
          {isRequired && <span style={requiredMark}>*</span>}
        </label>

        {prop.type === 'string' && prop.enum ? (
          <select
            data-testid={`input-${path}`}
            style={hasError ? inputError : inputBase}
            value={(currentVal as string) ?? ''}
            onChange={(e) => setField(path, e.target.value)}
            disabled={readOnly}
          >
            <option value="">— Select —</option>
            {prop.enum.map((opt) => <option key={String(opt)} value={String(opt)}>{String(opt)}</option>)}
          </select>
        ) : prop.type === 'string' ? (
          <input
            data-testid={`input-${path}`}
            type="text"
            style={hasError ? inputError : inputBase}
            value={(currentVal as string) ?? ''}
            onChange={(e) => setField(path, e.target.value)}
            placeholder={prop.description}
            disabled={readOnly}
          />
        ) : (prop.type === 'number' || prop.type === 'integer') ? (
          <input
            data-testid={`input-${path}`}
            type="number"
            style={hasError ? inputError : inputBase}
            value={currentVal !== undefined ? String(currentVal) : ''}
            min={prop.minimum}
            max={prop.maximum}
            step={prop.type === 'integer' ? 1 : 'any'}
            onChange={(e) => setField(path, e.target.value === '' ? undefined : Number(e.target.value))}
            disabled={readOnly}
          />
        ) : prop.type === 'boolean' ? (
          <div style={checkboxRow}>
            <input
              data-testid={`input-${path}`}
              type="checkbox"
              checked={!!currentVal}
              onChange={(e) => setField(path, e.target.checked)}
              disabled={readOnly}
            />
            <span style={{ fontSize: 13 }}>{key}</span>
          </div>
        ) : prop.type === 'array' && prop.items ? (
          renderArrayField(path, prop, currentVal as unknown[])
        ) : prop.type === 'object' && prop.properties ? (
          renderObjectSection(path, key, prop)
        ) : (
          <input data-testid={`input-${path}`} type="text" style={inputBase} value={String(currentVal ?? '')} onChange={(e) => setField(path, e.target.value)} disabled={readOnly} />
        )}

        {hasError && <div data-testid={`error-${path}`} style={errorText}>{error}</div>}
        {!hasError && prop.description && <div style={descText}>{prop.description}</div>}
      </div>
    );
  }

  function renderArrayField(path: string, prop: JsonSchemaProperty, arr: unknown[] | undefined): ReactNode {
    const items = arr ?? [];
    return (
      <div data-testid={`array-${path}`}>
        {items.map((item, i) => (
          <div key={i} style={arrayItemRow}>
            {prop.items?.type === 'object' && prop.items.properties ? (
              renderObjectSection(`${path}.${i}`, `Item ${i + 1}`, prop.items)
            ) : (
              <input
                data-testid={`input-${path}.${i}`}
                type="text"
                style={{ ...inputBase, flex: 1 }}
                value={String(item ?? '')}
                onChange={(e) => {
                  const next = [...items];
                  next[i] = e.target.value;
                  setField(path, next);
                }}
                disabled={readOnly}
              />
            )}
            {!readOnly && (
              <button data-testid={`remove-${path}.${i}`} style={removeBtn} onClick={() => {
                const next = items.filter((_, j) => j !== i);
                setField(path, next);
              }}>×</button>
            )}
          </div>
        ))}
        {!readOnly && (
          <button data-testid={`add-${path}`} style={addBtn} onClick={() => {
            const defaultVal = prop.items?.type === 'object' ? {} : prop.items?.type === 'number' ? 0 : '';
            setField(path, [...items, defaultVal]);
          }}>+ Add item</button>
        )}
      </div>
    );
  }

  function renderObjectSection(path: string, label: string, prop: JsonSchemaProperty): ReactNode {
    const collapsed = collapsedSections.has(path);
    return (
      <div data-testid={`section-${path}`} style={sectionStyle}>
        <div style={sectionHeader} onClick={() => toggleSection(path)}>
          <span style={sectionTitle}>{label.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}</span>
          <span style={{ color: '#666' }}>{collapsed ? '▸' : '▾'}</span>
        </div>
        {!collapsed && prop.properties && (
          <div style={{ marginTop: 12 }}>
            {Object.entries(prop.properties).map(([k, p]) =>
              renderField(k, p, path, prop.required?.includes(k) ?? false),
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div data-testid="schema-form" style={formRoot}>
      <div style={formPanel}>
        <div style={headerRow}>Module Editor {errors.length > 0 && `• ${errors.length} error${errors.length > 1 ? 's' : ''}`}</div>
        {Object.entries(schema.properties).map(([key, prop]) =>
          renderField(key, prop, '', schema.required?.includes(key) ?? false),
        )}
      </div>
      {showJsonPreview && (
        <div data-testid="json-preview" style={previewPanel}>
          <div style={headerRow}>JSON Preview</div>
          <pre style={jsonPre}>{JSON.stringify(value, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let cursor: unknown = obj;
  for (const part of parts) {
    if (cursor === null || cursor === undefined) return undefined;
    if (typeof cursor === 'object' && !Array.isArray(cursor)) {
      cursor = (cursor as Record<string, unknown>)[part];
    } else if (Array.isArray(cursor)) {
      cursor = cursor[Number(part)];
    } else {
      return undefined;
    }
  }
  return cursor;
}
