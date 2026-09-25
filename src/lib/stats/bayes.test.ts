import { describe, expect, it } from 'vitest';
import { naturalFrequencies, posterior, BAYES_PRESETS } from './bayes';

describe('Bayes with natural frequencies', () => {
  it('posterior matches Bayes rule (classic 1% / 80% / 9.6% example ≈ 7.8%)', () => {
    // P(D|+) = .8·.01 / (.8·.01 + .096·.99) = .008 / .10304
    expect(posterior({ prior: 0.01, sensitivity: 0.8, specificity: 0.904 })).toBeCloseTo(0.008 / 0.10304, 10);
  });
  it('counts of 1000 people add up and follow the rates', () => {
    const f = naturalFrequencies({ prior: 0.01, sensitivity: 0.9, specificity: 0.91 }, 1000);
    expect(f.truePos + f.falseNeg + f.falsePos + f.trueNeg).toBe(1000);
    expect(f.truePos + f.falseNeg).toBe(10);   // 1% of 1000 have the condition
    expect(f.truePos).toBe(9);                 // 90% of them test positive
    expect(f.falsePos).toBe(89);               // 9% of 990 ≈ 89.1 → 89
    expect(f.trueNeg).toBe(901);
    expect(f.ppvCounts).toBeCloseTo(9 / 98, 10);
  });
  it('rounding never breaks the totals (largest-remainder rounding)', () => {
    for (const prior of [0.001, 0.013, 0.37, 0.5]) for (const s of [0.61, 0.95]) for (const sp of [0.5, 0.999]) {
      const f = naturalFrequencies({ prior, sensitivity: s, specificity: sp }, 1000);
      expect(f.truePos + f.falseNeg + f.falsePos + f.trueNeg).toBe(1000);
      expect(Math.min(f.truePos, f.falseNeg, f.falsePos, f.trueNeg)).toBeGreaterThanOrEqual(0);
    }
  });
  it('exact posterior is reported alongside the counts', () => {
    const f = naturalFrequencies({ prior: 0.001, sensitivity: 0.99, specificity: 0.99 }, 1000);
    expect(f.posterior).toBeCloseTo((0.99 * 0.001) / (0.99 * 0.001 + 0.01 * 0.999), 12);
    expect(f.npv).toBeCloseTo((0.99 * 0.999) / (0.99 * 0.999 + 0.01 * 0.001), 12);
  });
  it('edge cases: prior 0 or 1, and a test that never fires', () => {
    expect(posterior({ prior: 0, sensitivity: 0.9, specificity: 0.9 })).toBe(0);
    expect(posterior({ prior: 1, sensitivity: 0.9, specificity: 0.9 })).toBe(1);
    expect(posterior({ prior: 0.2, sensitivity: 0, specificity: 1 })).toBeNaN(); // nobody tests positive
  });
  it('ships presets with valid parameters', () => {
    expect(BAYES_PRESETS.length).toBeGreaterThanOrEqual(3);
    for (const p of BAYES_PRESETS) for (const v of [p.prior, p.sensitivity, p.specificity]) { expect(v).toBeGreaterThan(0); expect(v).toBeLessThan(1); }
  });
});
