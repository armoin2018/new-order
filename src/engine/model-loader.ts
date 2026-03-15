/**
 * Model Loader Engine — CNFL-2902
 *
 * Runtime loader for external JSON model files stored in `models/`.
 * Validates models against JSON schemas using AJV (Draft 2020-12),
 * caches validated models in memory, and provides typed access
 * to all model collections.
 *
 * All public methods are **pure** or return immutable cached data.
 * The loader is designed to work in both browser (fetch) and
 * test (direct import) environments.
 *
 * @module model-loader
 * @see FR-2400 — Modular Data Architecture
 * @see FR-2401 — Runtime Model Loading
 * @see NFR-106 — Module Loading Performance (<200ms)
 */

import Ajv2020 from 'ajv/dist/2020';
import type {
  ModelCollectionType,
  ModelTypeMap,
  AnyModel,
} from '@/data/types/model.types';

// JSON schema imports
import mbtiSchema from '@/data/schemas/mbti-type.schema.json';
import politicalSystemSchema from '@/data/schemas/political-system.schema.json';
import militaryEquipmentSchema from '@/data/schemas/military-equipment.schema.json';
import technologySchema from '@/data/schemas/technology.schema.json';
import educationSchema from '@/data/schemas/education-type.schema.json';
import populationSchema from '@/data/schemas/population.schema.json';
import religionSchema from '@/data/schemas/religion.schema.json';
import leaderProfileSchema from '@/data/schemas/leader-profile.schema.json';
import stockExchangeSchema from '@/data/schemas/stock-exchange.schema.json';
import stockTickerSchema from '@/data/schemas/stock-ticker.schema.json';
import marketIndexSchema from '@/data/schemas/market-index.schema.json';

// ---------------------------------------------------------------------------
// AJV Instance (Draft 2020-12)
// ---------------------------------------------------------------------------

const ajv = new Ajv2020({ allErrors: true, verbose: true });

/** Pre-compiled validators keyed by collection type. */
const validators: Record<ModelCollectionType, ReturnType<typeof ajv.compile>> = {
  'mbti': ajv.compile(mbtiSchema),
  'political-system': ajv.compile(politicalSystemSchema),
  'military-equipment': ajv.compile(militaryEquipmentSchema),
  'technology': ajv.compile(technologySchema),
  'education': ajv.compile(educationSchema),
  'population': ajv.compile(populationSchema),
  'religion': ajv.compile(religionSchema),
  'leader': ajv.compile(leaderProfileSchema),
  'stock-exchange': ajv.compile(stockExchangeSchema),
  'stock-ticker': ajv.compile(stockTickerSchema),
  'market-index': ajv.compile(marketIndexSchema),
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Result from a validation operation. */
export interface ModelValidationResult {
  /** Whether the model conforms to its schema. */
  readonly valid: boolean;
  /** Human-readable error messages (empty if valid). */
  readonly errors: readonly string[];
}

/** Result from loading a single model. */
export interface ModelLoadResult<T> {
  /** Whether the model was loaded and validated successfully. */
  readonly success: boolean;
  /** The validated model data (undefined if failed). */
  readonly data?: T;
  /** Error message if loading/validation failed. */
  readonly error?: string;
  /** Source path the model was loaded from. */
  readonly source: string;
}

/** Configuration for the model loader. */
export interface ModelLoaderConfig {
  /** Base URL or path prefix for model files. Default: '/models' */
  readonly basePath: string;
  /** Whether to use fetch API (browser) or direct import (test). Default: true */
  readonly useFetch: boolean;
  /** Maximum cache age in ms before refresh. Default: 300_000 (5 min) */
  readonly cacheMaxAge: number;
}

/** Default loader configuration. */
const DEFAULT_CONFIG: ModelLoaderConfig = {
  basePath: '/models',
  useFetch: true,
  cacheMaxAge: 300_000,
};

// ---------------------------------------------------------------------------
// Directory mapping
// ---------------------------------------------------------------------------

/** Maps collection type to its directory path under basePath. */
const COLLECTION_DIRS: Record<ModelCollectionType, string> = {
  'mbti': 'leaders/mbti',
  'political-system': 'political-systems',
  'military-equipment': 'military',
  'technology': 'technology',
  'education': 'education',
  'population': 'population',
  'religion': 'religion',
  'leader': 'leaders',
  'stock-exchange': 'markets/exchanges',
  'stock-ticker': 'markets/tickers',
  'market-index': 'markets/indexes',
};

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
  data: T;
  loadedAt: number;
}

/** In-memory cache for loaded model collections. */
const modelCache = new Map<string, CacheEntry<AnyModel[]>>();
/** In-memory cache for individual models. */
const singleModelCache = new Map<string, CacheEntry<AnyModel>>();

// ---------------------------------------------------------------------------
// FR-2401 — Validate Model
// ---------------------------------------------------------------------------

/**
 * Validate an unknown data object against a specific model schema.
 *
 * @param collectionType - The model collection type to validate against.
 * @param data - The raw JSON data to validate.
 * @returns A validation result with success status and any errors.
 *
 * @example
 * ```ts
 * import { validateModel } from '@/engine/model-loader';
 *
 * const result = validateModel('mbti', rawJson);
 * if (!result.valid) {
 *   console.error('Invalid MBTI model:', result.errors);
 * }
 * ```
 */
export function validateModel(
  collectionType: ModelCollectionType,
  data: unknown,
): ModelValidationResult {
  const validate = validators[collectionType];

  if (!validate) {
    return {
      valid: false,
      errors: [`Unknown collection type: ${collectionType}`],
    };
  }

  const valid = validate(data);

  if (valid) {
    return { valid: true, errors: [] };
  }

  const errors: string[] = (validate.errors ?? []).map((err) => {
    const path = err.instancePath || '/';
    const message = err.message ?? 'unknown error';
    const params = err.params ? ` (${JSON.stringify(err.params)})` : '';
    return `${path}: ${message}${params}`;
  });

  return { valid: false, errors };
}

// ---------------------------------------------------------------------------
// FR-2401 — Load Single Model
// ---------------------------------------------------------------------------

/**
 * Load and validate a single model file by path.
 *
 * @typeParam T - The expected model type.
 * @param collectionType - The model collection type for schema validation.
 * @param filePath - Relative path within the collection directory (e.g., 'intj.json').
 * @param config - Optional loader configuration overrides.
 * @returns A result with the validated model or error details.
 *
 * @example
 * ```ts
 * const result = await loadModel('mbti', 'intj.json');
 * if (result.success) {
 *   console.log(result.data.typeCode); // 'INTJ'
 * }
 * ```
 */
export async function loadModel<K extends ModelCollectionType>(
  collectionType: K,
  filePath: string,
  config: Partial<ModelLoaderConfig> = {},
): Promise<ModelLoadResult<ModelTypeMap[K]>> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const dir = COLLECTION_DIRS[collectionType];
  const fullPath = `${cfg.basePath}/${dir}/${filePath}`;

  // Check cache
  const cacheKey = `${collectionType}:${filePath}`;
  const cached = singleModelCache.get(cacheKey);
  if (cached && Date.now() - cached.loadedAt < cfg.cacheMaxAge) {
    return {
      success: true,
      data: cached.data as ModelTypeMap[K],
      source: fullPath,
    };
  }

  try {
    const response = await fetch(fullPath);

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
        source: fullPath,
      };
    }

    const raw: unknown = await response.json();
    const validation = validateModel(collectionType, raw);

    if (!validation.valid) {
      return {
        success: false,
        error: `Validation failed: ${validation.errors.join('; ')}`,
        source: fullPath,
      };
    }

    const data = raw as ModelTypeMap[K];
    singleModelCache.set(cacheKey, { data, loadedAt: Date.now() });

    return { success: true, data, source: fullPath };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
      source: fullPath,
    };
  }
}

// ---------------------------------------------------------------------------
// FR-2401 — Load Model Collection
// ---------------------------------------------------------------------------

/**
 * Manifest describing available model files in a collection.
 * This should be served from `models/{collection}/_manifest.json`.
 */
export interface ModelManifest {
  readonly files: readonly string[];
}

/**
 * Load all models from a collection using a manifest file.
 *
 * The manifest is expected at `{basePath}/{collectionDir}/_manifest.json`
 * and contains a `files` array listing all JSON model filenames.
 *
 * @typeParam K - The collection type key.
 * @param collectionType - The model collection type to load.
 * @param config - Optional loader configuration overrides.
 * @returns An array of successfully loaded models and any errors.
 *
 * @example
 * ```ts
 * const { models, errors } = await loadModels('mbti');
 * console.log(`Loaded ${models.length} MBTI profiles`);
 * ```
 */
export async function loadModels<K extends ModelCollectionType>(
  collectionType: K,
  config: Partial<ModelLoaderConfig> = {},
): Promise<{
  readonly models: readonly ModelTypeMap[K][];
  readonly errors: readonly { file: string; error: string }[];
}> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const dir = COLLECTION_DIRS[collectionType];

  // Check cache
  const cacheKey = `collection:${collectionType}`;
  const cached = modelCache.get(cacheKey);
  if (cached && Date.now() - cached.loadedAt < cfg.cacheMaxAge) {
    return {
      models: cached.data as ModelTypeMap[K][],
      errors: [],
    };
  }

  // Load manifest
  const manifestPath = `${cfg.basePath}/${dir}/_manifest.json`;
  let manifest: ModelManifest;
  try {
    const res = await fetch(manifestPath);
    if (!res.ok) {
      return {
        models: [],
        errors: [{ file: '_manifest.json', error: `HTTP ${res.status}: ${res.statusText}` }],
      };
    }
    manifest = (await res.json()) as ModelManifest;
  } catch (err) {
    return {
      models: [],
      errors: [{
        file: '_manifest.json',
        error: err instanceof Error ? err.message : String(err),
      }],
    };
  }

  // Load each model
  const models: ModelTypeMap[K][] = [];
  const errors: { file: string; error: string }[] = [];

  const results = await Promise.allSettled(
    manifest.files.map((file) => loadModel(collectionType, file, config)),
  );

  for (let i = 0; i < results.length; i++) {
    const result = results[i]!;
    const file = manifest.files[i]!;

    if (result.status === 'fulfilled' && result.value.success && result.value.data) {
      models.push(result.value.data);
    } else if (result.status === 'fulfilled' && !result.value.success) {
      errors.push({ file, error: result.value.error ?? 'Unknown error' });
    } else if (result.status === 'rejected') {
      errors.push({ file, error: String(result.reason) });
    }
  }

  // Cache the collection
  modelCache.set(cacheKey, { data: models as AnyModel[], loadedAt: Date.now() });

  return { models, errors };
}

// ---------------------------------------------------------------------------
// FR-2401 — List Models
// ---------------------------------------------------------------------------

/**
 * List available model files for a collection by fetching its manifest.
 *
 * @param collectionType - The model collection type.
 * @param config - Optional loader configuration overrides.
 * @returns Array of available file names, or empty if manifest not found.
 */
export async function listModels(
  collectionType: ModelCollectionType,
  config: Partial<ModelLoaderConfig> = {},
): Promise<readonly string[]> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const dir = COLLECTION_DIRS[collectionType];
  const manifestPath = `${cfg.basePath}/${dir}/_manifest.json`;

  try {
    const res = await fetch(manifestPath);
    if (!res.ok) return [];
    const manifest = (await res.json()) as ModelManifest;
    return manifest.files;
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Cache Management
// ---------------------------------------------------------------------------

/**
 * Clear all cached models. Useful when models are updated at runtime.
 */
export function clearModelCache(): void {
  modelCache.clear();
  singleModelCache.clear();
}

/**
 * Clear cache for a specific collection type.
 *
 * @param collectionType - The collection type to clear.
 */
export function clearCollectionCache(collectionType: ModelCollectionType): void {
  const collectionKey = `collection:${collectionType}`;
  modelCache.delete(collectionKey);

  // Clear individual model caches for this collection
  for (const key of singleModelCache.keys()) {
    if (key.startsWith(`${collectionType}:`)) {
      singleModelCache.delete(key);
    }
  }
}

/**
 * Get cache statistics for monitoring.
 *
 * @returns Object with cache sizes and entry count per collection.
 */
export function getCacheStats(): {
  readonly collectionsCached: number;
  readonly modelsCached: number;
  readonly collections: Record<string, number>;
} {
  const collections: Record<string, number> = {};
  for (const [key, entry] of modelCache.entries()) {
    const name = key.replace('collection:', '');
    collections[name] = entry.data.length;
  }

  return {
    collectionsCached: modelCache.size,
    modelsCached: singleModelCache.size,
    collections,
  };
}
