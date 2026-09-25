// Small canvas helpers shared by the pieces.
import type { Palette } from './types';

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const ease = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);

export function ground(ctx: CanvasRenderingContext2D, pal: Palette, w: number, h: number) {
  ctx.fillStyle = pal.paperRaised;
  ctx.fillRect(0, 0, w, h);
}

export function polyline(ctx: CanvasRenderingContext2D, pts: readonly (readonly [number, number])[], upto = pts.length) {
  if (upto < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < upto; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
}

/** Parallel hatch lines at `angle` clipped to a rectangle, like a plotter fill. */
export function hatchRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, gap: number, angle = Math.PI / 4) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  const d = Math.hypot(w, h), cx = x + w / 2, cy = y + h / 2, c = Math.cos(angle), s = Math.sin(angle);
  ctx.beginPath();
  for (let o = -d / 2; o <= d / 2; o += gap) {
    ctx.moveTo(cx + c * -d / 2 - s * o, cy + s * -d / 2 + c * o);
    ctx.lineTo(cx + c * d / 2 - s * o, cy + s * d / 2 + c * o);
  }
  ctx.stroke();
  ctx.restore();
}
