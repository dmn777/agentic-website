import { rngFrom } from '../../random';
import { truchet as tiles } from '../geometry';
import { ground, clamp01 } from '../draw';
import type { Piece } from '../types';

// Smith's quarter-circle Truchet tiles, two-toned: in each tile either the corner
// quarter-discs or the rest is hatched, swapped by checkerboard parity and orientation, so
// the hatched regions join up into continuous meanders.
export const truchet: Piece = {
  id: 'truchet', title: 'Meander', seed: 29,
  description: 'One square tile, turned at random, and the paths that run across the joins.',
  technique: 'Two-colour Truchet tiling',
  params: [
    { key: 'cells', label: 'Tiles across', min: 4, max: 30, step: 1, value: 12 },
    { key: 'line', label: 'Outline weight', min: 0, max: 4, step: 0.5, value: 1.5, unit: 'px' },
  ],
  make({ w, h, seed, params, pal }) {
    // Whole-pixel tiles: fractional tile edges anti-alias the clip boundaries and leave faint
    // seams along every join. The grid is centred; any spare pixels become a paper margin.
    const rng = rngFrom(seed), k = w / 400, s = Math.floor(w / params.cells), rows = Math.ceil(h / s);
    const ox = Math.floor((w - s * params.cells) / 2);
    const ts = tiles(params.cells, rows, rng);
    const flipAt = ts.map(() => rng.range(0.2, 6));   // when each tile turns in the animation
    // Plotter rendering: the "dark" regions are hatched at one global 45° angle (so the
    // hatching runs continuously across tiles) instead of flat-filled.
    const hatchTile = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
      ctx.strokeStyle = pal.ink; ctx.lineWidth = Math.max(0.8, 0.9 * k);
      const gap = 3 * k;
      ctx.beginPath();
      for (let o = -s; o <= 2 * s; o += gap) {
        // lines x + y = const, positioned in global coordinates for continuity
        const c = Math.round((x + y + o) / gap) * gap - x - y;
        ctx.moveTo(x + c, y); ctx.lineTo(x + c - s * 2, y + s * 2);
      }
      ctx.stroke();
    };
    const drawTile = (ctx: CanvasRenderingContext2D, i: number, j: number, o: number, turn: number) => {
      const x = ox + i * s, y = j * s, inkOutside = ((o % 2) ^ ((i + j) % 2)) === 0;
      const rot = ((o % 2) + turn) * Math.PI / 2;
      ctx.save();
      ctx.beginPath(); ctx.rect(x, y, s, s); ctx.clip();
      // The two quarter-discs, in the tile's rotated frame, mapped back to page coordinates.
      const disc = (cx: number, cy: number) => {
        const c = Math.cos(rot), sn = Math.sin(rot), dx = cx - s / 2, dy = cy - s / 2;
        return [x + s / 2 + dx * c - dy * sn, y + s / 2 + dx * sn + dy * c] as const;
      };
      const centres = [disc(0, 0), disc(s, s)];
      ctx.beginPath();
      if (inkOutside) ctx.rect(x, y, s, s);
      for (const [cx, cy] of centres) { ctx.moveTo(cx + s / 2, cy); ctx.arc(cx, cy, s / 2, 0, Math.PI * 2); }
      ctx.clip(inkOutside ? 'evenodd' : 'nonzero');
      hatchTile(ctx, x, y);
      ctx.restore();
      if (params.line > 0) {
        ctx.save(); ctx.beginPath(); ctx.rect(x, y, s, s); ctx.clip();
        ctx.strokeStyle = pal.accent; ctx.lineWidth = params.line * k;
        for (const [cx, cy] of centres) { ctx.beginPath(); ctx.arc(cx, cy, s / 2, 0, Math.PI * 2); ctx.stroke(); }
        ctx.restore();
      }
    };
    const draw = (ctx: CanvasRenderingContext2D, t: number | null) => {
      ground(ctx, pal, w, h);
      ts.forEach((tile, n) => {
        const turn = t === null ? 0 : clamp01((t - flipAt[n]) / 0.5);
        drawTile(ctx, tile.i, tile.j, tile.o, turn);
      });
    };
    return { still: (ctx) => draw(ctx, null), frame: (ctx, t) => { draw(ctx, t); return t < 6.6; } };
  },
};
