import { rngFrom } from '../../random';
import { noise2D } from '../../plot/noise';
import { streamlines } from '../geometry';
import { ground, polyline, clamp01 } from '../draw';
import type { Piece } from '../types';

export const combed: Piece = {
  id: 'combed', title: 'Combed', seed: 11,
  description: 'Streamlines of a noise field, spaced so that no two ever touch.',
  technique: 'Evenly spaced streamlines',
  params: [
    { key: 'spacing', label: 'Line spacing', min: 5, max: 20, step: 1, value: 8, unit: 'px' },
    { key: 'turbulence', label: 'Turbulence', min: 0.4, max: 3, step: 0.1, value: 1.3 },
  ],
  make({ w, h, seed, params, pal }) {
    const rng = rngFrom(seed), n = noise2D(seed * 7919 + 1), vein = noise2D(seed * 104729 + 3);
    const k = w / 400, sc = (0.0035 * params.turbulence) / k, base = rng.range(0, Math.PI * 2);
    const field = (x: number, y: number) => base + n(x * sc, y * sc) * Math.PI * 1.6;
    const lines = streamlines(w, h, field, { dsep: params.spacing * k, step: 1.6 * k, maxLen: w * 1.4 }, rng);
    const isVein = lines.map((l) => { const m = l[l.length >> 1]; return vein(m[0] * 0.006 / k, m[1] * 0.006 / k) > 0.42; });
    const draw = (ctx: CanvasRenderingContext2D, p: number) => {
      ground(ctx, pal, w, h);
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      lines.forEach((l, i) => {
        ctx.strokeStyle = isVein[i] ? pal.accent : pal.ink;
        ctx.lineWidth = (isVein[i] ? 1.6 : 1) * Math.max(1, k * 0.9);
        polyline(ctx, l, Math.ceil(l.length * p));
      });
    };
    return { still: (ctx) => draw(ctx, 1), frame: (ctx, t) => { draw(ctx, clamp01(t / 3.5)); return t < 3.5; } };
  },
};
