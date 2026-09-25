import { rngFrom } from '../../random';
import { poissonDisk } from '../geometry';
import { ground, clamp01 } from '../draw';
import type { Piece } from '../types';

// A lit sphere drawn only with dots: where the surface is bright the dots sit far apart,
// where it is in shadow they crowd together. The spacing follows the shading.
export const stipple: Piece = {
  id: 'stipple', title: 'Moon', seed: 41,
  description: 'A sphere shaded with nothing but dots, packed closer wherever the light falls away.',
  technique: 'Poisson-disk stippling',
  params: [
    { key: 'fine', label: 'Finest spacing', min: 1.4, max: 5, step: 0.1, value: 1.8, unit: 'px' },
    { key: 'light', label: 'Light from', min: 0, max: 360, step: 5, value: 225, unit: '°' },
  ],
  make({ w, h, seed, params, pal }) {
    const k = w / 400, cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.4;
    const la = (params.light * Math.PI) / 180, L = [Math.cos(la) * 0.7, Math.sin(la) * 0.7, 0.72];
    const shade = (x: number, y: number) => {
      const dx = (x - cx) / R, dy = (y - cy) / R, d2 = dx * dx + dy * dy;
      if (d2 > 1) return -1;
      const nz = Math.sqrt(1 - d2);
      return clamp01(dx * L[0] + dy * L[1] + nz * L[2]);
    };
    // Bright areas stay populated enough (coarse = 4 × fine) for the silhouette to read;
    // outside the sphere the spacing is huge and those points are not drawn at all.
    const fine = params.fine * k, coarse = fine * 4;
    const radius = (x: number, y: number) => { const b = shade(x, y); return b < 0 ? coarse * 2 : fine + (coarse - fine) * Math.pow(b, 1.6); };
    const pts = poissonDisk(w, h, radius, rngFrom(seed));
    const draw = (ctx: CanvasRenderingContext2D, p: number) => {
      ground(ctx, pal, w, h);
      const shown = Math.ceil(pts.length * p);
      for (let i = 0; i < shown; i++) {
        const [x, y] = pts[i], b = shade(x, y);
        if (b < 0) continue;
        ctx.fillStyle = b < 0.06 ? pal.accent : pal.ink;
        ctx.beginPath(); ctx.arc(x, y, 0.95 * Math.max(0.8, k * 0.9), 0, Math.PI * 2); ctx.fill();
      }
    };
    return { still: (ctx) => draw(ctx, 1), frame: (ctx, t) => { draw(ctx, clamp01(t / 3.5)); return t < 3.5; } };
  },
};
