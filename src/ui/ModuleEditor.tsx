/**
 * CNFL-3802 — Module Editor Panel
 *
 * Wires CRUD operations to the Module Builder: create, clone, delete, save,
 * unsaved changes detection, undo/redo, optimistic updates, and toast notifications.
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import type { FC, CSSProperties } from 'react';
import { SchemaForm } from './SchemaForm';
import type { JsonSchema, ValidationError } from './SchemaForm';
import { TickerEditorPanel } from './TickerEditorPanel';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ModuleEditorProps {
  moduleType: string;
  moduleId: string;
  initialData: Record<string, unknown>;
  schema: JsonSchema;
  onSave: (moduleType: string, id: string, data: Record<string, unknown>) => Promise<void>;
  onDelete?: (moduleType: string, id: string) => Promise<void>;
  onClone?: (moduleType: string, id: string, data: Record<string, unknown>) => void;
  onClose?: () => void;
}

interface UndoEntry {
  data: Record<string, unknown>;
  timestamp: number;
}

export type ToastType = 'success' | 'error' | 'info';
export interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const editorRoot: CSSProperties = { width: '100%', maxWidth: 1400, margin: '0 auto', padding: 24, color: '#e0e0e0', fontFamily: 'system-ui, -apple-system, sans-serif' };
const topBar: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, padding: '12px 0', borderBottom: '1px solid #333' };
const titleStyle: CSSProperties = { fontSize: 18, fontWeight: 600, color: '#fff', margin: 0 };
const btnGroup: CSSProperties = { display: 'flex', gap: 8 };
const btnSave: CSSProperties = { padding: '8px 20px', background: '#1976d2', border: 'none', borderRadius: 4, color: '#fff', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', fontWeight: 600 };
const btnSaveDisabled: CSSProperties = { ...btnSave, background: '#333', color: '#666', cursor: 'not-allowed' };
const btnSecondary: CSSProperties = { padding: '8px 16px', background: 'transparent', border: '1px solid #555', borderRadius: 4, color: '#ccc', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer' };
const btnDanger: CSSProperties = { ...btnSecondary, borderColor: '#c62828', color: '#ef5350' };
const btnDisabled: CSSProperties = { ...btnSecondary, color: '#555', cursor: 'not-allowed' };
const unsavedBadge: CSSProperties = { background: '#ff9800', color: '#000', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, marginLeft: 8 };
const errorBadge: CSSProperties = { background: '#c62828', color: '#fff', padding: '2px 8px', borderRadius: 4, fontSize: 11, marginLeft: 8 };
const toastContainer: CSSProperties = { position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 };
const toastBase: CSSProperties = { padding: '10px 20px', borderRadius: 6, fontSize: 13, fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(0,0,0,0.4)', maxWidth: 360 };
const toastStyles: Record<ToastType, CSSProperties> = {
  success: { ...toastBase, background: '#1b5e20', color: '#a5d6a7' },
  error: { ...toastBase, background: '#b71c1c', color: '#ef9a9a' },
  info: { ...toastBase, background: '#0d47a1', color: '#90caf9' },
};
const confirmOverlay: CSSProperties = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' };
const confirmBox: CSSProperties = { background: '#1a1a1a', border: '1px solid #333', borderRadius: 8, padding: 24, maxWidth: 400, width: '90%' };
const confirmTitle: CSSProperties = { fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 12 };
const confirmText: CSSProperties = { fontSize: 13, color: '#aaa', marginBottom: 20 };

// ─── Component ──────────────────────────────────────────────────────────────

export const ModuleEditor: FC<ModuleEditorProps> = ({
  moduleType,
  moduleId,
  initialData,
  schema,
  onSave,
  onDelete,
  onClone,
  onClose,
}) => {
  const [data, setData] = useState<Record<string, unknown>>(initialData);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const toastCounter = useRef(0);

  // Undo/Redo stacks
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [redoStack, setRedoStack] = useState<UndoEntry[]>([]);

  const isDirty = useMemo(() => JSON.stringify(data) !== JSON.stringify(initialData), [data, initialData]);
  const hasErrors = errors.length > 0;
  const canSave = isDirty && !hasErrors && !saving;

  // Toast helper
  const addToast = useCallback((type: ToastType, message: string) => {
    const id = ++toastCounter.current;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  // Change handler with undo tracking
  const handleChange = useCallback((next: Record<string, unknown>) => {
    setUndoStack((prev) => [...prev, { data: { ...data }, timestamp: Date.now() }]);
    setRedoStack([]);
    setData(next);
  }, [data]);

  // Undo
  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1]!;
    setRedoStack((r) => [...r, { data: { ...data }, timestamp: Date.now() }]);
    setUndoStack((s) => s.slice(0, -1));
    setData(prev.data);
  }, [undoStack, data]);

  // Redo
  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1]!;
    setUndoStack((s) => [...s, { data: { ...data }, timestamp: Date.now() }]);
    setRedoStack((r) => r.slice(0, -1));
    setData(next.data);
  }, [redoStack, data]);

  // Save
  const handleSave = useCallback(async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave(moduleType, moduleId, data);
      addToast('success', 'Module saved successfully');
      setUndoStack([]);
      setRedoStack([]);
    } catch (err) {
      addToast('error', `Save failed: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  }, [canSave, moduleType, moduleId, data, onSave, addToast]);

  // Delete
  const handleDelete = useCallback(async () => {
    setShowDeleteConfirm(false);
    if (!onDelete) return;
    try {
      await onDelete(moduleType, moduleId);
      addToast('success', 'Module deleted');
      onClose?.();
    } catch (err) {
      addToast('error', `Delete failed: ${(err as Error).message}`);
    }
  }, [moduleType, moduleId, onDelete, addToast, onClose]);

  // Clone
  const handleClone = useCallback(() => {
    onClone?.(moduleType, moduleId, data);
    addToast('info', 'Module cloned — edit the new copy');
  }, [moduleType, moduleId, data, onClone, addToast]);

  // Close with unsaved check
  const handleClose = useCallback(() => {
    if (isDirty) {
      if (!confirm('You have unsaved changes. Discard them?')) return;
    }
    onClose?.();
  }, [isDirty, onClose]);

  return (
    <div data-testid="module-editor" style={editorRoot}>
      {/* Top Bar */}
      <div data-testid="editor-topbar" style={topBar}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <h2 style={titleStyle}>
            Edit: {moduleId}
          </h2>
          {isDirty && <span data-testid="unsaved-badge" style={unsavedBadge}>Unsaved</span>}
          {hasErrors && <span data-testid="error-badge" style={errorBadge}>{errors.length} error{errors.length > 1 ? 's' : ''}</span>}
        </div>
        <div style={btnGroup}>
          <button data-testid="undo-btn" style={undoStack.length > 0 ? btnSecondary : btnDisabled} onClick={handleUndo} disabled={undoStack.length === 0}>↩ Undo</button>
          <button data-testid="redo-btn" style={redoStack.length > 0 ? btnSecondary : btnDisabled} onClick={handleRedo} disabled={redoStack.length === 0}>↪ Redo</button>
          {onClone && <button data-testid="clone-btn" style={btnSecondary} onClick={handleClone}>Clone</button>}
          {onDelete && <button data-testid="delete-btn" style={btnDanger} onClick={() => setShowDeleteConfirm(true)}>Delete</button>}
          <button data-testid="save-btn" style={canSave ? btnSave : btnSaveDisabled} onClick={handleSave} disabled={!canSave}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          {onClose && <button data-testid="close-btn" style={btnSecondary} onClick={handleClose}>Close</button>}
        </div>
      </div>

      {/* Form — use specialized ticker editor for ticker model types */}
      {moduleType === 'tickers' ? (
        <TickerEditorPanel
          value={data}
          onChange={handleChange}
        />
      ) : (
        <SchemaForm
          schema={schema}
          value={data}
          onChange={handleChange}
          onValidate={setErrors}
          showJsonPreview={true}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div data-testid="delete-confirm" style={confirmOverlay}>
          <div style={confirmBox}>
            <div style={confirmTitle}>Delete Module?</div>
            <div style={confirmText}>
              Are you sure you want to delete <strong>{moduleId}</strong>? This action will move the module to backups.
            </div>
            <div style={btnGroup}>
              <button data-testid="confirm-delete" style={btnDanger} onClick={handleDelete}>Delete</button>
              <button data-testid="cancel-delete" style={btnSecondary} onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      {toasts.length > 0 && (
        <div data-testid="toasts" style={toastContainer}>
          {toasts.map((t) => (
            <div key={t.id} data-testid={`toast-${t.type}`} style={toastStyles[t.type]}>
              {t.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
