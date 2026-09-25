import { describe, expect, it } from 'vitest';
import { rngFrom } from '../random';
import { getPopulation } from './populations';
import { drawSample, sampleMeans, standardError } from './clt';
import { mean, sd } from './describe';

describe('central limit theorem helpers', () => {
  it('drawSample returns n draws from the population', () => {
    const s = drawSample(getPopulation('uniform'), 25, rngFrom('s'));
    expect(s).toHaveLength(25);
  });
  it('standardError is σ/√n', () => {
    expect(standardError(3, 9)).toBe(1);
    expect(standardError(2, 100)).toBeCloseTo(0.2, 12);
  });
  it('sample means centre on μ with spread σ/√n (skewed population, n = 30)', () => {
    const p = getPopulation('skewed');
    const ms = sampleMeans(p, 30, 5000, rngFrom('clt'));
    expect(ms).toHaveLength(5000);
    expect(Math.abs(mean(ms) - p.mean)).toBeLessThan(0.03 * p.sd);
    expect(Math.abs(sd(ms) - standardError(p.sd, 30)) / standardError(p.sd, 30)).toBeLessThan(0.05);
  });
  it('the means of a skewed population get less skewed as n grows', () => {
    const p = getPopulation('skewed');
    const skew = (xs: number[]) => { const m = mean(xs), s = sd(xs, 0); return xs.reduce((a, x) => a + ((x - m) / s) ** 3, 0) / xs.length; };
    const s2 = skew(sampleMeans(p, 2, 6000, rngFrom('k2')));
    const s50 = skew(sampleMeans(p, 50, 6000, rngFrom('k50')));
    expect(Math.abs(s50)).toBeLessThan(Math.abs(s2) / 3);
  });
});
