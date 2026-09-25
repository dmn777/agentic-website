import { describe, expect, it } from 'vitest';
import { rngFrom } from '../random';
import { poissonDisk, packCircles, subdivide, marchingSquares, truchet, phyllotaxis, streamlines } from './geometry';

const dist = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

describe('poissonDisk (Bridson)', () => {
  it('keeps every pair at least r apart, inside the box, and fills it', () => {
    const pts = poissonDisk(200, 120, 10, rngFrom('pd'));
    for (let i = 0; i < pts.length; i++) {
      expect(pts[i][0]).toBeGreaterThanOrEqual(0); expect(pts[i][0]).toBeLessThan(200);
      expect(pts[i][1]).toBeGreaterThanOrEqual(0); expect(pts[i][1]).toBeLessThan(120);
      for (let j = i + 1; j < pts.length; j++) expect(dist(pts[i], pts[j])).toBeGreaterThanOrEqual(10 - 1e-9);
    }
    // maximal-ish: area / (r² · ~1.6) points at least
    expect(pts.length).toBeGreaterThan((200 * 120) / (10 * 10 * 2));
  });
  it('is deterministic per seed', () => {
    expect(poissonDisk(100, 100, 8, rngFrom('a'))).toEqual(poissonDisk(100, 100, 8, rngFrom('a')));
  });
  it('supports a variable radius function (density maps)', () => {
    const pts = poissonDisk(200, 100, (x) => (x < 100 ? 4 : 12), rngFrom('var'));
    const left = pts.filter((p) => p[0] < 100).length, right = pts.length - left;
    expect(left).toBeGreaterThan(right * 3);
  });
});

describe('packCircles', () => {
  it('produces non-overlapping circles inside the box', () => {
    const cs = packCircles(300, 200, { attempts: 3000, minR: 2, maxR: 40, gap: 1 }, rngFrom('pack'));
    expect(cs.length).toBeGreaterThan(80);
    for (let i = 0; i < cs.length; i++) {
      const a = cs[i];
      expect(a.x - a.r).toBeGreaterThanOrEqual(-1e-9); expect(a.x + a.r).toBeLessThanOrEqual(300 + 1e-9);
      expect(a.y - a.r).toBeGreaterThanOrEqual(-1e-9); expect(a.y + a.r).toBeLessThanOrEqual(200 + 1e-9);
      for (let j = i + 1; j < cs.length; j++) {
        const b = cs[j];
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(a.r + b.r + 1 - 1e-9);
      }
    }
  });
});

describe('subdivide', () => {
  it('tiles the rectangle exactly: no gaps, no overlaps', () => {
    const rs = subdivide({ x: 0, y: 0, w: 400, h: 300 }, { depth: 6, minSize: 20 }, rngFrom('sub'));
    const area = rs.reduce((a, r) => a + r.w * r.h, 0);
    expect(area).toBeCloseTo(400 * 300, 6);
    expect(rs.every((r) => r.w >= 20 - 1e-9 && r.h >= 20 - 1e-9)).toBe(true);
    // pairwise interiors disjoint
    for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
      const a = rs[i], b = rs[j];
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      expect(ox <= 1e-9 || oy <= 1e-9).toBe(true);
    }
    expect(rs.length).toBeGreaterThan(8);
  });
});

describe('marchingSquares', () => {
  it('traces a circle contour of the right radius from a distance field', () => {
    const N = 41, f = (i: number, j: number) => Math.hypot(i - 20, j - 20); // grid units
    const grid = Array.from({ length: N }, (_, j) => Array.from({ length: N }, (_, i) => f(i, j)));
    const segs = marchingSquares(grid, 10);
    expect(segs.length).toBeGreaterThan(40);
    for (const [[x1, y1], [x2, y2]] of segs) {
      expect(Math.abs(Math.hypot(x1 - 20, y1 - 20) - 10)).toBeLessThan(0.1);
      expect(Math.abs(Math.hypot(x2 - 20, y2 - 20) - 10)).toBeLessThan(0.1);
    }
  });
  it('returns nothing when the level is out of range', () => {
    expect(marchingSquares([[0, 1], [1, 2]], 5)).toEqual([]);
  });
});

describe('truchet', () => {
  it('covers the grid with one tile per cell, orientations 0–3', () => {
    const ts = truchet(10, 6, rngFrom('tr'));
    expect(ts).toHaveLength(60);
    expect(new Set(ts.map((t) => `${t.i},${t.j}`)).size).toBe(60);
    expect(ts.every((t) => [0, 1, 2, 3].includes(t.o))).toBe(true);
  });
});

describe('phyllotaxis', () => {
  it('places point k at radius c·√k and angle k·θ (golden angle by default)', () => {
    const pts = phyllotaxis(500, 4);
    expect(pts).toHaveLength(500);
    const golden = Math.PI * (3 - Math.sqrt(5));
    expect(pts[100].r).toBeCloseTo(4 * Math.sqrt(100), 10);
    expect(pts[100].a).toBeCloseTo(100 * golden, 10);
  });
});

describe('streamlines (evenly spaced, Jobard–Lefer style)', () => {
  const field = (x: number, y: number) => Math.sin(x * 0.02) + Math.cos(y * 0.03);
  it('keeps separate lines at least dsep·0.5 apart and stays in the box', () => {
    const lines = streamlines(240, 160, field, { dsep: 10, step: 2, maxLen: 300 }, rngFrom('sl'));
    expect(lines.length).toBeGreaterThan(10);
    for (const l of lines) for (const [x, y] of l) { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(240); expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(160); }
    // sample points from different lines are not too close
    for (let a = 0; a < lines.length; a++) for (let b = a + 1; b < lines.length; b++)
      for (let i = 0; i < lines[a].length; i += 5) for (let j = 0; j < lines[b].length; j += 5)
        expect(dist(lines[a][i], lines[b][j])).toBeGreaterThanOrEqual(10 * 0.5 - 1e-6);
  });
});
