// The site's signature motif: a seeded "plotter specimen". A seed string (a page slug, a
// post id…) picks one of several plotter species and its parameters, and the result is
// a list of single-weight strokes, as a pen plotter would draw them. Pure and
// deterministic: the same seed always gives the same drawing (see specimen.test.ts).
import { rngFrom, hashString, type Rng } from '../random';
import { noise2D } from './noise';

export const SPECIES = ['flow', 'contour', 'radial', 'ridge', 'orbit'] as const;
export type Species = (typeof SPECIES)[number];
export type Pen = 'ink' | 'accent';
export interface Stroke { d: string; pen: Pen }
export interface Specimen {
  seed: string;
  species: Species;
  viewBox: [number, number, number, number];
  paths: Stroke[];
}
export interface SpecimenOptions {
  species?: Species;
  width?: number;
  height?: number;
  /** Stroke-count multiplier: 1 for a hero, ~0.4 for a thumbnail. */
  detail?: number;
}

type Pt = [number, number];
const TAU = Math.PI * 2;
const r1 = (v: number) => String(Math.round(v * 10) / 10);

/** Polyline → SVG path data with one decimal ("M0 0 L10 2.3"). */
export function toPath(pts: Pt[], close = false): string {
  return pts.map(([x, y], i) => `${i ? 'L' : 'M'}${r1(x)} ${r1(y)}`).join(' ') + (close ? ' Z' : '');
}

interface Ctx { rng: Rng; noise: (x: number, y: number) => number; W: number; H: number; M: number; detail: number }
type Drawn = { pts: Pt[]; close?: boolean; pen?: Pen }[];

export function specimen(seed: string, opts: SpecimenOptions = {}): Specimen {
  const W = opts.width ?? 400, H = opts.height ?? 400;
  const rng = rngFrom(seed);
  const species = opts.species ?? rng.pick(SPECIES);
  const ctx: Ctx = { rng, noise: noise2D(hashString(seed + '#noise')), W, H, M: Math.min(W, H) * 0.06, detail: opts.detail ?? 1 };
  const drawn = DRAW[species](ctx);
  const clamp = (p: Pt): Pt => [Math.min(W, Math.max(0, p[0])), Math.min(H, Math.max(0, p[1]))];
  const paths = drawn
    .filter((s) => s.pts.length >= 2)
    .map((s) => ({ d: toPath(s.pts.map(clamp), s.close), pen: s.pen ?? ('ink' as Pen) }));
  return { seed, species, viewBox: [0, 0, W, H], paths };
}

/** Mark 1..k random strokes as the accent pen, leaving at least one ink stroke. */
function accent(strokes: Drawn, rng: Rng, k: number): Drawn {
  const idx = strokes.map((_, i) => i).filter((i) => strokes[i].pts.length >= 2);
  for (let n = 0; n < Math.min(k, idx.length - 1); n++) {
    const j = rng.int(0, idx.length - 1);
    strokes[idx.splice(j, 1)[0]].pen = 'accent';
  }
  return strokes;
}

const DRAW: Record<Species, (c: Ctx) => Drawn> = {
  // Flow lines combed through a noisy blob, like fibres in a seed pod.
  flow({ rng, noise, W, H, M, detail }) {
    const cx = W / 2 + rng.range(-0.04, 0.04) * W, cy = H / 2 + rng.range(-0.04, 0.04) * H;
    const R = (Math.min(W, H) / 2 - M) / 1.2 - Math.max(Math.abs(cx - W / 2), Math.abs(cy - H / 2));
    const edge = (a: number) => R * (1 + 0.18 * noise(Math.cos(a) * 1.3 + 10, Math.sin(a) * 1.3 + 10));
    const inside = (x: number, y: number) => Math.hypot(x - cx, y - cy) < edge(Math.atan2(y - cy, x - cx));
    const sc = rng.range(0.004, 0.009), turns = rng.range(0.6, 1.4), base = rng.range(0, TAU);
    const angle = (x: number, y: number) => base + noise(x * sc, y * sc) * TAU * turns;
    const out: Drawn = [];
    const n = Math.round(90 * detail), step = 6, maxSteps = 14;
    for (let i = 0, tries = 0; out.length < n && tries < n * 20; tries++) {
      const x0 = rng.range(cx - R, cx + R), y0 = rng.range(cy - R, cy + R);
      if (!inside(x0, y0)) continue;
      const trace = (dir: 1 | -1) => {
        const pts: Pt[] = [];
        let x = x0, y = y0;
        for (let s = 0; s < maxSteps; s++) {
          const a = angle(x, y);
          x += Math.cos(a) * step * dir; y += Math.sin(a) * step * dir;
          if (!inside(x, y)) break;
          pts.push([x, y]);
        }
        return pts;
      };
      const pts = [...trace(-1).reverse(), [x0, y0] as Pt, ...trace(1)];
      if (pts.length >= 4) { out.push({ pts }); i++; }
    }
    const outline: Pt[] = Array.from({ length: 96 }, (_, k) => {
      const a = (k / 96) * TAU;
      return [cx + Math.cos(a) * edge(a) * 1.04, cy + Math.sin(a) * edge(a) * 1.04];
    });
    return [...accent(out, rng, rng.int(2, 3)), { pts: outline, close: true }];
  },

  // Topographic rings around a drifting centre, like growth rings or an elevation map.
  contour({ rng, noise, W, H, M, detail }) {
    const K = Math.round(18 * detail) + 4, P = 72, amp = 0.22;
    const drift: Pt = [rng.range(-1, 1) * 0.06 * W, rng.range(-1, 1) * 0.06 * H];
    const Rmax = (Math.min(W, H) / 2 - M - Math.max(Math.abs(drift[0]), Math.abs(drift[1]))) / (1 + amp);
    const f = rng.range(0.9, 1.6), ox = rng.range(0, 50), oy = rng.range(0, 50);
    const out: Drawn = [];
    for (let k = 1; k <= K; k++) {
      const t = k / K;
      const cx = W / 2 + drift[0] * (1 - t), cy = H / 2 + drift[1] * (1 - t);
      const rk = Rmax * Math.pow(t, 0.9);
      const pts: Pt[] = Array.from({ length: P }, (_, i) => {
        const a = (i / P) * TAU;
        const r = rk * (1 + amp * noise(Math.cos(a) * f + ox, Math.sin(a) * f + oy + k * 0.12));
        return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
      });
      out.push({ pts, close: true });
    }
    out[Math.round(K * rng.range(0.45, 0.8)) - 1].pen = 'accent';
    return out;
  },

  // Bent spines radiating from a core: urchin, dandelion, burst.
  radial({ rng, noise, W, H, M, detail }) {
    const n = Math.round(140 * detail), R = Math.min(W, H) / 2 - M, cx = W / 2, cy = H / 2;
    const r0 = R * rng.range(0.12, 0.2), bend = rng.range(0.2, 0.7), f = rng.range(1, 2.5);
    const out: Drawn = [];
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * TAU + rng.range(-0.01, 0.01);
      const reach = R * (0.55 + 0.45 * (0.5 + 0.5 * noise(Math.cos(a0) * f + 3, Math.sin(a0) * f + 3)));
      const pts: Pt[] = [];
      for (let s = 0; s <= 9; s++) {
        const r = r0 + (reach - r0) * (s / 9);
        const a = a0 + bend * noise(r * 0.012 + 7, a0 * 2) * (s / 9);
        pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
      }
      out.push({ pts });
    }
    const core: Pt[] = Array.from({ length: 48 }, (_, k) => [cx + Math.cos((k / 48) * TAU) * r0 * 0.85, cy + Math.sin((k / 48) * TAU) * r0 * 0.85]);
    return [...accent(out, rng, 2), { pts: core, close: true }];
  },

  // A ridgeline plot with hidden-line removal (front lines occlude the ones behind).
  ridge({ rng, noise, W, H, M, detail }) {
    const L = Math.round(36 * detail) + 8, P = 60;
    const amp = (H - 2 * M) * rng.range(0.16, 0.24);
    const top = M + amp, bottom = H - M;
    const mid = W / 2 + rng.range(-0.08, 0.08) * W, spread = W * rng.range(0.14, 0.22);
    const xs = Array.from({ length: P }, (_, i) => M + ((W - 2 * M) * i) / (P - 1));
    const horizon = new Array<number>(P).fill(Infinity);
    const lines: Drawn[] = [];
    for (let l = L - 1; l >= 0; l--) { // front (bottom) to back (top)
      const y0 = top + ((bottom - top) * l) / (L - 1);
      const ys = xs.map((x) => {
        const env = Math.exp(-(((x - mid) / spread) ** 2));
        const bump = Math.max(0, noise(x * 0.02 + l * 0.9, l * 0.37)) * env + 0.04 * noise(x * 0.05, l);
        return y0 - amp * bump;
      });
      const segs: Drawn = [];
      let cur: Pt[] = [];
      ys.forEach((y, i) => {
        if (y < horizon[i] - 0.5) cur.push([xs[i], y]);
        else if (cur.length) { segs.push({ pts: cur }); cur = []; }
        horizon[i] = Math.min(horizon[i], y);
      });
      if (cur.length) segs.push({ pts: cur });
      lines.push(segs.filter((s) => s.pts.length >= 2));
    }
    const candidates = lines.filter((segs) => segs.length >= 1 && segs.length <= 4);
    const chosen = candidates.length ? rng.pick(candidates) : lines[0];
    chosen.forEach((s) => (s.pen = 'accent'));
    return lines.flat();
  },

  // A damped harmonograph trace, cut into short strokes so it can be plotted in order.
  // y runs in near-quadrature with x (phase offset π/3..2π/3), so the figure always fills a
  // disc instead of collapsing onto a diagonal (see the non-degeneracy test).
  orbit({ rng, W, H, M, detail }) {
    const N = Math.round(1600 * detail), R = Math.min(W, H) / 2 - M;
    // The second component never shares the first one's frequency: two equal frequencies in
    // anti-phase cancel out and flatten the figure.
    const fa = rng.pick([2, 3]), others = [1, 2, 3].filter((f) => f !== fa);
    const fb = rng.pick(others) + rng.range(-0.015, 0.015);
    const fa2 = fa + rng.range(-0.012, 0.012), fb2 = rng.pick(others) + rng.range(-0.015, 0.015);
    const pa = rng.range(0, TAU), pb = rng.range(0, TAU);
    const qa = pa + rng.pick([1, -1]) * rng.range(Math.PI / 3, (2 * Math.PI) / 3);
    const qb = pb + rng.pick([1, -1]) * rng.range(Math.PI / 3, (2 * Math.PI) / 3);
    const w = rng.range(0.55, 0.75), d = rng.range(0.012, 0.02), T = 90;
    const pts: Pt[] = Array.from({ length: N }, (_, i) => {
      const t = (i / N) * T, e = Math.exp(-d * t);
      return [
        W / 2 + R * e * (w * Math.sin(fa * t + pa) + (1 - w) * Math.sin(fb * t + pb)),
        H / 2 + R * e * (w * Math.sin(fa2 * t + qa) + (1 - w) * Math.sin(fb2 * t + qb)),
      ];
    });
    const out: Drawn = [];
    for (let i = 0; i < N - 1; i += 40) out.push({ pts: pts.slice(i, i + 41) });
    out[Math.floor(out.length * rng.range(0.3, 0.7))].pen = 'accent';
    return out;
  },
};
