import { rngFrom } from '../../random';
import { noise2D } from '../../plot/noise';
import { marchingSquares } from '../geometry';
import { ground, clamp01 } from '../draw';
import type { Piece } from '../types';

export const survey: Piece = {
  id: 'survey', title: 'Survey', seed: 17,
  description: 'An island that never existed, mapped in contour lines as if someone had walked it.',
  technique: 'Marching-squares contours',
  params: [
    { key: 'levels', label: 'Contour lines', min: 6, max: 40, step: 1, value: 24 },
    { key: 'rough', label: 'Roughness', min: 0.2, max: 1, step: 0.05, value: 0.55 },
  ],
  make({ w, h, seed, params, pal }) {
    const k = w / 400, cell = 4 * k, cols = Math.ceil(w / cell) + 1, rows = Math.ceil(h / cell) + 1;
    const rng = rngFrom(seed), n = noise2D(seed * 13 + 5);
    const cx = rng.range(0.45, 0.55) * w, cy = rng.range(0.45, 0.55) * h, R = Math.min(w, h) * 0.44;
    const height = (x: number, y: number) => {
      let v = 0, amp = 1, f = 0.006 / k;
      for (let o = 0; o < 4; o++) { v += amp * n(x * f + o * 17, y * f - o * 11); amp *= params.rough; f *= 2.1; }
      const d = Math.hypot((x - cx) / (w / h), y - cy) / R;
      return v * 0.42 + (1 - d * d) * 1.0;            // an island: high middle, sea at the edges
    };
    const grid = Array.from({ length: rows }, (_, j) => Array.from({ length: cols }, (_, i) => height(i * cell, j * cell)));
    const levels = Array.from({ length: params.levels }, (_, i) => -0.1 + (i / (params.levels - 1)) * 1.3);
    const segs = levels.map((lv) => marchingSquares(grid, lv));
    const sea = levels.findIndex((lv) => lv >= 0.15);
    const draw = (ctx: CanvasRenderingContext2D, p: number) => {
      ground(ctx, pal, w, h);
      ctx.lineCap = 'round';
      const shown = Math.ceil(levels.length * p);
      for (let L = 0; L < shown; L++) {
        const index = L % 5 === 0, coast = L === sea;
        ctx.strokeStyle = coast ? pal.accent : L < sea ? pal.teal : pal.ink;
        ctx.lineWidth = (coast ? 2 : index ? 1.5 : 0.8) * Math.max(1, k * 0.85);
        ctx.globalAlpha = L < sea ? 0.7 : 1;
        ctx.beginPath();
        for (const [[x1, y1], [x2, y2]] of segs[L]) { ctx.moveTo(x1 * cell, y1 * cell); ctx.lineTo(x2 * cell, y2 * cell); }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };
    return { still: (ctx) => draw(ctx, 1), frame: (ctx, t) => { draw(ctx, clamp01(t / 3.2)); return t < 3.2; } };
  },
};
