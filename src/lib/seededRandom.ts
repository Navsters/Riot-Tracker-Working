/** Deterministic RNG from a numeric seed — same Riot ID string maps to repeatable mock history. */

export function hashString(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function createSeededRandom(seed: number): () => number {
  let state = seed % 4294967291 || 1;
  return () => {
    state = Math.imul(48271, state) % 2147483647;
    return (state - 1) / 2147483646;
  };
}
