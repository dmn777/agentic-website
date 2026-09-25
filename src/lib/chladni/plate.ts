// Chladni figures (T10). A textbook approximation for a square plate: the shape of a mode
// is z(x, y) = cos(nπx)·cos(mπy) + sign·cos(mπx)·cos(nπy) on the unit square. Sand
// grains are kicked in random directions by an amount proportional to |z| under them, so
// they wander off the moving regions and come to rest where the plate stays still: the
// nodal lines. This is the qualitative mechanism, not a solution of the free-plate
// equations (DESIGN.md §Page records says so on the page too).
import type { Rng } from '../random';

export interface Mode { n: number; m: number; sign: 1 | -1 }

/** A hand-picked set of modes with clear, varied figures (n ≠ m for "−" modes). */
export const MODES: Mode[] = [
  { n: 1, m: 2, sign: -1 },
  { n: 1, m: 3, sign: 1 },
  { n: 2, m: 3, sign: -1 },
  { n: 1, m: 4, sign: -1 },
  { n: 2, m: 5, sign: 1 },
  { n: 3, m: 4, sign: -1 },
  { n: 3, m: 5, sign: 1 },
  { n: 2, m: 7, sign: -1 },
];

export function modeShape({ n, m, sign }: Mode): (x: number, y: number) => number {
  const pn = Math.PI * n, pm = Math.PI * m;
  return (x, y) => Math.cos(pn * x) * Math.cos(pm * y) + sign * Math.cos(pm * x) * Math.cos(pn * y);
}

/** n grains, interleaved as [x0, y0, x1, y1, …] in the unit square. */
export function scatter(n: number, rng: Rng): Float64Array {
  const g = new Float64Array(2 * n);
  for (let i = 0; i < g.length; i++) g[i] = rng.next();
  return g;
}

/**
 * One vibration tick. Each grain hops in a random direction, farther where the plate moves
 * more (|z|), and drifts slightly down the slope of |z|: on average, grains are thrown away
 * from the parts that move most. Pure hopping also settles, but too slowly to watch; the
 * drift makes the figure appear in a few seconds. A grain on a nodal line (z = 0) stays put.
 */
export function shake(g: Float64Array, z: (x: number, y: number) => number, rng: Rng, strength = 0.012, drift = 0.0018, floor = 0.09): void {
  const h = 1e-3;
  for (let i = 0; i < g.length; i += 2) {
    const x = g[i], y = g[i + 1];
    const a0 = Math.abs(z(x, y));
    if (a0 === 0) continue;
    // A small floor keeps grains near a node jittering, so the lines stay sandy, not hairlines.
    const a = a0 + floor;
    const gx = (Math.abs(z(x + h, y)) - Math.abs(z(x - h, y))) / (2 * h);
    const gy = (Math.abs(z(x, y + h)) - Math.abs(z(x, y - h))) / (2 * h);
    const ang = rng.next() * Math.PI * 2, d = strength * a;
    // Edges reflect instead of clamping: clamped grains pile up against the walls and
    // especially in the corners, which read as an unsettled clump.
    g[i] = reflect(x + Math.cos(ang) * d - drift * gx * a0);
    g[i + 1] = reflect(y + Math.sin(ang) * d - drift * gy * a0);
  }
}

const reflect = (v: number): number => (v < 0 ? Math.min(1, -v) : v > 1 ? Math.max(0, 2 - v) : v);

export function settle(g: Float64Array, z: (x: number, y: number) => number, ticks: number, rng: Rng): void {
  for (let t = 0; t < ticks; t++) shake(g, z, rng);
}

export function meanAmplitude(g: Float64Array, z: (x: number, y: number) => number): number {
  let s = 0;
  for (let i = 0; i < g.length; i += 2) s += Math.abs(z(g[i], g[i + 1]));
  return s / (g.length / 2);
}

/**
 * An illustrative pitch for a mode, rising with n² + m² (as plate frequencies do), mapped
 * into a comfortable audible range. Not the frequency of any real plate.
 */
export const pitch = ({ n, m }: Mode): number => 110 * Math.pow(n * n + m * m, 0.6);
