import { describe, expect, it } from 'vitest';
import { rngFrom } from '../random';
import { POPULATIONS, getPopulation } from './populations';
import { mean, sd } from './describe';

describe('populations', () => {
  it('offers skewed, bimodal and uniform shapes', () => {
    expect(POPULATIONS.map((p) => p.id)).toEqual(expect.arrayContaining(['skewed', 'bimodal', 'uniform']));
  });
  for (const p of POPULATIONS) {
    it(`${p.id}: draws match the stated mean and sd (n = 40 000)`, () => {
      const r = rngFrom('pop-' + p.id);
      const xs = Array.from({ length: 40000 }, () => p.sample(r));
      expect(Math.abs(mean(xs) - p.mean)).toBeLessThan(0.02 * (p.domain[1] - p.domain[0]));
      expect(Math.abs(sd(xs) - p.sd) / p.sd).toBeLessThan(0.03);
      expect(Math.min(...xs)).toBeGreaterThanOrEqual(p.domain[0]);
      expect(Math.max(...xs)).toBeLessThanOrEqual(p.domain[1]);
    });
    it(`${p.id}: the density integrates to ≈ 1 over its domain`, () => {
      const [a, b] = p.domain, N = 4000, h = (b - a) / N;
      let s = 0;
      for (let i = 0; i < N; i++) s += p.pdf(a + (i + 0.5) * h) * h;
      expect(s).toBeCloseTo(1, 2);
    });
  }
  it('is reproducible for a seed', () => {
    const p = getPopulation('skewed');
    const a = rngFrom('same'), b = rngFrom('same');
    expect(Array.from({ length: 10 }, () => p.sample(a))).toEqual(Array.from({ length: 10 }, () => p.sample(b)));
  });
});
