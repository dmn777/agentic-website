import { describe, expect, it } from 'vitest';
import { hashString, mulberry32, rngFrom } from './random';

describe('hashString', () => {
  it('is stable and 32-bit unsigned', () => {
    const h = hashString('lab/art');
    expect(h).toBe(hashString('lab/art'));
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(2 ** 32);
  });
  it('separates nearby strings', () => {
    const hs = new Set(['a', 'b', 'ab', 'ba', 'plate-1', 'plate-2', ''].map(hashString));
    expect(hs.size).toBe(7);
  });
});

describe('mulberry32', () => {
  it('replays the same sequence for the same seed', () => {
    const a = mulberry32(42), b = mulberry32(42);
    for (let i = 0; i < 100; i++) expect(a()).toBe(b());
  });
  it('gives different sequences for different seeds', () => {
    const a = mulberry32(1), b = mulberry32(2);
    const same = Array.from({ length: 20 }, () => a() === b()).filter(Boolean).length;
    expect(same).toBeLessThan(2);
  });
  it('stays in [0, 1) and is roughly uniform', () => {
    const r = mulberry32(7);
    let sum = 0, lo = 1, hi = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) { const x = r(); sum += x; lo = Math.min(lo, x); hi = Math.max(hi, x); }
    expect(lo).toBeGreaterThanOrEqual(0);
    expect(hi).toBeLessThan(1);
    expect(Math.abs(sum / n - 0.5)).toBeLessThan(0.01);
  });
});

describe('rngFrom helpers', () => {
  it('accepts strings or numbers as seeds', () => {
    expect(rngFrom('x').next()).toBe(rngFrom('x').next());
    expect(rngFrom(5).next()).toBe(mulberry32(5)());
  });
  it('range, int and pick respect their bounds', () => {
    const r = rngFrom('bounds');
    for (let i = 0; i < 1000; i++) {
      const x = r.range(-2, 3);
      expect(x).toBeGreaterThanOrEqual(-2);
      expect(x).toBeLessThan(3);
      const k = r.int(1, 6);
      expect(Number.isInteger(k) && k >= 1 && k <= 6).toBe(true);
      expect(['a', 'b', 'c']).toContain(r.pick(['a', 'b', 'c']));
    }
  });
  it('int covers both endpoints', () => {
    const r = rngFrom('ends');
    const seen = new Set(Array.from({ length: 500 }, () => r.int(1, 3)));
    expect([...seen].sort()).toEqual([1, 2, 3]);
  });
  it('normal has mean ≈ 0 and sd ≈ 1', () => {
    const r = rngFrom('gauss');
    const xs = Array.from({ length: 20000 }, () => r.normal());
    const m = xs.reduce((a, b) => a + b) / xs.length;
    const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
    expect(Math.abs(m)).toBeLessThan(0.03);
    expect(Math.abs(sd - 1)).toBeLessThan(0.03);
  });
});
