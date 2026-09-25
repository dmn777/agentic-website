import { describe, expect, it } from 'vitest';
import { linearScale, niceTicks, logScale } from './scale';

describe('linearScale', () => {
  it('maps domain to range and inverts', () => {
    const s = linearScale([0, 10], [100, 600]);
    expect(s(0)).toBe(100);
    expect(s(5)).toBe(350);
    expect(s(10)).toBe(600);
    expect(s.invert(350)).toBe(5);
  });
  it('supports reversed ranges (SVG y axes)', () => {
    const y = linearScale([0, 1], [400, 0]);
    expect(y(0)).toBe(400);
    expect(y(1)).toBe(0);
    expect(y.invert(100)).toBeCloseTo(0.75, 12);
  });
  it('clamps on request', () => {
    const s = linearScale([0, 1], [0, 100], true);
    expect(s(2)).toBe(100);
    expect(s(-1)).toBe(0);
  });
});

describe('logScale', () => {
  it('maps decades evenly and inverts', () => {
    const s = logScale([0.001, 1], [0, 300]);
    expect(s(0.001)).toBeCloseTo(0, 10);
    expect(s(0.01)).toBeCloseTo(100, 10);
    expect(s(0.1)).toBeCloseTo(200, 10);
    expect(s.invert(250)).toBeCloseTo(Math.pow(10, -0.5), 10);
  });
});

describe('niceTicks', () => {
  it('chooses 1-2-5 steps covering the domain', () => {
    expect(niceTicks(0, 10, 5)).toEqual([0, 2, 4, 6, 8, 10]);
    expect(niceTicks(0, 1, 5)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
    expect(niceTicks(0, 12, 6)).toEqual([0, 2, 4, 6, 8, 10, 12]);
    expect(niceTicks(-1, 1, 4)).toEqual([-1, -0.5, 0, 0.5, 1]);
  });
  it('returns clean decimals (no 0.30000000000000004)', () => {
    for (const t of niceTicks(0, 0.9, 9)) expect(String(t).length).toBeLessThanOrEqual(4);
  });
  it('handles a degenerate domain', () => {
    expect(niceTicks(3, 3, 5)).toEqual([3]);
  });
});
