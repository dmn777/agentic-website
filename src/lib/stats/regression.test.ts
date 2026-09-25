import { describe, expect, it } from 'vitest';
import { rngFrom } from '../random';
import { ols, pointsWithCorrelation, pearson } from './regression';

const P = (xs: number[], ys: number[]) => xs.map((x, i) => ({ x, y: ys[i] }));

describe('ordinary least squares', () => {
  it('recovers an exact line', () => {
    const f = ols(P([0, 1, 2, 3], [1, 3, 5, 7]));
    expect(f.slope).toBeCloseTo(2, 12);
    expect(f.intercept).toBeCloseTo(1, 12);
    expect(f.r).toBeCloseTo(1, 12);
    expect(f.r2).toBeCloseTo(1, 12);
    expect(f.residuals.every((e) => Math.abs(e) < 1e-12)).toBe(true);
  });
  it('matches a hand-computed fit', () => {
    // x̄=3, ȳ=4, Sxx=10, Sxy=6, Syy=6 → b=0.6, a=2.2, r=6/√60≈0.775, r²=0.6
    const f = ols(P([1, 2, 3, 4, 5], [2, 4, 5, 4, 5]));
    expect(f.slope).toBeCloseTo(0.6, 12);
    expect(f.intercept).toBeCloseTo(2.2, 12);
    expect(f.r).toBeCloseTo(6 / Math.sqrt(10 * 6), 12);
    expect(f.r2).toBeCloseTo(0.6, 12);
    expect(f.residuals.reduce((a, b) => a + b)).toBeCloseTo(0, 12);
  });
  it('leverage h_i = 1/n + (x_i − x̄)²/Sxx, sums to 2, far-x points dominate', () => {
    const f = ols(P([1, 2, 3, 4, 20], [1, 2, 3, 4, 5]));
    const n = 5, xbar = 6, sxx = [1, 2, 3, 4, 20].reduce((a, x) => a + (x - xbar) ** 2, 0);
    expect(f.leverage[4]).toBeCloseTo(1 / n + (20 - xbar) ** 2 / sxx, 12);
    expect(f.leverage.reduce((a, b) => a + b)).toBeCloseTo(2, 12);
    expect(f.leverage[4]).toBeGreaterThan(0.9);
  });
  it('is undefined for fewer than 2 distinct x values', () => {
    expect(ols(P([1, 1, 1], [1, 2, 3])).slope).toBeNaN();
    expect(ols(P([2], [3])).slope).toBeNaN();
  });
  it('pearson agrees with the fit r and is sign-correct', () => {
    const pts = P([1, 2, 3, 4], [8, 6, 5, 1]);
    expect(pearson(pts)).toBeCloseTo(ols(pts).r, 12);
    expect(pearson(pts)).toBeLessThan(0);
  });
});

describe('pointsWithCorrelation (guess-the-r game)', () => {
  it('produces clouds whose sample r is close to the target', () => {
    for (const target of [-0.8, -0.3, 0, 0.5, 0.95]) {
      const pts = pointsWithCorrelation(400, target, rngFrom('r' + target));
      expect(Math.abs(pearson(pts) - target)).toBeLessThan(0.08);
    }
  });
  it('can hit the target exactly for the game (exact mode)', () => {
    const pts = pointsWithCorrelation(40, 0.62, rngFrom('exact'), { exact: true });
    expect(pearson(pts)).toBeCloseTo(0.62, 10);
  });
  it('fits inside the unit square with a margin', () => {
    const pts = pointsWithCorrelation(60, -0.4, rngFrom('box'), { exact: true });
    const eps = 1e-12; // affine rescaling can land a hair past the edge in floating point
    for (const p of pts) { expect(p.x).toBeGreaterThanOrEqual(0.05 - eps); expect(p.x).toBeLessThanOrEqual(0.95 + eps); expect(p.y).toBeGreaterThanOrEqual(0.05 - eps); expect(p.y).toBeLessThanOrEqual(0.95 + eps); }
  });
});
