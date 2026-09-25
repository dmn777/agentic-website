// Pure geometry for the generative gallery (T7). Every function is seeded through an Rng
// and returns plain data; drawing happens elsewhere. Properties are tested in
// geometry.test.ts (spacing, non-overlap, exact tiling, contour accuracy).
import type { Rng } from '../random';

export type P = [number, number];
const TAU = Math.PI * 2;

/**
 * Poisson-disk sampling (Bridson 2007): points no closer than r, with r optionally varying
 * over the plane (a density map). Accepts a candidate only if it keeps max(r(a), r(b))
 * from every neighbour.
 */
export function poissonDisk(w: number, h: number, r: number | ((x: number, y: number) => number), rng: Rng, k = 30): P[] {
  const R = typeof r === 'number' ? () => r : r;
  let rMin = Infinity, rMax = 0;
  for (let i = 0; i <= 20; i++) for (let j = 0; j <= 20; j++) { const v = R((w * i) / 20, (h * j) / 20); rMin = Math.min(rMin, v); rMax = Math.max(rMax, v); }
  const cell = rMin / Math.SQRT2;
  const gw = Math.ceil(w / cell), gh = Math.ceil(h / cell);
  const grid = new Int32Array(gw * gh).fill(-1);
  const pts: P[] = [], radii: number[] = [], active: number[] = [];
  const reach = Math.ceil(rMax / cell);

  const ok = (x: number, y: number, rx: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return false;
    const gx = Math.floor(x / cell), gy = Math.floor(y / cell);
    for (let j = Math.max(0, gy - reach); j <= Math.min(gh - 1, gy + reach); j++)
      for (let i = Math.max(0, gx - reach); i <= Math.min(gw - 1, gx + reach); i++) {
        const q = grid[j * gw + i];
        if (q >= 0 && Math.hypot(pts[q][0] - x, pts[q][1] - y) < Math.max(rx, radii[q])) return false;
      }
    return true;
  };
  const add = (x: number, y: number) => {
    pts.push([x, y]); radii.push(R(x, y)); active.push(pts.length - 1);
    grid[Math.floor(y / cell) * gw + Math.floor(x / cell)] = pts.length - 1;
  };

  add(rng.range(0, w), rng.range(0, h));
  while (active.length) {
    const ai = rng.int(0, active.length - 1), a = pts[active[ai]], ra = radii[active[ai]];
    let placed = false;
    for (let t = 0; t < k; t++) {
      const ang = rng.range(0, TAU), d = rng.range(ra, 2 * ra);
      const x = a[0] + Math.cos(ang) * d, y = a[1] + Math.sin(ang) * d;
      if (ok(x, y, R(Math.min(Math.max(x, 0), w), Math.min(Math.max(y, 0), h)))) { add(x, y); placed = true; break; }
    }
    if (!placed) active.splice(ai, 1);
  }
  return pts;
}

export interface Circle { x: number; y: number; r: number }

/** Greedy circle packing: random centres, each grown until it touches a neighbour or an edge. */
export function packCircles(w: number, h: number, o: { attempts: number; minR: number; maxR: number; gap: number }, rng: Rng): Circle[] {
  const cs: Circle[] = [];
  for (let t = 0; t < o.attempts; t++) {
    const x = rng.range(0, w), y = rng.range(0, h);
    let r = Math.min(o.maxR, x, y, w - x, h - y);
    for (const c of cs) {
      r = Math.min(r, Math.hypot(c.x - x, c.y - y) - c.r - o.gap);
      if (r < o.minR) break;
    }
    if (r >= o.minR) cs.push({ x, y, r });
  }
  return cs;
}

export interface Rect { x: number; y: number; w: number; h: number; depth: number }

/** Recursive subdivision into an exact tiling of rectangles. Deeper levels stop more often. */
export function subdivide(root: { x: number; y: number; w: number; h: number }, o: { depth: number; minSize: number }, rng: Rng): Rect[] {
  const out: Rect[] = [];
  const go = (r: Rect) => {
    const stop = r.depth >= o.depth || (r.depth > 2 && rng.next() < (r.depth - 2) * 0.13);
    const vertical = r.w / r.h > 1.25 ? true : r.h / r.w > 1.25 ? false : rng.next() < 0.5;
    const len = vertical ? r.w : r.h;
    const t = rng.pick([1 / 3, 1 / 2, 2 / 3, 0.38, 0.62]);
    if (stop || len * Math.min(t, 1 - t) < o.minSize) { out.push(r); return; }
    const d = r.depth + 1;
    if (vertical) { go({ x: r.x, y: r.y, w: r.w * t, h: r.h, depth: d }); go({ x: r.x + r.w * t, y: r.y, w: r.w * (1 - t), h: r.h, depth: d }); }
    else { go({ x: r.x, y: r.y, w: r.w, h: r.h * t, depth: d }); go({ x: r.x, y: r.y + r.h * t, w: r.w, h: r.h * (1 - t), depth: d }); }
  };
  go({ ...root, depth: 0 });
  return out;
}

/**
 * Marching squares: line segments where a scalar grid crosses `level`, in grid coordinates
 * (x = column, y = row), with linear interpolation along cell edges. Saddles are resolved
 * by the cell's centre value.
 */
export function marchingSquares(grid: number[][], level: number): [P, P][] {
  const segs: [P, P][] = [];
  const rows = grid.length, cols = grid[0]?.length ?? 0;
  const lerp = (a: number, b: number) => (level - a) / (b - a);
  for (let j = 0; j < rows - 1; j++) for (let i = 0; i < cols - 1; i++) {
    const v0 = grid[j][i], v1 = grid[j][i + 1], v2 = grid[j + 1][i + 1], v3 = grid[j + 1][i];
    const c = (v0 > level ? 8 : 0) | (v1 > level ? 4 : 0) | (v2 > level ? 2 : 0) | (v3 > level ? 1 : 0);
    if (c === 0 || c === 15) continue;
    const top: P = [i + lerp(v0, v1), j], right: P = [i + 1, j + lerp(v1, v2)];
    const bottom: P = [i + lerp(v3, v2), j + 1], left: P = [i, j + lerp(v0, v3)];
    const centreHigh = (v0 + v1 + v2 + v3) / 4 > level;
    switch (c) {
      case 1: case 14: segs.push([left, bottom]); break;
      case 2: case 13: segs.push([bottom, right]); break;
      case 3: case 12: segs.push([left, right]); break;
      case 4: case 11: segs.push([top, right]); break;
      case 6: case 9: segs.push([top, bottom]); break;
      case 7: case 8: segs.push([left, top]); break;
      case 5: if (centreHigh) { segs.push([left, top]); segs.push([bottom, right]); } else { segs.push([left, bottom]); segs.push([top, right]); } break;
      case 10: if (centreHigh) { segs.push([left, bottom]); segs.push([top, right]); } else { segs.push([left, top]); segs.push([bottom, right]); } break;
    }
  }
  return segs;
}

export interface Tile { i: number; j: number; o: 0 | 1 | 2 | 3 }
export const truchet = (cols: number, rows: number, rng: Rng): Tile[] =>
  Array.from({ length: cols * rows }, (_, k) => ({ i: k % cols, j: Math.floor(k / cols), o: rng.int(0, 3) as Tile['o'] }));

/** Vogel's sunflower model: point k at radius c·√k and angle k·θ (θ = golden angle by default). */
export const phyllotaxis = (n: number, c: number, theta = Math.PI * (3 - Math.sqrt(5))) =>
  Array.from({ length: n }, (_, k) => ({ k, r: c * Math.sqrt(k), a: k * theta }));

/**
 * Evenly spaced streamlines (after Jobard & Lefer 1997). `field` gives a direction angle.
 * New seeds are placed dsep to either side of existing lines; integration stops near
 * other lines (dtest), at the edges, or at maxLen.
 */
export function streamlines(
  w: number, h: number, field: (x: number, y: number) => number,
  o: { dsep: number; step: number; maxLen: number; dtest?: number; minPoints?: number }, rng: Rng,
): P[][] {
  const dtest = o.dtest ?? o.dsep * 0.5, minPts = o.minPoints ?? 6;
  const cell = o.dsep, gw = Math.ceil(w / cell) + 1, gh = Math.ceil(h / cell) + 1;
  const grid: P[][] = Array.from({ length: gw * gh }, () => []);
  const near = (x: number, y: number, d: number) => {
    const gx = Math.floor(x / cell), gy = Math.floor(y / cell);
    for (let j = gy - 1; j <= gy + 1; j++) for (let i = gx - 1; i <= gx + 1; i++) {
      if (i < 0 || j < 0 || i >= gw || j >= gh) continue;
      for (const q of grid[j * gw + i]) if (Math.hypot(q[0] - x, q[1] - y) < d) return true;
    }
    return false;
  };
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x <= w && y <= h;
  const trace = (x0: number, y0: number): P[] => {
    const half = (dir: 1 | -1) => {
      const out: P[] = [];
      let x = x0, y = y0;
      for (let s = 0; s * o.step < o.maxLen / 2; s++) {
        const a = field(x, y);
        x += Math.cos(a) * o.step * dir; y += Math.sin(a) * o.step * dir;
        if (!inside(x, y) || near(x, y, dtest)) break;
        out.push([x, y]);
      }
      return out;
    };
    return [...half(-1).reverse(), [x0, y0] as P, ...half(1)];
  };
  const lines: P[][] = [];
  const addLine = (l: P[]) => { lines.push(l); for (const p of l) grid[Math.floor(p[1] / cell) * gw + Math.floor(p[0] / cell)].push(p); };
  const tryLine = (x: number, y: number) => {
    if (!inside(x, y) || near(x, y, o.dsep)) return;
    const l = trace(x, y);
    if (l.length >= minPts) addLine(l);
  };
  tryLine(rng.range(0, w), rng.range(0, h));
  for (let li = 0; li < lines.length; li++) {
    const l = lines[li];
    for (let k = 0; k < l.length; k += 2) {
      const [x, y] = l[k], a = field(x, y);
      for (const s of [1, -1]) tryLine(x - Math.sin(a) * o.dsep * s, y + Math.cos(a) * o.dsep * s);
    }
    // Fill regions the seeding front never reached.
    if (li === lines.length - 1) for (let t = 0; t < 60; t++) tryLine(rng.range(0, w), rng.range(0, h));
  }
  return lines;
}
