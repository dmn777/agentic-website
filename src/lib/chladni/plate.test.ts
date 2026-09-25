import { describe, expect, it } from 'vitest';
import { rngFrom } from '../random';
import { modeShape, MODES, scatter, shake, settle, pitch, meanAmplitude } from './plate';

describe('mode shapes (square-plate approximation)', () => {
  it('antisymmetric modes are zero on the diagonal x = y (a nodal line)', () => {
    const z = modeShape({ n: 1, m: 3, sign: -1 });
    for (let t = 0; t <= 1; t += 0.05) expect(Math.abs(z(t, t))).toBeLessThan(1e-12);
  });
  it('swapping x and y flips the sign for "−" modes and keeps it for "+" modes', () => {
    const minus = modeShape({ n: 2, m: 5, sign: -1 }), plus = modeShape({ n: 2, m: 5, sign: 1 });
    for (const [x, y] of [[0.1, 0.7], [0.33, 0.9], [0.62, 0.05]]) {
      expect(minus(x, y)).toBeCloseTo(-minus(y, x), 12);
      expect(plus(x, y)).toBeCloseTo(plus(y, x), 12);
    }
  });
  it('stays within [−2, 2] and is not identically zero', () => {
    for (const mode of MODES) {
      const z = modeShape(mode);
      let maxAbs = 0;
      for (let i = 0; i <= 40; i++) for (let j = 0; j <= 40; j++) { const v = z(i / 40, j / 40); expect(Math.abs(v)).toBeLessThanOrEqual(2 + 1e-9); maxAbs = Math.max(maxAbs, Math.abs(v)); }
      expect(maxAbs).toBeGreaterThan(0.5);
    }
  });
  it('offers several distinct modes', () => {
    expect(MODES.length).toBeGreaterThanOrEqual(6);
    expect(new Set(MODES.map((m) => `${m.n},${m.m},${m.sign}`)).size).toBe(MODES.length);
    expect(MODES.every((m) => !(m.n === m.m && m.sign === -1))).toBe(true); // that one is identically zero
  });
});

describe('sand', () => {
  it('scatter places n grains uniformly in the unit square, reproducibly', () => {
    const a = scatter(2000, rngFrom('s')), b = scatter(2000, rngFrom('s'));
    expect(a).toEqual(b);
    expect(a.length).toBe(4000); // interleaved x, y
    for (const v of a) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
  });
  it('settles onto the nodal lines: mean |amplitude| under the grains drops sharply', () => {
    const mode = MODES[2], z = modeShape(mode);
    const grains = scatter(3000, rngFrom('sand'));
    const before = meanAmplitude(grains, z);
    settle(grains, z, 400, rngFrom('shake'));
    const after = meanAmplitude(grains, z);
    expect(after).toBeLessThan(before * 0.2);
    for (const v of grains) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
  });
  it('is deterministic for a seed', () => {
    const z = modeShape(MODES[0]);
    const a = scatter(500, rngFrom('d')), b = scatter(500, rngFrom('d'));
    settle(a, z, 50, rngFrom('x')); settle(b, z, 50, rngFrom('x'));
    expect(a).toEqual(b);
  });
  it('shake moves grains further where the plate moves more', () => {
    const z = modeShape({ n: 1, m: 2, sign: -1 });
    const onNode = new Float64Array([0.5, 0.5]); // on the diagonal: amplitude 0
    const offNode = new Float64Array([0.1, 0.9]);
    const a = Float64Array.from(onNode), b = Float64Array.from(offNode);
    shake(a, z, rngFrom('k')); shake(b, z, rngFrom('k'));
    expect(Math.hypot(a[0] - 0.5, a[1] - 0.5)).toBeLessThan(1e-9);
    expect(Math.hypot(b[0] - 0.1, b[1] - 0.9)).toBeGreaterThan(0);
  });
});

describe('pitch', () => {
  it('rises with the mode numbers and stays audible', () => {
    const fs = MODES.map(pitch);
    for (const f of fs) { expect(f).toBeGreaterThan(100); expect(f).toBeLessThan(2000); }
    expect(pitch({ n: 1, m: 2, sign: -1 })).toBeLessThan(pitch({ n: 3, m: 5, sign: -1 }));
  });
  // Guard: walls reflect grains, so sand must not pile up in the corners beyond what the
  // diagonal nodal line itself carries there. (A visual reviewer read the line's widening at
  // the corner saddle as a clump; the measured share showed it is the formula's geometry.)
  it('does not pile sand in the corners beyond the nodal line\'s share', () => {
    for (const mode of MODES) {
      const z = modeShape(mode), g = scatter(4000, rngFrom('corner')); settle(g, z, 380, rngFrom('corner/s'));
      let corner = 0;
      for (let i = 0; i < g.length; i += 2) { const x = g[i], y = g[i + 1]; if ((x < 0.06 || x > 0.94) && (y < 0.06 || y > 0.94)) corner++; }
      // Corners are 1.4% of the area; the diagonal nodal line crossing them allows a little more.
      expect(corner / 4000, `${mode.n}·${mode.m}`).toBeLessThan(0.035);
    }
  }, 30000);
});
