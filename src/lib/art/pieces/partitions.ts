import { rngFrom } from '../../random';
import { subdivide } from '../geometry';
import { ground, hatchRect, ease } from '../draw';
import type { Piece } from '../types';

export const partitions: Piece = {
  id: 'partitions', title: 'Partitions', seed: 23,
  description: 'A sheet cut in two, and again, and again, until the cuts run out.',
  technique: 'Recursive subdivision',
  params: [
    { key: 'depth', label: 'Cuts deep', min: 2, max: 9, step: 1, value: 7 },
    { key: 'min', label: 'Smallest piece', min: 8, max: 60, step: 1, value: 18, unit: 'px' },
  ],
  make({ w, h, seed, params, pal }) {
    const rng = rngFrom(seed), k = w / 400, m = 14 * k;
    const rects = subdivide({ x: m, y: m, w: w - 2 * m, h: h - 2 * m }, { depth: params.depth, minSize: params.min * k }, rng);
    const fills = rects.map(() => {
      const r = rng.next();
      return r < 0.08 ? 'accent' : r < 0.14 ? 'ochre' : r < 0.2 ? 'teal' : r < 0.44 ? 'hatch' : r < 0.54 ? 'dense' : 'none';
    });
    const angles = rects.map(() => rng.pick([Math.PI / 4, -Math.PI / 4, 0, Math.PI / 2]));
    const draw = (ctx: CanvasRenderingContext2D, p: number) => {
      ground(ctx, pal, w, h);
      const shown = Math.ceil(rects.length * p);
      const g = 2.5 * k;
      for (let i = 0; i < shown; i++) {
        const r = rects[i], f = fills[i];
        const x = r.x + g, y = r.y + g, rw = r.w - 2 * g, rh = r.h - 2 * g;
        if (rw <= 0 || rh <= 0) continue;
        // Everything is drawn with pens: coloured cells are hatched in their colour, never
        // flat-filled (DESIGN.md: vermilion never fills large areas).
        if (f === 'accent' || f === 'ochre' || f === 'teal') { ctx.strokeStyle = pal[f]; ctx.lineWidth = 1.1 * Math.max(1, k * 0.8); hatchRect(ctx, x, y, rw, rh, 2.6 * k, angles[i]); }
        if (f === 'hatch' || f === 'dense') { ctx.strokeStyle = pal.ink; ctx.lineWidth = 0.8 * Math.max(1, k * 0.8); hatchRect(ctx, x, y, rw, rh, (f === 'dense' ? 3 : 6) * k, angles[i]); }
        if (f === 'dense' && rw * rh < 1600 * k * k) { ctx.strokeStyle = pal.ink; hatchRect(ctx, x, y, rw, rh, 3 * k, angles[i] + Math.PI / 2); }
        ctx.strokeStyle = pal.ink; ctx.lineWidth = 1.4 * Math.max(1, k * 0.8);
        ctx.strokeRect(x, y, rw, rh);
      }
    };
    return { still: (ctx) => draw(ctx, 1), frame: (ctx, t) => { draw(ctx, ease(t / 3)); return t < 3; } };
  },
};
