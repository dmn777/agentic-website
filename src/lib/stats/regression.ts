// Least squares for the regression explorable, plus point clouds with a chosen correlation
// for the "guess the r" game.
import type { Rng } from '../random';

export interface Pt { x: number; y: number }
export interface Fit {
  slope: number; intercept: number; r: number; r2: number;
  residuals: number[]; leverage: number[]; xbar: number; ybar: number;
}

export function ols(pts: readonly Pt[]): Fit {
  const n = pts.length;
  const xbar = pts.reduce((a, p) => a + p.x, 0) / n, ybar = pts.reduce((a, p) => a + p.y, 0) / n;
  let sxx = 0, sxy = 0, syy = 0;
  for (const p of pts) { sxx += (p.x - xbar) ** 2; sxy += (p.x - xbar) * (p.y - ybar); syy += (p.y - ybar) ** 2; }
  if (n < 2 || sxx === 0) return { slope: NaN, intercept: NaN, r: NaN, r2: NaN, residuals: pts.map(() => NaN), leverage: pts.map(() => NaN), xbar, ybar };
  const slope = sxy / sxx, intercept = ybar - slope * xbar;
  const r = syy === 0 ? NaN : sxy / Math.sqrt(sxx * syy);
  return {
    slope, intercept, r, r2: r * r, xbar, ybar,
    residuals: pts.map((p) => p.y - (intercept + slope * p.x)),
    leverage: pts.map((p) => 1 / n + (p.x - xbar) ** 2 / sxx),
  };
}

export const pearson = (pts: readonly Pt[]): number => ols(pts).r;

/**
 * n points in [0.05, 0.95]² with correlation ≈ r (or exactly r with `exact`, by
 * orthogonalising the noise against x before mixing).
 */
export function pointsWithCorrelation(n: number, r: number, rng: Rng, opts: { exact?: boolean } = {}): Pt[] {
  const x = Array.from({ length: n }, () => rng.normal());
  let e = Array.from({ length: n }, () => rng.normal());
  const centre = (v: number[]) => { const m = v.reduce((a, b) => a + b, 0) / v.length; return v.map((u) => u - m); };
  const norm = (v: number[]) => Math.sqrt(v.reduce((a, b) => a + b * b, 0));
  let xc = centre(x);
  if (opts.exact) {
    e = centre(e);
    const k = e.reduce((a, v, i) => a + v * xc[i], 0) / xc.reduce((a, v) => a + v * v, 0);
    e = e.map((v, i) => v - k * xc[i]);           // e ⟂ x exactly
    const nx = norm(xc), ne = norm(e);
    xc = xc.map((v) => v / nx); e = e.map((v) => v / ne);
  }
  const y = xc.map((v, i) => r * v + Math.sqrt(1 - r * r) * e[i]);
  const fit = (v: number[]) => { const lo = Math.min(...v), hi = Math.max(...v); return v.map((u) => 0.05 + (0.9 * (u - lo)) / (hi - lo || 1)); };
  const fx = fit(xc), fy = fit(y);                 // affine maps keep r unchanged
  return fx.map((xv, i) => ({ x: xv, y: fy[i] }));
}
