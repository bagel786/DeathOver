/**
 * Mulberry32 — a fast, seedable pseudo-random number generator.
 * Using a seeded PRNG ensures all players see the same chaos events
 * on the daily challenge (same seed → same sequence).
 */

export function mulberry32(seed: number): () => number {
  let s = seed >>> 0; // ensure unsigned 32-bit
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let z = Math.imul(s ^ (s >>> 15), 1 | s);
    z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z;
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Creates a stateful RNG tied to a base seed + a call counter.
 * Call counter increments globally per ball so each ball gets its own
 * sub-sequence that doesn't interfere with previous balls.
 */
export function createGameRng(baseSeed: number, callCount: number) {
  // Derive a per-ball seed from the base seed and call count
  const ballSeed = (baseSeed ^ (callCount * 2654435761)) >>> 0;
  const rng = mulberry32(ballSeed);
  return rng;
}

/**
 * Unseeded RNG for non-deterministic contexts (custom games, UI effects).
 */
export const randomFloat = (): number => Math.random();

/**
 * Pick a random item from an array.
 */
export function randomChoice<T>(arr: T[], rng: () => number = Math.random): T {
  return arr[Math.floor(rng() * arr.length)];
}
