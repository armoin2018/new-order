/**
 * CNFL-3803 — Import / Export Panel
 *
 * Import modules from JSON files (drag-and-drop), export as JSON/ZIP,
 * manage backups, and restore from backups.
 */

import { useState, useCallback, useRef } from 'react';
import type { FC, CSSProperties, DragEvent } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ImportResult {
  id: string;
  status: 'success' | 'conflict' | 'error';
  message: string;
}

export type ConflictResolution = 'skip' | 'overwrite' | 'rename';

export interface BackupEntry {
  filename: string;
  timestamp: string;
  moduleType: string;
  moduleCount: number;
  sizeBytes: number;
}

export interface ImportExportPanelProps {
  moduleType: string;
  onExportSingle?: (moduleType: string, id: string) => Promise<Blob>;
  onExportAll?: (moduleType: string) => Promise<Blob>;
  onExportBackup?: () => Promise<Blob>;
  onImport?: (moduleType: string, files: File[], resolution: ConflictResolution) => Promise<ImportResult[]>;
  onListBackups?: () => Promise<BackupEntry[]>;
  onRestore?: (filename: string) => Promise<void>;
  selectedModuleId?: string;
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const panelRoot: CSSProperties = { width: '100%', maxWidth: 800, margin: '0 auto', padding: 24, color: '#e0e0e0', fontFamily: 'system-ui, -apple-system, sans-serif' };
const sectionBox: CSSProperties = { border: '1px solid #222', borderRadius: 8, padding: 20, marginBottom: 20, background: '#0d0d0d' };
const sectionTitle: CSSProperties = { fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 12 };
const dropZone: CSSProperties = { border: '2px dashed #333', borderRadius: 8, padding: 32, textAlign: 'center', cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s' };
const dropZoneActive: CSSProperties = { ...dropZone, borderColor: '#4fc3f7', background: 'rgba(79, 195, 247, 0.05)' };
const btnPrimary: CSSProperties = { padding: '8px 18px', background: '#1976d2', border: 'none', borderRadius: 4, color: '#fff', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', fontWeight: 600 };
const btnSecondary: CSSProperties = { padding: '8px 16px', background: 'transparent', border: '1px solid #555', borderRadius: 4, color: '#ccc', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer' };
const btnGroup: CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap' };
const radioGroup: CSSProperties = { display: 'flex', gap: 16, marginBottom: 16 };
const radioLabel: CSSProperties = { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#aaa', cursor: 'pointer' };
const resultRow: CSSProperties = { display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #1a1a1a', fontSize: 12 };
const statusSuccess: CSSProperties = { color: '#4caf50' };
const statusConflict: CSSProperties = { color: '#ff9800' };
const statusError: CSSProperties = { color: '#ff4a4a' };
const backupRow: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #1a1a1a', fontSize: 13 };
const fileLabel: CSSProperties = { fontSize: 12, color: '#aaa', marginTop: 8 };
const progressBar: CSSProperties = { height: 4, background: '#222', borderRadius: 2, overflow: 'hidden', marginTop: 8 };
const progressFill: CSSProperties = { height: '100%', background: '#4fc3f7', borderRadius: 2, transition: 'width 0.3s' };

// ─── Component ──────────────────────────────────────────────────────────────

export const ImportExportPanel: FC<ImportExportPanelProps> = ({
  moduleType,
  onExportSingle,
  onExportAll,
  onExportBackup,
  onImport,
  onListBackups,
  onRestore,
  selectedModuleId,
}) => {
  const [dragging, setDragging] = useState(false);
  const [importFiles, setImportFiles] = useState<File[]>([]);
  const [conflictResolution, setConflictResolution] = useState<ConflictResolution>('skip');
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Drag/Drop ──

  const handleDragOver = useCallback((e: DragEvent) => { e.preventDefault(); setDragging(true); }, []);
  const handleDragLeave = useCallback(() => { setDragging(false); }, []);
  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => f.name.endsWith('.json'));
    setImportFiles((prev) => [...prev, ...files]);
  }, []);

  const handleFileSelect = useCallback(() => {
    const files = fileInputRef.current?.files;
    if (files) setImportFiles((prev) => [...prev, ...Array.from(files).filter((f) => f.name.endsWith('.json'))]);
  }, []);

  // ── Import ──

  const handleImport = useCallback(async () => {
    if (!onImport || importFiles.length === 0) return;
    setImporting(true);
    setImportProgress(0);
    try {
      const results = await onImport(moduleType, importFiles, conflictResolution);
      setImportResults(results);
      setImportProgress(100);
      setImportFiles([]);
    } catch {
      setImportResults([{ id: 'error', status: 'error', message: 'Import failed' }]);
    } finally {
      setImporting(false);
    }
  }, [onImport, importFiles, moduleType, conflictResolution]);

  // ── Export ──

  const handleExportSingle = useCallback(async () => {
    if (!onExportSingle || !selectedModuleId) return;
    const blob = await onExportSingle(moduleType, selectedModuleId);
    download(blob, `${selectedModuleId}.json`);
  }, [onExportSingle, moduleType, selectedModuleId]);

  const handleExportAll = useCallback(async () => {
    if (!onExportAll) return;
    const blob = await onExportAll(moduleType);
    download(blob, `${moduleType}-export.zip`);
  }, [onExportAll, moduleType]);

  const handleExportBackup = useCallback(async () => {
    if (!onExportBackup) return;
    const blob = await onExportBackup();
    download(blob, `models-backup-${new Date().toISOString().slice(0, 10)}.zip`);
  }, [onExportBackup]);

  // ── Backups ──

  const loadBackups = useCallback(async () => {
    if (!onListBackups) return;
    setLoadingBackups(true);
    try {
      const list = await onListBackups();
      setBackups(list);
    } finally {
      setLoadingBackups(false);
    }
  }, [onListBackups]);

  const handleRestore = useCallback(async (filename: string) => {
    if (!onRestore) return;
    await onRestore(filename);
  }, [onRestore]);

  const statusStyle = (s: ImportResult['status']) => s === 'success' ? statusSuccess : s === 'conflict' ? statusConflict : statusError;

  return (
    <div data-testid="import-export-panel" style={panelRoot}>
      <h2 style={{ fontSize: 20, color: '#fff', marginBottom: 20 }}>Import / Export</h2>

      {/* Export Section */}
      <div data-testid="export-section" style={sectionBox}>
        <div style={sectionTitle}>Export</div>
        <div style={btnGroup}>
          {onExportSingle && selectedModuleId && (
            <button data-testid="export-single" style={btnPrimary} onClick={handleExportSingle}>
              Export {selectedModuleId}
            </button>
          )}
          {onExportAll && (
            <button data-testid="export-all" style={btnSecondary} onClick={handleExportAll}>
              Export all {moduleType}
            </button>
          )}
          {onExportBackup && (
            <button data-testid="export-backup" style={btnSecondary} onClick={handleExportBackup}>
              Full backup (ZIP)
            </button>
          )}
        </div>
      </div>

      {/* Import Section */}
      <div data-testid="import-section" style={sectionBox}>
        <div style={sectionTitle}>Import</div>

        <div
          data-testid="drop-zone"
          style={dragging ? dropZoneActive : dropZone}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <p style={{ margin: 0, color: '#888', fontSize: 14 }}>Drop JSON files here or click to browse</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            multiple
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />
        </div>

        {importFiles.length > 0 && (
          <>
            <div style={fileLabel}>{importFiles.length} file(s) selected</div>
            <div data-testid="conflict-resolution" style={radioGroup}>
              {(['skip', 'overwrite', 'rename'] as ConflictResolution[]).map((r) => (
                <label key={r} style={radioLabel}>
                  <input
                    type="radio"
                    name="conflict"
                    value={r}
                    checked={conflictResolution === r}
                    onChange={() => setConflictResolution(r)}
                  />
                  {r.charAt(0).toUpperCase() + r.slice(1)} conflicts
                </label>
              ))}
            </div>
            <button data-testid="import-btn" style={btnPrimary} onClick={handleImport} disabled={importing}>
              {importing ? 'Importing…' : `Import ${importFiles.length} file(s)`}
            </button>
          </>
        )}

        {importing && (
          <div style={progressBar}>
            <div style={{ ...progressFill, width: `${importProgress}%` }} />
          </div>
        )}

        {importResults.length > 0 && (
          <div data-testid="import-results" style={{ marginTop: 12 }}>
            {importResults.map((r) => (
              <div key={r.id} style={resultRow}>
                <span>{r.id}</span>
                <span style={statusStyle(r.status)}>{r.status}: {r.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Backup Section */}
      <div data-testid="backup-section" style={sectionBox}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={sectionTitle}>Backups</div>
          <button data-testid="load-backups" style={btnSecondary} onClick={loadBackups} disabled={loadingBackups}>
            {loadingBackups ? 'Loading…' : 'Load Backups'}
          </button>
        </div>

        {backups.length > 0 ? backups.map((b) => (
          <div key={b.filename} data-testid={`backup-${b.filename}`} style={backupRow}>
            <div>
              <div style={{ color: '#fff' }}>{b.filename}</div>
              <div style={{ fontSize: 11, color: '#666' }}>
                {b.moduleType} • {b.moduleCount} modules • {(b.sizeBytes / 1024).toFixed(1)} KB
              </div>
            </div>
            <button data-testid={`restore-${b.filename}`} style={btnSecondary} onClick={() => handleRestore(b.filename)}>
              Restore
            </button>
          </div>
        )) : (
          <div data-testid="no-backups" style={{ color: '#666', fontSize: 13 }}>
            {loadingBackups ? 'Loading…' : 'Click "Load Backups" to see available backups'}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
