// Seeded randomness shared by the plotter motif, the stats explorables, the art gallery
// and the game. Everything that must be reproducible takes a seed; nothing here touches
// Math.random.

/** FNV-1a 32-bit hash with a final avalanche mix; stable across runs and platforms. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Mulberry32: a tiny, fast 32-bit PRNG. Returns floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform float in [lo, hi). */
  range(lo: number, hi: number): number;
  /** Uniform integer in [lo, hi], both ends included. */
  int(lo: number, hi: number): number;
  pick<T>(xs: readonly T[]): T;
  /** Standard normal draw (Box–Muller). */
  normal(): number;
}

export function rngFrom(seed: string | number): Rng {
  const next = mulberry32(typeof seed === 'number' ? seed : hashString(seed));
  let spare: number | null = null;
  return {
    next,
    range: (lo, hi) => lo + (hi - lo) * next(),
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: (xs) => xs[Math.floor(next() * xs.length)],
    normal() {
      if (spare !== null) { const s = spare; spare = null; return s; }
      let u = 0;
      while (u === 0) u = next();
      const v = next();
      const r = Math.sqrt(-2 * Math.log(u));
      spare = r * Math.sin(2 * Math.PI * v);
      return r * Math.cos(2 * Math.PI * v);
    },
  };
}
