/**
 * New Order: Seeded Pseudo-Random Number Generator (PRNG)
 *
 * Provides deterministic randomness for the simulation engine using the
 * **mulberry32** algorithm — a fast, well-distributed 32-bit PRNG with a
 * tiny memory footprint.
 *
 * All game randomness MUST use this PRNG. Native JS randomness is forbidden
 * in simulation code.
 *
 * @see NFR-402 — The simulation engine shall be deterministic given the same
 * random seed and inputs. Identical inputs produce identical outputs across runs.
 *
 * @module engine/rng
 */

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

/**
 * Serialisable snapshot of the PRNG's internal state.
 *
 * Capturing and restoring this state allows exact replay from any point in
 * the random sequence — essential for save/load and replay features.
 *
 * @see NFR-402
 */
export interface RngState {
  /** The original seed the generator was created with. */
  readonly seed: number;
  /** Current internal state of the mulberry32 algorithm. */
  readonly state: number;
  /** Number of `next()` calls made since construction (for diagnostics). */
  readonly callCount: number;
}

// ─────────────────────────────────────────────────────────
// SeededRandom
// ─────────────────────────────────────────────────────────

/**
 * A seedable pseudo-random number generator using the **mulberry32** algorithm.
 *
 * ### Usage
 * ```ts
 * const rng = new SeededRandom(42);
 * const roll = rng.nextInt(1, 6); // deterministic d6
 * ```
 *
 * ### Determinism guarantee
 * Given the same seed and the same sequence of method calls, the output is
 * identical across runs, platforms, and JS engines.
 *
 * @see NFR-402
 */
export class SeededRandom {
  // ── Private state ──────────────────────────────────────

  /** Current mulberry32 state (mutated on each `next()` call). */
  private _state: number;

  /** Running count of `next()` invocations. */
  private _callCount: number;

  /** Cached spare value for the Box-Muller transform (nextGaussian). */
  private _spareGaussian: number | null = null;

  // ── Public readonly ────────────────────────────────────

  /**
   * The original seed this generator was constructed with.
   * Useful for display, debugging, and logging.
   *
   * @see NFR-402
   */
  readonly seed: number;

  // ── Constructor ────────────────────────────────────────

  /**
   * Create a new deterministic PRNG seeded with the given value.
   *
   * @param seed - Any finite number. Internally converted to a 32-bit
   *   unsigned integer via `>>> 0`.
   *
   * @see NFR-402
   */
  constructor(seed: number) {
    this.seed = seed;
    this._state = seed >>> 0; // coerce to uint32
    this._callCount = 0;
  }

  // ── Core ───────────────────────────────────────────────

  /**
   * Return the next pseudo-random number in **[0, 1)** — a deterministic
   * drop-in replacement for the native JS random function.
   *
   * Uses the **mulberry32** algorithm:
   * - Period: 2³² (full-period)
   * - Quality: passes gjrand and PractRand up to 2³² outputs
   * - Speed: ~1 ns per call in modern engines
   *
   * @returns A float in the half-open interval [0, 1).
   *
   * @see NFR-402
   */
  next(): number {
    // mulberry32 core
    let t = (this._state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const result = ((t ^ (t >>> 14)) >>> 0) / 0x100000000;

    this._callCount++;
    return result;
  }

  // ── Convenience methods ────────────────────────────────

  /**
   * Return a random integer in the **inclusive** range [min, max].
   *
   * @param min - Lower bound (inclusive).
   * @param max - Upper bound (inclusive).
   * @returns An integer `n` where `min <= n <= max`.
   *
   * @see NFR-402
   */
  nextInt(min: number, max: number): number {
    const range = max - min + 1;
    return min + Math.floor(this.next() * range);
  }

  /**
   * Return a random float in the **half-open** range [min, max).
   *
   * @param min - Lower bound (inclusive).
   * @param max - Upper bound (exclusive).
   * @returns A float `f` where `min <= f < max`.
   *
   * @see NFR-402
   */
  nextFloat(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /**
   * Return `true` with the given probability.
   *
   * @param probability - Chance of returning `true`, in [0, 1].
   *   Defaults to `0.5` (fair coin flip).
   * @returns `true` with the specified probability; `false` otherwise.
   *
   * @see NFR-402
   */
  nextBool(probability = 0.5): boolean {
    return this.next() < probability;
  }

  /**
   * Pick a uniformly random element from a non-empty readonly array.
   *
   * @typeParam T - Element type.
   * @param array - A non-empty readonly array.
   * @returns A randomly selected element.
   * @throws {Error} If the array is empty.
   *
   * @see NFR-402
   */
  pick<T>(array: readonly T[]): T {
    if (array.length === 0) {
      throw new Error('Cannot pick from an empty array');
    }
    return array[this.nextInt(0, array.length - 1)]!;
  }

  /**
   * Return a new array with the same elements in a deterministic random
   * order (Fisher-Yates shuffle). The original array is **not** mutated.
   *
   * @typeParam T - Element type.
   * @param array - A readonly array to shuffle.
   * @returns A new shuffled array.
   *
   * @see NFR-402
   */
  shuffle<T>(array: readonly T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i);
      [result[i], result[j]] = [result[j]!, result[i]!];
    }
    return result;
  }

  /**
   * Return a normally-distributed random number using the **Box-Muller**
   * transform. Generates two values per pair of `next()` calls and caches
   * the spare for the subsequent invocation.
   *
   * @param mean - Centre of the distribution. Defaults to `0`.
   * @param stddev - Standard deviation. Defaults to `1`.
   * @returns A normally-distributed random number.
   *
   * @see NFR-402
   */
  nextGaussian(mean = 0, stddev = 1): number {
    if (this._spareGaussian !== null) {
      const spare = this._spareGaussian;
      this._spareGaussian = null;
      return mean + stddev * spare;
    }

    let u: number;
    let v: number;
    let s: number;

    // Marsaglia polar method (variant of Box-Muller)
    do {
      u = this.next() * 2 - 1;
      v = this.next() * 2 - 1;
      s = u * u + v * v;
    } while (s >= 1 || s === 0);

    const mul = Math.sqrt((-2 * Math.log(s)) / s);
    this._spareGaussian = v * mul;
    return mean + stddev * (u * mul);
  }

  // ── State management ───────────────────────────────────

  /**
   * Serialise the generator's internal state so it can be persisted to a
   * save file and later restored with {@link SeededRandom.fromState}.
   *
   * @returns An immutable snapshot of the current RNG state.
   *
   * @see NFR-402
   */
  getState(): RngState {
    return {
      seed: this.seed,
      state: this._state,
      callCount: this._callCount,
    } as const;
  }

  /**
   * Restore a generator from a previously saved {@link RngState}.
   *
   * The returned instance will produce the exact same sequence of values
   * that the original generator would have produced from the point of the
   * snapshot onward.
   *
   * @param state - A state object previously obtained via {@link getState}.
   * @returns A new `SeededRandom` instance positioned at the saved point.
   *
   * @see NFR-402
   */
  static fromState(state: RngState): SeededRandom {
    const rng = new SeededRandom(state.seed);
    rng._state = state.state;
    rng._callCount = state.callCount;
    return rng;
  }

  /**
   * Create an independent copy of this generator with identical internal
   * state. Advancing the clone does **not** affect the original, and
   * vice-versa.
   *
   * @returns A new `SeededRandom` instance with the same state.
   *
   * @see NFR-402
   */
  clone(): SeededRandom {
    return SeededRandom.fromState(this.getState());
  }
}
