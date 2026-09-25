import { rngFrom } from '../../random';
import { noise2D } from '../../plot/noise';
import { ground, polyline } from '../draw';
import type { Piece } from '../types';

// Curl noise: the velocity is the 90°-rotated gradient of a noise field, so the flow has
// no sources or sinks and particles swirl instead of bunching up.
export const drift: Piece = {
  id: 'drift', title: 'Drift', seed: 3,
  description: 'Particles carried by an invisible current, each leaving a thread behind.',
  technique: 'Particles in a curl-noise field',
  params: [
    { key: 'count', label: 'Particles', min: 100, max: 2000, step: 50, value: 420 },
    { key: 'swirl', label: 'Swirl scale', min: 0.5, max: 3, step: 0.1, value: 1.4 },
  ],
  make({ w, h, seed, params, pal }) {
    const k = w / 400, n = noise2D(seed * 31 + 7), sc = (0.004 * params.swirl) / k, e = 0.5;
    // The finite-difference gradient carries a factor sc (noise frequency); divide it out so
    // the speed is ~speed px per step whatever the swirl scale.
    const speed = 1.3 * k;
    const vel = (x: number, y: number): [number, number] => {
      const dx = (n((x + e) * sc, y * sc) - n((x - e) * sc, y * sc)) / (2 * e);
      const dy = (n(x * sc, (y + e) * sc) - n(x * sc, (y - e) * sc)) / (2 * e);
      return [(dy / sc) * speed, (-dx / sc) * speed];
    };
    const seedParticles = () => {
      const r = rngFrom(seed);
      return Array.from({ length: params.count }, () => ({ x: r.range(0, w), y: r.range(0, h), life: r.int(40, 160) }));
    };
    const trail = (x: number, y: number, steps: number) => {
      const pts: [number, number][] = [[x, y]];
      for (let i = 0; i < steps; i++) {
        const [vx, vy] = vel(x, y); x += vx; y += vy;
        if (x < 0 || y < 0 || x > w || y > h) break;
        pts.push([x, y]);
      }
      return pts;
    };
    const stillTrails = seedParticles().map((p, i) => ({ pts: trail(p.x, p.y, 110), accent: i % 23 === 0 }));

    // Animated state: advanced to the requested time in fixed steps (deterministic).
    let ps = seedParticles(), simT = 0, respawn = rngFrom(seed * 3 + 1), started = false;
    const STEP = 1 / 60;
    return {
      still(ctx) {
        ground(ctx, pal, w, h);
        ctx.lineCap = 'round';
        ctx.lineWidth = Math.max(0.7, 0.8 * k);
        // Drift is the teal piece: teal threads, vermilion strays, and a dot where each
        // particle ends up.
        for (const t of stillTrails) { ctx.globalAlpha = t.accent ? 0.95 : 0.7; ctx.strokeStyle = t.accent ? pal.accent : pal.teal; polyline(ctx, t.pts); }
        ctx.globalAlpha = 1;
        for (const t of stillTrails) { const e = t.pts[t.pts.length - 1]; ctx.fillStyle = t.accent ? pal.accent : pal.ink; ctx.beginPath(); ctx.arc(e[0], e[1], 1.6 * Math.max(1, k * 0.8), 0, Math.PI * 2); ctx.fill(); }
      },
      frame(ctx, t) {
        if (!started) { ground(ctx, pal, w, h); started = true; }
        ctx.lineCap = 'round';
        ctx.lineWidth = Math.max(0.7, 0.8 * k);
        while (simT < t) {
          simT += STEP;
          ctx.globalAlpha = 0.045; ctx.fillStyle = pal.paperRaised; ctx.fillRect(0, 0, w, h); // fade old trails
          ctx.globalAlpha = 0.8;
          ps.forEach((p, i) => {
            const [vx, vy] = vel(p.x, p.y);
            const nx = p.x + vx, ny = p.y + vy;
            ctx.strokeStyle = i % 23 === 0 ? pal.accent : pal.teal;
            ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(nx, ny); ctx.stroke();
            p.x = nx; p.y = ny; p.life--;
            if (p.life <= 0 || nx < 0 || ny < 0 || nx > w || ny > h) { p.x = respawn.range(0, w); p.y = respawn.range(0, h); p.life = respawn.int(40, 160); }
          });
        }
        ctx.globalAlpha = 1;
        return true;
      },
    };
  },
};
