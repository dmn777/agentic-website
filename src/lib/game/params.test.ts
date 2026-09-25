import { describe, expect, it } from 'vitest';
import { difficulty, paramsAt, loopScore } from './params';

describe('difficulty', () => {
  it('starts at 0, is 0.5 near 139 s, and approaches 1', () => {
    expect(difficulty(0)).toBe(0);
    expect(difficulty(139)).toBeCloseTo(0.5, 2);
    expect(difficulty(300)).toBeCloseTo(0.777, 2);
    expect(difficulty(600)).toBeGreaterThan(0.95);
    expect(difficulty(1e6)).toBeLessThanOrEqual(1);
  });
  it('never decreases', () => {
    let prev = -1;
    for (let t = 0; t < 900; t += 0.5) { const d = difficulty(t); expect(d).toBeGreaterThanOrEqual(prev); prev = d; }
  });
});

describe('paramsAt', () => {
  it('matches the table at both ends', () => {
    expect(paramsAt(0)).toMatchObject({ penSpeed: 170, drain: 2.2, diatomTarget: 9, respawnDelay: 0.8, hazardTarget: 1, hazardSpeed: 45, homing: 0.1 });
    expect(paramsAt(1)).toMatchObject({ penSpeed: 250, drain: 5.5, diatomTarget: 5, respawnDelay: 1.8, hazardTarget: 6, hazardSpeed: 115, homing: 0.6 });
  });
  it('adds a contaminant at each threshold', () => {
    expect([0.2, 0.3, 0.45, 0.5, 0.65, 0.79, 0.8, 0.9].map((d) => paramsAt(d).hazardTarget)).toEqual([1, 2, 2, 3, 4, 4, 5, 6]);
  });
  it('gets harder in every parameter as d rises (monotone)', () => {
    let p = paramsAt(0);
    for (let d = 0.01; d <= 1; d += 0.01) {
      const q = paramsAt(d);
      for (const k of ['penSpeed', 'drain', 'hazardTarget', 'hazardSpeed', 'homing', 'respawnDelay'] as const) expect(q[k]).toBeGreaterThanOrEqual(p[k]);
      expect(q.diatomTarget).toBeLessThanOrEqual(p.diatomTarget);
      p = q;
    }
  });
});

describe('loopScore', () => {
  it('multiplies the sum of points by the number caught', () => {
    expect(loopScore([])).toBe(0);
    expect(loopScore([10])).toBe(10);
    expect(loopScore([10, 10, 10, 10, 10])).toBe(250);
    expect(loopScore([10, 40])).toBe(100);
  });
});
