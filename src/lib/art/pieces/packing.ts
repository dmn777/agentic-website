import { rngFrom } from '../../random';
import { packCircles } from '../geometry';
import { ground, clamp01 } from '../draw';
import type { Piece } from '../types';

export const packing: Piece = {
  id: 'packing', title: 'Packing', seed: 5,
  description: 'Circles dropped at random, each grown until it bumps into a neighbour.',
  technique: 'Greedy circle packing',
  params: [
    { key: 'tries', label: 'Attempts', min: 300, max: 6000, step: 100, value: 2600 },
    { key: 'maxR', label: 'Largest radius', min: 10, max: 90, step: 1, value: 52, unit: 'px' },
  ],
  make({ w, h, seed, params, pal }) {
    const rng = rngFrom(seed), k = w / 400;
    const cs = packCircles(w, h, { attempts: params.tries, minR: 1.6 * k, maxR: params.maxR * k, gap: 2 * k }, rng);
    const style = cs.map((c) => (c.r > 7 * k ? (rng.next() < 0.06 ? 'accent' : 'rings') : rng.next() < 0.15 ? 'ochre' : 'dot'));
    // A focal point: the largest circle is always drawn with the vermilion pen.
    const biggest = cs.reduce((bi, c, i) => (c.r > cs[bi].r ? i : bi), 0);
    if (cs.length) style[biggest] = 'accent';
    const draw = (ctx: CanvasRenderingContext2D, p: number) => {
      ground(ctx, pal, w, h);
      cs.forEach((c, i) => {
        const g = clamp01(p * 1.4 - (i / cs.length) * 0.4 * 1.4);
        if (g <= 0) return;
        const r = c.r * g;
        if (style[i] === 'dot' || style[i] === 'ochre') {
          ctx.fillStyle = style[i] === 'ochre' ? pal.ochre : pal.ink;
          ctx.beginPath(); ctx.arc(c.x, c.y, r * 0.8, 0, Math.PI * 2); ctx.fill();
          return;
        }
        ctx.strokeStyle = style[i] === 'accent' ? pal.accent : pal.ink;
        ctx.lineWidth = Math.max(0.8, k * 0.9);
        for (let rr = r; rr > 1.5 * k; rr -= 3.4 * k) { ctx.beginPath(); ctx.arc(c.x, c.y, rr, 0, Math.PI * 2); ctx.stroke(); }
      });
    };
    return { still: (ctx) => draw(ctx, 1), frame: (ctx, t) => { draw(ctx, clamp01(t / 3)); return t < 3; } };
  },
};
