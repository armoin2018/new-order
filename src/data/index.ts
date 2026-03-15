/**
 * Data barrel export — JSON schemas, scenario data, type definitions
 */

// ── Type system (DR-101 through DR-140) ─────────────────────────────────────
export * from './types';

// ── Scenarios ───────────────────────────────────────────────────────────────
export { MARCH_2026_SCENARIO } from './scenarios';

// ── Validation ──────────────────────────────────────────────────────────────
export { validateScenario } from './validation';
export type { ValidationResult } from './validation';
