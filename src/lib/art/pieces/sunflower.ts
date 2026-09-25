import { rngFrom } from '../../random';
import { phyllotaxis } from '../geometry';
import { ground, clamp01 } from '../draw';
import type { Piece } from '../types';

export const sunflower: Piece = {
  id: 'sunflower', title: 'Divergence', seed: 2,
  description: 'Seeds placed one by one, each turned 137.5° from the last. Move the angle a tenth of a degree and the spirals fall apart.',
  technique: 'Phyllotaxis (Vogel’s model)',
  params: [
    { key: 'angle', label: 'Turn per seed', min: 136.5, max: 138.5, step: 0.01, value: 137.51, unit: '°' },
    { key: 'count', label: 'Seeds', min: 200, max: 2400, step: 50, value: 1100 },
  ],
  make({ w, h, seed, params, pal }) {
    const rng = rngFrom(seed), R = Math.min(w, h) * 0.46;
    const c = R / Math.sqrt(params.count), rot = rng.range(0, Math.PI * 2);
    const pts = phyllotaxis(params.count, c, (params.angle * Math.PI) / 180);
    const jitter = pts.map(() => rng.range(0.85, 1.15));
    const arm = rng.pick([13, 21, 34]);
    const draw = (ctx: CanvasRenderingContext2D, p: number) => {
      ground(ctx, pal, w, h);
      const shown = Math.ceil(pts.length * p);
      for (let i = 0; i < shown; i++) {
        const q = pts[i], a = q.a + rot;
        const size = (0.35 + (q.r / R) * 0.75) * c * 0.55 * jitter[i];
        ctx.fillStyle = i % arm === 0 ? pal.accent : q.r / R > 0.8 ? pal.ochre : pal.ink;
        ctx.beginPath(); ctx.arc(w / 2 + Math.cos(a) * q.r, h / 2 + Math.sin(a) * q.r, Math.max(0.6, size), 0, Math.PI * 2); ctx.fill();
      }
    };
    return { still: (ctx) => draw(ctx, 1), frame: (ctx, t) => { draw(ctx, clamp01(t / 4)); return t < 4; } };
  },
};
