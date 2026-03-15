/**
 * CNFL-3701 — File-system backed module store
 *
 * Provides CRUD operations for all model JSON files,
 * including nested directory structures (military/*, markets/*).
 *
 * @module server/services/module-store
 */

import { readdir, readFile, writeFile, mkdir, rename, stat } from 'node:fs/promises';
import { join, relative, basename, extname } from 'node:path';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export interface ModuleRecord {
  [key: string]: unknown;
}

export interface ListOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  subcategory?: string;
}

export interface ListResult {
  items: ModuleRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface StoreError {
  code: 'NOT_FOUND' | 'ALREADY_EXISTS' | 'IO_ERROR' | 'INVALID_INPUT';
  message: string;
}

// Module types that contain sub-directories instead of flat JSON files
const NESTED_MODULES = new Set(['military', 'markets']);

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function isJsonFile(name: string): boolean {
  return extname(name) === '.json' && name !== '_manifest.json';
}

function idFromFilename(name: string): string {
  return basename(name, '.json');
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/** Recursively collect all JSON files (excluding manifests) under a dir. */
async function collectJsonFiles(dir: string, rootDir: string): Promise<Array<{ path: string; subdir: string | null }>> {
  const results: Array<{ path: string; subdir: string | null }> = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory() && !entry.name.startsWith('.')) {
      const sub = await collectJsonFiles(join(dir, entry.name), rootDir);
      results.push(...sub);
    } else if (entry.isFile() && isJsonFile(entry.name)) {
      const rel = relative(rootDir, dir);
      results.push({ path: join(dir, entry.name), subdir: rel || null });
    }
  }
  return results;
}

function matchesSearch(record: ModuleRecord, search: string): boolean {
  const lower = search.toLowerCase();
  const haystack = JSON.stringify(record).toLowerCase();
  return haystack.includes(lower);
}

function compareValues(a: unknown, b: unknown, dir: 'asc' | 'desc'): number {
  const valA = typeof a === 'string' ? a.toLowerCase() : (a as number) ?? 0;
  const valB = typeof b === 'string' ? b.toLowerCase() : (b as number) ?? 0;
  const cmp = valA < valB ? -1 : valA > valB ? 1 : 0;
  return dir === 'desc' ? -cmp : cmp;
}

// ────────────────────────────────────────────────────────────
// Store
// ────────────────────────────────────────────────────────────

export class ModuleStore {
  constructor(private readonly modelsDir: string) {}

  // ── Directory resolution ──

  /** Resolve the base directory for a module type. */
  private moduleDir(moduleType: string): string {
    return join(this.modelsDir, moduleType);
  }

  /** Resolve the file path for a specific record. */
  private async resolveRecordPath(moduleType: string, id: string, subcategory?: string): Promise<string | null> {
    const base = this.moduleDir(moduleType);

    if (NESTED_MODULES.has(moduleType) && subcategory) {
      const path = join(base, subcategory, `${id}.json`);
      return (await exists(path)) ? path : null;
    }

    // Flat module
    const path = join(base, `${id}.json`);
    if (await exists(path)) return path;

    // Search nested dirs if nested module and no subcategory given
    if (NESTED_MODULES.has(moduleType)) {
      const files = await collectJsonFiles(base, base);
      const match = files.find((f) => idFromFilename(basename(f.path)) === id);
      return match?.path ?? null;
    }

    return null;
  }

  // ── CRUD ──

  async list(moduleType: string, opts: ListOptions = {}): Promise<ListResult> {
    const { page = 1, pageSize = 50, search, sortBy = 'name', sortDir = 'asc', subcategory } = opts;
    const base = this.moduleDir(moduleType);

    if (!(await exists(base))) {
      return { items: [], total: 0, page, pageSize, totalPages: 0 };
    }

    let files: Array<{ path: string; subdir: string | null }>;

    if (NESTED_MODULES.has(moduleType) && subcategory) {
      const subDir = join(base, subcategory);
      if (!(await exists(subDir))) {
        return { items: [], total: 0, page, pageSize, totalPages: 0 };
      }
      files = (await readdir(subDir))
        .filter(isJsonFile)
        .map((f) => ({ path: join(subDir, f), subdir: subcategory }));
    } else if (NESTED_MODULES.has(moduleType)) {
      files = await collectJsonFiles(base, base);
    } else {
      const dirEntries = await readdir(base);
      files = dirEntries.filter(isJsonFile).map((f) => ({ path: join(base, f), subdir: null }));
    }

    // Read all records
    let items: ModuleRecord[] = await Promise.all(
      files.map(async (f) => {
        const content = await readFile(f.path, 'utf-8');
        const record = JSON.parse(content) as ModuleRecord;
        if (f.subdir) record._subcategory = f.subdir;
        return record;
      }),
    );

    // Filter
    if (search) {
      items = items.filter((r) => matchesSearch(r, search));
    }

    // Sort
    items.sort((a, b) => compareValues(a[sortBy], b[sortBy], sortDir));

    // Paginate
    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const start = (page - 1) * pageSize;
    const paged = items.slice(start, start + pageSize);

    return { items: paged, total, page, pageSize, totalPages };
  }

  async getById(moduleType: string, id: string, subcategory?: string): Promise<ModuleRecord | null> {
    const filePath = await this.resolveRecordPath(moduleType, id, subcategory);
    if (!filePath) return null;

    const content = await readFile(filePath, 'utf-8');
    const record = JSON.parse(content) as ModuleRecord;

    // Attach subcategory metadata for nested modules
    if (NESTED_MODULES.has(moduleType)) {
      const rel = relative(this.moduleDir(moduleType), filePath);
      const parts = rel.split('/');
      if (parts.length > 1) {
        record._subcategory = parts.slice(0, -1).join('/');
      }
    }

    return record;
  }

  async create(moduleType: string, id: string, data: ModuleRecord, subcategory?: string): Promise<ModuleRecord> {
    const base = this.moduleDir(moduleType);
    const targetDir = subcategory ? join(base, subcategory) : base;
    const filePath = join(targetDir, `${id}.json`);

    if (await exists(filePath)) {
      const err: StoreError = { code: 'ALREADY_EXISTS', message: `Record '${id}' already exists in ${moduleType}` };
      throw Object.assign(new Error(err.message), err);
    }

    await mkdir(targetDir, { recursive: true });

    const record: ModuleRecord = { ...data };
    if (!record['schemaVersion']) record['schemaVersion'] = '1.0.0';

    await writeFile(filePath, JSON.stringify(record, null, 2) + '\n', 'utf-8');

    // Update manifest
    await this.updateManifest(moduleType, subcategory);

    return record;
  }

  async update(moduleType: string, id: string, data: ModuleRecord, subcategory?: string): Promise<ModuleRecord> {
    const filePath = await this.resolveRecordPath(moduleType, id, subcategory);
    if (!filePath) {
      const err: StoreError = { code: 'NOT_FOUND', message: `Record '${id}' not found in ${moduleType}` };
      throw Object.assign(new Error(err.message), err);
    }

    const record: ModuleRecord = { ...data };
    if (!record['schemaVersion']) record['schemaVersion'] = '1.0.0';

    await writeFile(filePath, JSON.stringify(record, null, 2) + '\n', 'utf-8');
    return record;
  }

  async patch(moduleType: string, id: string, partial: ModuleRecord, subcategory?: string): Promise<ModuleRecord> {
    const existing = await this.getById(moduleType, id, subcategory);
    if (!existing) {
      const err: StoreError = { code: 'NOT_FOUND', message: `Record '${id}' not found in ${moduleType}` };
      throw Object.assign(new Error(err.message), err);
    }

    // Remove internal metadata before merge
    delete existing['_subcategory'];

    const merged = deepMerge(existing, partial);
    return this.update(moduleType, id, merged, subcategory);
  }

  async remove(moduleType: string, id: string, subcategory?: string): Promise<void> {
    const filePath = await this.resolveRecordPath(moduleType, id, subcategory);
    if (!filePath) {
      const err: StoreError = { code: 'NOT_FOUND', message: `Record '${id}' not found in ${moduleType}` };
      throw Object.assign(new Error(err.message), err);
    }

    // Soft delete — move to .backups/
    const backupDir = join(this.modelsDir, '.backups', moduleType);
    await mkdir(backupDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = join(backupDir, `${id}_${timestamp}.json`);
    await rename(filePath, backupPath);

    // Update manifest
    const rel = relative(this.moduleDir(moduleType), filePath);
    const parts = rel.split('/');
    const sub = parts.length > 1 ? parts.slice(0, -1).join('/') : undefined;
    await this.updateManifest(moduleType, sub);
  }

  // ── Manifest management ──

  async getManifest(moduleType: string, subcategory?: string): Promise<ModuleRecord | null> {
    const dir = subcategory ? join(this.moduleDir(moduleType), subcategory) : this.moduleDir(moduleType);
    const path = join(dir, '_manifest.json');
    if (!(await exists(path))) return null;
    const content = await readFile(path, 'utf-8');
    return JSON.parse(content) as ModuleRecord;
  }

  async listSubcategories(moduleType: string): Promise<string[]> {
    if (!NESTED_MODULES.has(moduleType)) return [];
    const base = this.moduleDir(moduleType);
    if (!(await exists(base))) return [];
    const entries = await readdir(base, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory() && !e.name.startsWith('.')).map((e) => e.name);
  }

  private async updateManifest(moduleType: string, subcategory?: string): Promise<void> {
    const dir = subcategory ? join(this.moduleDir(moduleType), subcategory) : this.moduleDir(moduleType);
    const manifestPath = join(dir, '_manifest.json');

    const dirEntries = await readdir(dir);
    const jsonFiles = dirEntries.filter(isJsonFile);

    const existingManifest = (await exists(manifestPath))
      ? (JSON.parse(await readFile(manifestPath, 'utf-8')) as ModuleRecord)
      : {};

    const manifest: ModuleRecord = {
      ...existingManifest,
      schemaVersion: '1.0.0',
      collection: subcategory ? `${moduleType}-${subcategory}` : moduleType,
      count: jsonFiles.length,
      files: jsonFiles.sort(),
    };

    await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
  }
}

// ── Deep merge utility ──

function deepMerge(target: ModuleRecord, source: ModuleRecord): ModuleRecord {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const srcVal = source[key];
    const tgtVal = target[key];
    if (
      srcVal !== null &&
      typeof srcVal === 'object' &&
      !Array.isArray(srcVal) &&
      tgtVal !== null &&
      typeof tgtVal === 'object' &&
      !Array.isArray(tgtVal)
    ) {
      result[key] = deepMerge(tgtVal as ModuleRecord, srcVal as ModuleRecord);
    } else {
      result[key] = srcVal;
    }
  }
  return result;
}
