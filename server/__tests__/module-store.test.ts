/**
 * CNFL-3701 — Module Store Unit Tests
 *
 * Tests for the file-system module store service directly
 * (not via HTTP routes).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ModuleStore } from '../services/module-store.js';
import { resolve } from 'node:path';
import { mkdtemp, cp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';

describe('ModuleStore', () => {
  let store: ModuleStore;
  let tempDir: string;

  beforeAll(async () => {
    tempDir = await mkdtemp(resolve(tmpdir(), 'neworder-store-test-'));
    await cp(resolve(__dirname, '..', '..', 'models'), tempDir, { recursive: true });
    store = new ModuleStore(tempDir);
  });

  afterAll(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  // ── List ──

  describe('list()', () => {
    it('lists flat module records', async () => {
      const result = await store.list('leaders');
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.total).toBeGreaterThan(0);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(50);
    });

    it('lists nested module records', async () => {
      const result = await store.list('military');
      expect(result.items.length).toBeGreaterThan(0);
      // Items from multiple subcategories
      const subs = new Set(result.items.map((i) => i._subcategory));
      expect(subs.size).toBeGreaterThan(1);
    });

    it('filters by subcategory', async () => {
      const result = await store.list('military', { subcategory: 'ground' });
      expect(result.total).toBeGreaterThan(0);
      result.items.forEach((i) => expect(i._subcategory).toBe('ground'));
    });

    it('applies search filter', async () => {
      const result = await store.list('leaders', { search: 'Xi Jinping' });
      expect(result.total).toBeGreaterThanOrEqual(1);
      const ids = result.items.map((i) => i.leaderId);
      expect(ids).toContain('xi-jinping');
    });

    it('paginates correctly', async () => {
      const result = await store.list('leaders', { page: 1, pageSize: 2 });
      expect(result.items.length).toBeLessThanOrEqual(2);
      expect(result.pageSize).toBe(2);
      expect(result.totalPages).toBeGreaterThanOrEqual(1);
    });

    it('sorts by field ascending', async () => {
      const result = await store.list('leaders', { sortBy: 'name', sortDir: 'asc' });
      const names = result.items.map((i) => (i.name as string).toLowerCase());
      const sorted = [...names].sort();
      expect(names).toEqual(sorted);
    });

    it('returns empty for nonexistent module', async () => {
      const result = await store.list('nonexistent');
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('returns empty for nonexistent subcategory', async () => {
      const result = await store.list('military', { subcategory: 'spaceship' });
      expect(result.items).toEqual([]);
    });
  });

  // ── getById ──

  describe('getById()', () => {
    it('retrieves a flat record', async () => {
      const record = await store.getById('leaders', 'xi-jinping');
      expect(record).not.toBeNull();
      expect(record!.leaderId).toBe('xi-jinping');
    });

    it('retrieves a nested record with subcategory hint', async () => {
      const record = await store.getById('military', 'm1a2-abrams', 'ground');
      expect(record).not.toBeNull();
      expect(record!.equipmentId).toBe('m1a2-abrams');
    });

    it('retrieves a nested record without subcategory (search)', async () => {
      const record = await store.getById('military', 'm1a2-abrams');
      expect(record).not.toBeNull();
      expect(record!._subcategory).toBe('ground');
    });

    it('returns null for nonexistent record', async () => {
      const record = await store.getById('leaders', 'nonexistent');
      expect(record).toBeNull();
    });
  });

  // ── create ──

  describe('create()', () => {
    it('creates a new record and updates manifest', async () => {
      const id = 'test-create-leader';
      const data = { leaderId: id, name: 'Created Leader' };
      const result = await store.create('leaders', id, data);
      expect(result.leaderId).toBe(id);
      expect(result.schemaVersion).toBe('1.0.0');

      // Verify file exists
      const content = JSON.parse(
        await readFile(resolve(tempDir, 'leaders', `${id}.json`), 'utf-8'),
      );
      expect(content.name).toBe('Created Leader');

      // Verify manifest updated
      const manifest = await store.getManifest('leaders');
      expect(manifest!.files).toContain(`${id}.json`);
    });

    it('throws ALREADY_EXISTS on duplicate', async () => {
      await expect(
        store.create('leaders', 'xi-jinping', { name: 'Dup' }),
      ).rejects.toThrow(/already exists/i);
    });

    it('creates in nested subcategory', async () => {
      const id = 'test-drone-create';
      await store.create('military', id, { equipmentId: id, name: 'Test Drone' }, 'drone');
      const record = await store.getById('military', id, 'drone');
      expect(record!.name).toBe('Test Drone');
    });
  });

  // ── update ──

  describe('update()', () => {
    it('fully replaces a record', async () => {
      const id = 'test-update-leader';
      await store.create('leaders', id, { leaderId: id, name: 'Before', oldField: 'x' });
      const updated = await store.update('leaders', id, { leaderId: id, name: 'After' });
      expect(updated.name).toBe('After');
      expect(updated.oldField).toBeUndefined();
    });

    it('throws NOT_FOUND for missing record', async () => {
      await expect(
        store.update('leaders', 'nonexistent', { name: 'Nope' }),
      ).rejects.toThrow(/not found/i);
    });
  });

  // ── patch ──

  describe('patch()', () => {
    it('merges partial updates', async () => {
      const id = 'test-patch-leader';
      await store.create('leaders', id, {
        leaderId: id,
        name: 'Patch Test',
        psychology: { riskTolerance: 50, paranoia: 30 },
      });

      const patched = await store.patch('leaders', id, {
        psychology: { paranoia: 80 },
        newField: 'added',
      });

      expect(patched.name).toBe('Patch Test');
      expect((patched.psychology as Record<string, number>).riskTolerance).toBe(50);
      expect((patched.psychology as Record<string, number>).paranoia).toBe(80);
      expect(patched.newField).toBe('added');
    });

    it('throws NOT_FOUND for missing record', async () => {
      await expect(
        store.patch('leaders', 'nonexistent', { name: 'Nope' }),
      ).rejects.toThrow(/not found/i);
    });
  });

  // ── remove ──

  describe('remove()', () => {
    it('soft-deletes a record to .backups/', async () => {
      const id = 'test-delete-leader';
      await store.create('leaders', id, { leaderId: id, name: 'Delete Me' });

      await store.remove('leaders', id);

      const record = await store.getById('leaders', id);
      expect(record).toBeNull();
    });

    it('throws NOT_FOUND for missing record', async () => {
      await expect(store.remove('leaders', 'nonexistent')).rejects.toThrow(/not found/i);
    });
  });

  // ── Subcategories ──

  describe('listSubcategories()', () => {
    it('returns subcategories for nested modules', async () => {
      const subs = await store.listSubcategories('military');
      expect(subs).toContain('ground');
      expect(subs).toContain('air');
      expect(subs).toContain('sea');
    });

    it('returns empty for flat modules', async () => {
      const subs = await store.listSubcategories('leaders');
      expect(subs).toEqual([]);
    });
  });

  // ── Manifest ──

  describe('getManifest()', () => {
    it('returns manifest for a module', async () => {
      const manifest = await store.getManifest('leaders');
      expect(manifest).not.toBeNull();
      expect(manifest!.collection).toBe('leaders');
      expect(manifest!.files).toBeInstanceOf(Array);
    });

    it('returns manifest for a subcategory', async () => {
      const manifest = await store.getManifest('military', 'ground');
      expect(manifest).not.toBeNull();
      expect(manifest!.files).toBeInstanceOf(Array);
    });

    it('returns null for nonexistent manifest', async () => {
      const manifest = await store.getManifest('nonexistent');
      expect(manifest).toBeNull();
    });
  });
});
