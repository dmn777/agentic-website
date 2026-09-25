import { describe, expect, it } from 'vitest';
import { specimen, SPECIES, ALL_SPECIES, toPath } from './specimen';

const PATH_RE = /^M-?\d+(\.\d)? -?\d+(\.\d)?( L-?\d+(\.\d)? -?\d+(\.\d)?)*( Z)?$/;

describe('toPath', () => {
  it('formats a polyline with one decimal', () => {
    expect(toPath([[0, 0], [10.04, 2.25], [3, -1.96]])).toBe('M0 0 L10 2.3 L3 -2');
  });
  it('closes when asked', () => {
    expect(toPath([[0, 0], [1, 0], [1, 1]], true)).toBe('M0 0 L1 0 L1 1 Z');
  });
});

describe('specimen', () => {
  it('is deterministic for a seed', () => {
    expect(specimen('lab/art')).toEqual(specimen('lab/art'));
  });
  it('differs between seeds', () => {
    expect(specimen('plate-1').paths).not.toEqual(specimen('plate-2').paths);
  });
  it('can force every species, and each produces a drawing', () => {
    for (const s of ALL_SPECIES) {
      const sp = specimen('species-test', { species: s });
      expect(sp.species).toBe(s);
      expect(sp.paths.length).toBeGreaterThan(5);
    }
  });
  it('spreads seeds over several species', () => {
    const seen = new Set(Array.from({ length: 40 }, (_, i) => specimen('seed-' + i).species));
    expect(seen.size).toBeGreaterThanOrEqual(3);
  });
  it('emits well-formed paths inside the viewBox', () => {
    for (const seed of ['a', 'b', 'c', 'lab/stats', 'home']) {
      const sp = specimen(seed);
      const [, , w, h] = sp.viewBox;
      for (const p of sp.paths) {
        expect(p.d).toMatch(PATH_RE);
        const nums = p.d.replace(/[MLZ]/g, ' ').trim().split(/\s+/).map(Number);
        for (let i = 0; i < nums.length; i += 2) {
          expect(nums[i]).toBeGreaterThanOrEqual(0);
          expect(nums[i]).toBeLessThanOrEqual(w);
          expect(nums[i + 1]).toBeGreaterThanOrEqual(0);
          expect(nums[i + 1]).toBeLessThanOrEqual(h);
        }
      }
    }
  });
  it('uses the accent pen sparingly (1–4 strokes) and ink for the rest', () => {
    for (let i = 0; i < 20; i++) {
      const sp = specimen('pen-' + i);
      const accent = sp.paths.filter((p) => p.pen === 'accent').length;
      expect(accent).toBeGreaterThanOrEqual(1);
      expect(accent).toBeLessThanOrEqual(4);
      expect(sp.paths.every((p) => p.pen === 'accent' || p.pen === 'ink')).toBe(true);
    }
  });
  it('stays within a size budget (small inline SVG)', () => {
    for (let i = 0; i < 20; i++) {
      const sp = specimen('budget-' + i);
      const bytes = sp.paths.reduce((s, p) => s + p.d.length, 0);
      expect(bytes).toBeLessThan(40_000);
    }
  });
  it('honours a detail factor (fewer strokes when smaller)', () => {
    const big = specimen('detail', { detail: 1 });
    const small = specimen('detail', { detail: 0.4 });
    expect(small.paths.length).toBeLessThan(big.paths.length);
  });
  it('never degenerates into a line: every species covers a 2-D area', () => {
    for (const s of ALL_SPECIES) for (let i = 0; i < 25; i++) {
      const sp = specimen(`area-${s}-${i}`, { species: s, detail: 0.6 });
      const nums = sp.paths.flatMap((p) => p.d.replace(/[MLZ]/g, ' ').trim().split(/\s+/).map(Number));
      const xs = nums.filter((_, k) => k % 2 === 0), ys = nums.filter((_, k) => k % 2 === 1);
      const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
      expect(Math.min(w, h) / Math.max(w, h), `${s} #${i}: ${w.toFixed(0)}×${h.toFixed(0)}`).toBeGreaterThan(0.35);
      expect(Math.min(w, h), `${s} #${i} too small`).toBeGreaterThan(sp.viewBox[2] * 0.3);
    }
  });
  it('sg-orbit (the styleguide seed that exposed the bug) is a real figure', () => {
    const sp = specimen('sg-orbit', { species: 'orbit', detail: 0.8 });
    const nums = sp.paths.flatMap((p) => p.d.replace(/[MLZ]/g, ' ').trim().split(/\s+/).map(Number));
    // a straight line would put every point on one diagonal: check the spread off that line
    const xs = nums.filter((_, k) => k % 2 === 0), ys = nums.filter((_, k) => k % 2 === 1);
    const mx = xs.reduce((a, b) => a + b) / xs.length, my = ys.reduce((a, b) => a + b) / ys.length;
    const sxy = xs.reduce((a, x, k) => a + (x - mx) * (ys[k] - my), 0);
    const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0), syy = ys.reduce((a, y) => a + (y - my) ** 2, 0);
    expect(Math.abs(sxy / Math.sqrt(sxx * syy))).toBeLessThan(0.8);
  });
});

// The diatom valve (Pl. VIII, Darkfield) is opt-in: seeds never pick it at random, so
// adding it changed no existing drawing on the site.
describe('valve', () => {
  it('is never picked at random', () => {
    expect(SPECIES).not.toContain('valve');
    expect(ALL_SPECIES).toContain('valve');
    for (let i = 0; i < 300; i++) expect(specimen('rand-' + i).species).not.toBe('valve');
  });
  it('is a round valve: every point inside the circle, with closed rims', () => {
    for (let i = 0; i < 10; i++) {
      const sp = specimen('valve-' + i, { species: 'valve', detail: 0.7 });
      const [, , w, h] = sp.viewBox;
      const R = Math.min(w, h) / 2;
      for (const p of sp.paths) {
        const nums = p.d.replace(/[MLZ]/g, ' ').trim().split(/\s+/).map(Number);
        for (let k = 0; k < nums.length; k += 2) expect(Math.hypot(nums[k] - w / 2, nums[k + 1] - h / 2)).toBeLessThanOrEqual(R + 0.5);
      }
      expect(sp.paths.filter((p) => p.d.endsWith('Z')).length).toBeGreaterThanOrEqual(3);
      expect(sp.paths.length).toBeGreaterThan(150); // rows of areolae, not a sketch
    }
  });
  it('picks out one row of areolae with the accent pen', () => {
    const sp = specimen('valve-accent', { species: 'valve', detail: 0.7 });
    const n = sp.paths.filter((p) => p.pen === 'accent').length;
    expect(n).toBeGreaterThanOrEqual(8);
    expect(n).toBeLessThan(sp.paths.length / 20);
  });
  it('stays within the size budget at full detail', () => {
    const sp = specimen('valve-budget', { species: 'valve', detail: 1 });
    expect(sp.paths.reduce((s, p) => s + p.d.length, 0)).toBeLessThan(40_000);
  });
});
