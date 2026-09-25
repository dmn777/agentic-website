import { describe, expect, it } from 'vitest';
import { noise2D } from './noise';

describe('noise2D', () => {
  it('is deterministic per seed', () => {
    const a = noise2D(9), b = noise2D(9);
    for (let i = 0; i < 50; i++) expect(a(i * 0.37, i * 0.11)).toBe(b(i * 0.37, i * 0.11));
  });
  it('differs across seeds', () => {
    const a = noise2D(1), b = noise2D(2);
    const diff = Array.from({ length: 50 }, (_, i) => Math.abs(a(i * 0.3, 1.7) - b(i * 0.3, 1.7))).reduce((s, x) => s + x);
    expect(diff).toBeGreaterThan(1);
  });
  it('stays within [-1, 1]', () => {
    const n = noise2D(3);
    for (let i = 0; i < 5000; i++) {
      const v = n(Math.sin(i) * 40, Math.cos(i * 1.3) * 40);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
  it('is continuous: tiny steps give tiny changes', () => {
    const n = noise2D(4);
    for (let i = 0; i < 200; i++) {
      const x = i * 0.173, y = i * 0.091;
      expect(Math.abs(n(x, y) - n(x + 1e-4, y + 1e-4))).toBeLessThan(0.01);
    }
  });
  it('is zero on the integer lattice (gradient noise) and not constant elsewhere', () => {
    const n = noise2D(5);
    expect(Math.abs(n(3, 4))).toBeLessThan(1e-9);
    const vals = new Set(Array.from({ length: 20 }, (_, i) => n(i + 0.5, 0.5).toFixed(4)));
    expect(vals.size).toBeGreaterThan(10);
  });
});
