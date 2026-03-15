/**
 * Scenario Validation — AJV-powered JSON Schema validation for scenario files.
 *
 * Validates scenario definition JSON against the canonical schema (DR-105)
 * before the game engine initializes. Satisfies NFR-602.
 */

import Ajv from 'ajv';
import scenarioSchema from '../schemas/scenario.schema.json';

/**
 * Pre-compiled AJV instance with the scenario schema loaded.
 * Uses draft-07 by default (AJV's built-in).
 */
const ajv = new Ajv({ allErrors: true, verbose: true });
const validate = ajv.compile(scenarioSchema);

/**
 * Validation result returned by `validateScenario`.
 */
export interface ValidationResult {
  /** Whether the data conforms to the scenario schema. */
  valid: boolean;
  /** Human-readable error messages (empty if valid). */
  errors: string[];
}

/**
 * Validate an unknown data object against the New Order scenario schema.
 *
 * @param data - The raw JSON data to validate (typically parsed from a scenario file).
 * @returns A `ValidationResult` indicating success or listing all validation errors.
 *
 * @example
 * ```ts
 * import { validateScenario } from '@/data/validation';
 *
 * const raw = JSON.parse(scenarioJson);
 * const result = validateScenario(raw);
 * if (!result.valid) {
 *   console.error('Invalid scenario:', result.errors);
 * }
 * ```
 */
export function validateScenario(data: unknown): ValidationResult {
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
