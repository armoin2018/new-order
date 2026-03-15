/**
 * CNFL-3803 — ImportExportPanel · Component Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';

import { ImportExportPanel } from '@/ui/ImportExportPanel';
import type { ImportExportPanelProps } from '@/ui/ImportExportPanel';
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

function render(props?: Partial<ImportExportPanelProps>): void {
  const defaults: ImportExportPanelProps = {
    moduleType: 'leaders',
    ...props,
  };
  act(() => { root.render(createElement(ImportExportPanel, defaults)); });
}

function testId(id: string): HTMLElement | null {
  return container.querySelector(`[data-testid="${id}"]`);
}

function click(el: HTMLElement): void {
  act(() => { el.click(); });
}

describe('ImportExportPanel', () => {
  describe('rendering', () => {
    it('renders the panel root', () => {
      render();
      expect(testId('import-export-panel')).not.toBeNull();
    });

    it('shows Import / Export title', () => {
      render();
      expect(container.textContent).toContain('Import / Export');
    });

    it('renders export section', () => {
      render();
      expect(testId('export-section')).not.toBeNull();
    });

    it('renders import section', () => {
      render();
      expect(testId('import-section')).not.toBeNull();
    });

    it('renders backup section', () => {
      render();
      expect(testId('backup-section')).not.toBeNull();
    });
  });

  describe('export', () => {
    it('shows export single button when handler & module provided', () => {
      render({
        onExportSingle: vi.fn().mockResolvedValue(new Blob()),
        selectedModuleId: 'leader-1',
      });
      expect(testId('export-single')).not.toBeNull();
    });

    it('hides export single button when no selectedModuleId', () => {
      render({ onExportSingle: vi.fn().mockResolvedValue(new Blob()) });
      expect(testId('export-single')).toBeNull();
    });

    it('shows export all button when handler provided', () => {
      render({ onExportAll: vi.fn().mockResolvedValue(new Blob()) });
      expect(testId('export-all')).not.toBeNull();
    });

    it('shows backup button when handler provided', () => {
      render({ onExportBackup: vi.fn().mockResolvedValue(new Blob()) });
      expect(testId('export-backup')).not.toBeNull();
    });

    it('calls onExportAll when button clicked', async () => {
      const onExportAll = vi.fn().mockResolvedValue(new Blob(['data']));
      // Stub URL.createObjectURL
      const origCreate = URL.createObjectURL;
      const origRevoke = URL.revokeObjectURL;
      URL.createObjectURL = vi.fn().mockReturnValue('blob:test');
      URL.revokeObjectURL = vi.fn();
      render({ onExportAll });
      await act(async () => {
        click(testId('export-all')!);
      });
      expect(onExportAll).toHaveBeenCalledWith('leaders');
      URL.createObjectURL = origCreate;
      URL.revokeObjectURL = origRevoke;
    });

    it('calls onExportSingle with moduleType and id', async () => {
      const onExportSingle = vi.fn().mockResolvedValue(new Blob(['data']));
      URL.createObjectURL = vi.fn().mockReturnValue('blob:test');
      URL.revokeObjectURL = vi.fn();
      render({ onExportSingle, selectedModuleId: 'leader-42' });
      await act(async () => {
        click(testId('export-single')!);
      });
      expect(onExportSingle).toHaveBeenCalledWith('leaders', 'leader-42');
    });
  });

  describe('import - drop zone', () => {
    it('renders drop zone', () => {
      render();
      expect(testId('drop-zone')).not.toBeNull();
    });

    it('drop zone text contains instructions', () => {
      render();
      expect(testId('drop-zone')!.textContent).toContain('Drop JSON files');
    });

    it('shows file count and import button after files added via drop', () => {
      render({ onImport: vi.fn().mockResolvedValue([]) });
      const zone = testId('drop-zone')!;
      const file = new File(['{}'], 'test.json', { type: 'application/json' });
      const dataTransfer = { files: [file] } as unknown as DataTransfer;
      act(() => {
        zone.dispatchEvent(Object.assign(new Event('drop', { bubbles: true }), { dataTransfer }));
      });
      // After the drop, the component should show file count
      expect(container.textContent).toContain('1 file(s) selected');
    });
  });

  describe('import - conflict resolution', () => {
    it('shows conflict resolution radio buttons after files selected', () => {
      render({ onImport: vi.fn().mockResolvedValue([]) });
      // Simulate file drop
      const zone = testId('drop-zone')!;
      const file = new File(['{}'], 'test.json', { type: 'application/json' });
      const dataTransfer = { files: [file] } as unknown as DataTransfer;
      act(() => {
        zone.dispatchEvent(Object.assign(new Event('drop', { bubbles: true }), { dataTransfer }));
      });
      expect(testId('conflict-resolution')).not.toBeNull();
      expect(testId('import-btn')).not.toBeNull();
    });
  });

  describe('backups', () => {
    it('shows load backups button', () => {
      render();
      expect(testId('load-backups')).not.toBeNull();
    });

    it('shows empty backups message initially', () => {
      render();
      expect(testId('no-backups')).not.toBeNull();
    });

    it('calls onListBackups when load button clicked', async () => {
      const onListBackups = vi.fn().mockResolvedValue([
        { filename: 'backup-1.zip', timestamp: '2025-01-01', moduleType: 'leaders', moduleCount: 5, sizeBytes: 2048 },
      ]);
      render({ onListBackups });
      await act(async () => {
        click(testId('load-backups')!);
      });
      expect(onListBackups).toHaveBeenCalled();
      expect(testId('backup-backup-1.zip')).not.toBeNull();
    });

    it('shows backup details', async () => {
      const onListBackups = vi.fn().mockResolvedValue([
        { filename: 'backup-2.zip', timestamp: '2025-06-15', moduleType: 'military', moduleCount: 12, sizeBytes: 4096 },
      ]);
      render({ onListBackups });
      await act(async () => {
        click(testId('load-backups')!);
      });
      const entry = testId('backup-backup-2.zip')!;
      expect(entry.textContent).toContain('backup-2.zip');
      expect(entry.textContent).toContain('military');
      expect(entry.textContent).toContain('12 modules');
    });

    it('shows restore button for each backup', async () => {
      const onListBackups = vi.fn().mockResolvedValue([
        { filename: 'bk.zip', timestamp: '2025-01-01', moduleType: 'leaders', moduleCount: 3, sizeBytes: 1024 },
      ]);
      render({ onListBackups });
      await act(async () => {
        click(testId('load-backups')!);
      });
      expect(testId('restore-bk.zip')).not.toBeNull();
    });

    it('calls onRestore when restore button clicked', async () => {
      const onListBackups = vi.fn().mockResolvedValue([
        { filename: 'bk.zip', timestamp: '2025-01-01', moduleType: 'leaders', moduleCount: 3, sizeBytes: 1024 },
      ]);
      const onRestore = vi.fn().mockResolvedValue(undefined);
      render({ onListBackups, onRestore });
      await act(async () => {
        click(testId('load-backups')!);
      });
      await act(async () => {
        click(testId('restore-bk.zip')!);
      });
      expect(onRestore).toHaveBeenCalledWith('bk.zip');
    });
  });

  describe('no callbacks', () => {
    it('renders without export buttons when no handlers', () => {
      render();
      expect(testId('export-single')).toBeNull();
      expect(testId('export-all')).toBeNull();
      expect(testId('export-backup')).toBeNull();
    });
  });
});
