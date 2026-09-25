import { describe, expect, it } from 'vitest';
import { mean, variance, sd, histogram, normalPdf, quantile } from './describe';

describe('descriptive statistics', () => {
  it('mean, sample variance and sd of a known set', () => {
    const xs = [2, 4, 4, 4, 5, 5, 7, 9];
    expect(mean(xs)).toBe(5);
    expect(variance(xs)).toBeCloseTo(32 / 7, 12); // sample variance (n-1)
    expect(variance(xs, 0)).toBe(4);               // population variance
    expect(sd(xs, 0)).toBe(2);
  });
  it('handles empty and single inputs without NaN surprises', () => {
    expect(mean([])).toBeNaN();
    expect(variance([3])).toBe(0);
  });
  it('quantile uses linear interpolation (type 7)', () => {
    const xs = [1, 2, 3, 4];
    expect(quantile(xs, 0.5)).toBe(2.5);
    expect(quantile(xs, 0)).toBe(1);
    expect(quantile(xs, 1)).toBe(4);
    expect(quantile([3, 1, 2], 0.5)).toBe(2);
  });
});

describe('histogram', () => {
  it('bins values over a fixed range, right edge inclusive, counts sum to n', () => {
    const h = histogram([0, 0.5, 1, 1.5, 2, 2, 3.999, 4], 0, 4, 4);
    expect(h.edges).toEqual([0, 1, 2, 3, 4]);
    expect(h.counts).toEqual([2, 2, 2, 2]);
    expect(h.counts.reduce((a, b) => a + b)).toBe(8);
  });
  it('drops values outside the range and reports them', () => {
    const h = histogram([-1, 0.5, 5], 0, 1, 2);
    expect(h.counts).toEqual([0, 1]);
    expect(h.outside).toBe(2);
  });
});

describe('normalPdf', () => {
  it('peaks at 1/(σ√2π) and is symmetric', () => {
    expect(normalPdf(0, 0, 1)).toBeCloseTo(0.3989422804, 9);
    expect(normalPdf(1.3, 0, 1)).toBeCloseTo(normalPdf(-1.3, 0, 1), 12);
    expect(normalPdf(5, 5, 2)).toBeCloseTo(0.3989422804 / 2, 9);
  });
});
