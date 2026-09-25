// Tests for the Keeling-curve data layer (T8). The strongest check: annual means and
// growth rates computed here from NOAA's *monthly* file must reproduce NOAA's own
// *published* annual files (committed alongside), year by year.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseCO2, parseAnnual, annualMeans, seasonalCycle, decadeGrowth, annualGrowth } from './co2';

const dir = path.resolve(__dirname, '../../data/keeling');
const monthly = parseCO2(fs.readFileSync(path.join(dir, 'co2_mm_mlo.csv'), 'utf8'));
const publishedMeans = parseAnnual(fs.readFileSync(path.join(dir, 'co2_annmean_mlo.csv'), 'utf8'));
const publishedGrowth = parseAnnual(fs.readFileSync(path.join(dir, 'co2_gr_mlo.csv'), 'utf8'));

describe('parseCO2', () => {
  it('reads every monthly row, skipping comments and the header', () => {
    expect(monthly.length).toBe(822);
    expect(monthly[0]).toMatchObject({ year: 1958, month: 3, ppm: 315.71 });
    expect(monthly.at(-1)!.year).toBeGreaterThanOrEqual(2026);
  });
  it('rows are in time order with sane values', () => {
    for (let i = 1; i < monthly.length; i++) expect(monthly[i].t).toBeGreaterThan(monthly[i - 1].t);
    for (const r of monthly) { expect(r.ppm).toBeGreaterThan(300); expect(r.ppm).toBeLessThan(500); }
  });
});

describe('annual means', () => {
  it('reproduce NOAA’s published annual means to the hundredth for every full year', () => {
    const mine = new Map(annualMeans(monthly).map((a) => [a.year, a.value]));
    let compared = 0;
    for (const p of publishedMeans) {
      if (!mine.has(p.year)) continue;
      expect(Math.abs(mine.get(p.year)! - p.value), String(p.year)).toBeLessThanOrEqual(0.011);
      compared++;
    }
    expect(compared).toBeGreaterThanOrEqual(60);
  });
});

describe('annual growth', () => {
  it('tracks NOAA’s published Jan-to-Dec growth rate closely', () => {
    const mine = new Map(annualGrowth(monthly).map((a) => [a.year, a.value]));
    const diffs: number[] = [];
    for (const p of publishedGrowth) if (mine.has(p.year)) diffs.push(Math.abs(mine.get(p.year)! - p.value));
    expect(diffs.length).toBeGreaterThanOrEqual(60);
    // NOAA derives growth from a fitted curve (Thoning et al. 1989); a 5-month window
    // around each turn of the year reproduces it to within 0.2 ppm in every year.
    expect(Math.max(...diffs)).toBeLessThan(0.2);
    expect(diffs.reduce((a, b) => a + b) / diffs.length).toBeLessThan(0.08);
  });
});

describe('seasonal cycle', () => {
  it('peaks in late spring and bottoms out in early autumn, a few ppm apart', () => {
    const c = seasonalCycle(monthly);
    expect(c).toHaveLength(12);
    const peak = c.indexOf(Math.max(...c)) + 1, trough = c.indexOf(Math.min(...c)) + 1;
    expect([4, 5, 6]).toContain(peak);
    expect([9, 10]).toContain(trough);
    expect(Math.max(...c) - Math.min(...c)).toBeGreaterThan(5);
    expect(Math.max(...c) - Math.min(...c)).toBeLessThan(8);
  });
});

describe('decade growth', () => {
  it('averages published growth by decade and rises from the 1960s to the 2010s', () => {
    const d = decadeGrowth(publishedGrowth);
    const g60 = d.find((x) => x.decade === 1960)!.value, g10 = d.find((x) => x.decade === 2010)!.value;
    expect(g60).toBeGreaterThan(0.5); expect(g60).toBeLessThan(1.2);
    expect(g10).toBeGreaterThan(2); expect(g10).toBeLessThan(3);
    expect(g10).toBeGreaterThan(2 * g60);
  });
});
