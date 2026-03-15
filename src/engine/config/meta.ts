/**
 * New Order — Meta Configuration
 *
 * @see NFR-204 — All game formulas configurable via constants
 */

export const metaConfig = {
  /** Maximum number of turns in a standard game. @see NFR-204 */
  MAX_TURNS: 60,
  /** Total number of playable factions. @see NFR-204 */
  FACTIONS_COUNT: 8,
  /** Starting calendar month (1-based). @see NFR-204 */
  STARTING_MONTH: 3,
  /** Starting calendar year. @see NFR-204 */
  STARTING_YEAR: 2026,
} as const;

