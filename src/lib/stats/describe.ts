// Descriptive statistics used across the explorables. Plain functions on number arrays.

export const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);
export const mean = (xs: readonly number[]): number => (xs.length ? sum(xs) / xs.length : NaN);

/** Variance with `ddof` degrees of freedom removed: 1 = sample (default), 0 = population. */
export function variance(xs: readonly number[], ddof = 1): number {
  if (xs.length <= ddof) return 0;
  const m = mean(xs);
  return xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - ddof);
}
export const sd = (xs: readonly number[], ddof = 1): number => Math.sqrt(variance(xs, ddof));

/** Quantile with linear interpolation between order statistics (R's type 7). */
export function quantile(xs: readonly number[], q: number): number {
  const s = [...xs].sort((a, b) => a - b);
  const h = (s.length - 1) * q, lo = Math.floor(h), hi = Math.ceil(h);
  return s[lo] + (s[hi] - s[lo]) * (h - lo);
}

export interface Histogram { edges: number[]; counts: number[]; outside: number }

/** Equal-width bins on [lo, hi]; the last bin includes hi. Values outside are counted apart. */
export function histogram(xs: readonly number[], lo: number, hi: number, bins: number): Histogram {
  const w = (hi - lo) / bins;
  const counts = new Array<number>(bins).fill(0);
  let outside = 0;
  for (const x of xs) {
    if (x < lo || x > hi || Number.isNaN(x)) { outside++; continue; }
    counts[Math.min(bins - 1, Math.floor((x - lo) / w))]++;
  }
  return { edges: Array.from({ length: bins + 1 }, (_, i) => lo + i * w), counts, outside };
}

export const normalPdf = (x: number, mu: number, sigma: number): number =>
  Math.exp(-0.5 * ((x - mu) / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI));
