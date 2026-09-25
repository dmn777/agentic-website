// Darkfield's Canvas 2D renderer (GAME_DESIGN.md §Art direction). It draws the state; it
// never changes it. Colours are fixed: the slide is the same dark field in both site
// themes. Effects (loop flashes, snap fragments, shake) are driven by the events a tick
// emits, and are skipped under reduced motion.
import { R, SPECIES, type Game, type GameEvent, type Species } from './sim';
import type { Vec } from './geometry';

// Drawn art, not interface: these are the slide's own colours (DESIGN.md allows raw
// values in generated art).
export const COLORS = {
  slide: '#04070b', lit: '#0d1a28', rim: '#27435a', reticle: 'rgba(150, 200, 225, 0.09)',
  glass: '#d4eef4', glow: 'rgba(110, 215, 255, 0.55)', ink: '#ff6a48', inkDim: 'rgba(255, 106, 72, 0.35)',
  hazard: '#ffb347', hazardGlow: 'rgba(255, 170, 60, 0.6)', label: 'rgba(212, 238, 244, 0.55)',
};

interface Effect { kind: 'loop' | 'snap' | 'rim'; born: number; poly?: Vec[]; pts?: { x: number; y: number; vx: number; vy: number; a: number }[]; x?: number; y?: number; text?: string }

export interface Renderer {
  resize(cssSize: number, dpr: number): void;
  /** Screen (CSS px, relative to the canvas) → world units. */
  toWorld(px: number, py: number): Vec;
  events(evts: GameEvent[], now: number): void;
  draw(g: Game, now: number): void;
}

export function createRenderer(canvas: HTMLCanvasElement, opts: { reducedMotion: () => boolean }): Renderer {
  const ctx = canvas.getContext('2d')!;
  let size = 600, dpr = 1, scale = size / (2 * R + 40);
  const sprites = new Map<Species, HTMLCanvasElement>();
  let effects: Effect[] = [];
  let shakeUntil = 0;

  function buildSprites() {
    sprites.clear();
    for (const kind of Object.keys(SPECIES) as Species[]) {
      const r = SPECIES[kind].r * scale * dpr;
      const pad = Math.ceil(r * 0.9 + 6 * dpr);
      const c = document.createElement('canvas');
      c.width = c.height = Math.ceil(2 * r + 2 * pad);
      const x = c.getContext('2d')!;
      x.translate(c.width / 2, c.height / 2);
      x.strokeStyle = COLORS.glass;
      x.lineWidth = Math.max(1, 1.1 * dpr);
      x.shadowColor = COLORS.glow;
      x.shadowBlur = 6 * dpr;
      drawDiatom(x, kind, r);
      sprites.set(kind, c);
    }
  }

  function resize(css: number, ratio: number) {
    size = css; dpr = ratio;
    canvas.width = Math.round(css * ratio);
    canvas.height = Math.round(css * ratio);
    canvas.style.width = canvas.style.height = `${css}px`;
    scale = css / (2 * R + 40);
    buildSprites();
  }

  const toWorld = (px: number, py: number): Vec => ({ x: (px - size / 2) / scale, y: (py - size / 2) / scale });

  function events(evts: GameEvent[], now: number) {
    if (opts.reducedMotion()) {
      for (const e of evts) if (e.type === 'loop') effects.push({ kind: 'loop', born: now, poly: e.poly, text: label(e) });
      return;
    }
    for (const e of evts) {
      if (e.type === 'loop') effects.push({ kind: 'loop', born: now, poly: e.poly, text: label(e) });
      if (e.type === 'snap') {
        const pts = e.trail.filter((_, i) => i % 6 === 0).map((p) => ({ x: p.x, y: p.y, vx: (Math.random() - 0.5) * 60, vy: (Math.random() - 0.5) * 60, a: Math.random() * Math.PI }));
        effects.push({ kind: 'snap', born: now, pts });
      }
      if (e.type === 'over' && e.reason === 'contact') shakeUntil = now + 250;
    }
  }
  const label = (e: Extract<GameEvent, { type: 'loop' }>) =>
    e.points ? `+${e.points}${e.multiplier > 1 ? ` ×${e.multiplier}` : ''}` : '';

  function draw(g: Game, now: number) {
    const W = canvas.width;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = COLORS.slide;
    ctx.fillRect(0, 0, W, W);
    const s = scale * dpr;
    let ox = W / 2, oy = W / 2;
    if (now < shakeUntil && !opts.reducedMotion()) { ox += (Math.random() - 0.5) * 10 * dpr; oy += (Math.random() - 0.5) * 10 * dpr; }
    ctx.setTransform(s, 0, 0, s, ox, oy);

    // The lit field, reticle and scale bar.
    const lit = ctx.createRadialGradient(0, 0, R * 0.1, 0, 0, R);
    lit.addColorStop(0, COLORS.lit); lit.addColorStop(1, COLORS.slide);
    ctx.fillStyle = lit;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = COLORS.reticle; ctx.lineWidth = 1 / scale;
    ctx.beginPath(); ctx.moveTo(-R, 0); ctx.lineTo(R, 0); ctx.moveTo(0, -R); ctx.lineTo(0, R);
    for (let k = 1; k < 5; k++) { ctx.moveTo(R * k / 5, 0); ctx.arc(0, 0, R * k / 5, 0, Math.PI * 2); }
    ctx.stroke();
    ctx.strokeStyle = COLORS.rim; ctx.lineWidth = 2.5 / scale;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.stroke();

    // Diatoms (sprites) and contaminants (drawn: they pulse).
    for (const d of g.diatoms) {
      const sp = sprites.get(d.kind);
      if (!sp) continue;
      const fade = SPECIES[d.kind].ttl ? Math.min(1, (SPECIES[d.kind].ttl! - d.age) / 1.5) : 1;
      ctx.save();
      ctx.globalAlpha = Math.max(0.15, fade);
      ctx.translate(d.x, d.y); ctx.rotate(d.rot);
      ctx.drawImage(sp, -sp.width / 2 / s, -sp.height / 2 / s, sp.width / s, sp.height / s);
      ctx.restore();
    }
    for (const h of g.hazards) drawHazard(ctx, h.x, h.y, h.r, h.phase, scale);

    // Loop flashes under the ink.
    effects = effects.filter((e) => now - e.born < (e.kind === 'loop' ? 700 : 500));
    for (const e of effects) {
      const age = (now - e.born) / (e.kind === 'loop' ? 700 : 500);
      if (e.kind === 'loop' && e.poly) {
        ctx.save();
        ctx.globalAlpha = opts.reducedMotion() ? 0.3 : 0.35 * (1 - age);
        ctx.fillStyle = COLORS.ink;
        ctx.beginPath(); e.poly.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); ctx.fill();
        ctx.restore();
        if (e.text) {
          const c = centroid(e.poly);
          ctx.save();
          ctx.globalAlpha = 1 - age * age;
          ctx.fillStyle = COLORS.glass;
          ctx.font = `600 ${22 / scale * 0.9}px "Martian Mono Variable", monospace`;
          ctx.textAlign = 'center';
          ctx.fillText(e.text, c.x, c.y - (opts.reducedMotion() ? 0 : age * 40));
          ctx.restore();
        }
      }
      if (e.kind === 'snap' && e.pts) {
        ctx.save();
        ctx.strokeStyle = COLORS.ink; ctx.globalAlpha = 1 - age; ctx.lineWidth = 2.5 / scale;
        for (const p of e.pts) {
          const x = p.x + p.vx * age, y = p.y + p.vy * age;
          ctx.beginPath(); ctx.moveTo(x - 6 * Math.cos(p.a), y - 6 * Math.sin(p.a)); ctx.lineTo(x + 6 * Math.cos(p.a), y + 6 * Math.sin(p.a)); ctx.stroke();
        }
        ctx.restore();
      }
    }

    // The wet ink: dim at the tail, bright at the nib.
    const tr = g.trail;
    if (tr.length > 1) {
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const chunks = 6;
      for (let k = 0; k < chunks; k++) {
        const a = Math.floor((k * (tr.length - 1)) / chunks), b = Math.floor(((k + 1) * (tr.length - 1)) / chunks);
        if (b <= a) continue;
        ctx.strokeStyle = COLORS.ink;
        ctx.globalAlpha = 0.3 + 0.7 * ((k + 1) / chunks);
        ctx.lineWidth = 3.2 / scale;
        ctx.beginPath(); ctx.moveTo(tr[a].x, tr[a].y);
        for (let i = a + 1; i <= b; i++) ctx.lineTo(tr[i].x, tr[i].y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    // The nib.
    ctx.fillStyle = COLORS.ink;
    ctx.shadowColor = COLORS.ink; ctx.shadowBlur = 12 * dpr;
    ctx.beginPath(); ctx.arc(g.pen.x, g.pen.y, 6, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = COLORS.glass; ctx.lineWidth = 1.5 / scale;
    ctx.beginPath(); ctx.moveTo(g.pen.x, g.pen.y); ctx.lineTo(g.pen.x + 16 * Math.cos(g.pen.heading), g.pen.y + 16 * Math.sin(g.pen.heading)); ctx.stroke();

    // Scale bar (100 µm, by convention of the fiction).
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = COLORS.label; ctx.strokeStyle = COLORS.label; ctx.lineWidth = 1;
    const bar = 100 * scale, bx = size - 18 - bar, by = size - 18;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + bar, by); ctx.moveTo(bx, by - 4); ctx.lineTo(bx, by + 4); ctx.moveTo(bx + bar, by - 4); ctx.lineTo(bx + bar, by + 4); ctx.stroke();
    ctx.font = '10px "Martian Mono Variable", monospace'; ctx.textAlign = 'center';
    ctx.fillText('100 µm', bx + bar / 2, by - 7);
  }

  return { resize, toWorld, events, draw };
}

function centroid(poly: Vec[]): Vec {
  let x = 0, y = 0;
  for (const p of poly) { x += p.x; y += p.y; }
  return { x: x / poly.length, y: y / poly.length };
}

/** Line drawings of the four species, centred on 0,0 with radius r (device px). */
export function drawDiatom(x: CanvasRenderingContext2D, kind: Species, r: number) {
  x.beginPath();
  if (kind === 'disc') {
    x.arc(0, 0, r, 0, Math.PI * 2);
    x.moveTo(r * 0.55, 0); x.arc(0, 0, r * 0.55, 0, Math.PI * 2);
    for (let k = 0; k < 16; k++) { const a = (k * Math.PI) / 8; x.moveTo(r * 0.6 * Math.cos(a), r * 0.6 * Math.sin(a)); x.lineTo(r * 0.95 * Math.cos(a), r * 0.95 * Math.sin(a)); }
  } else if (kind === 'boat') {
    x.ellipse(0, 0, r * 1.25, r * 0.42, 0, 0, Math.PI * 2);
    x.moveTo(-r, 0); x.lineTo(r, 0);
    for (let k = -4; k <= 4; k++) { const px = (k / 5) * r; const h = r * 0.36 * Math.sqrt(1 - (px / (r * 1.25)) ** 2); x.moveTo(px, -h); x.lineTo(px, -h * 0.35); x.moveTo(px, h); x.lineTo(px, h * 0.35); }
  } else if (kind === 'triangle') {
    const tri = (s: number) => { for (let k = 0; k <= 3; k++) { const a = -Math.PI / 2 + (k * 2 * Math.PI) / 3; k ? x.lineTo(s * Math.cos(a), s * Math.sin(a)) : x.moveTo(s * Math.cos(a), s * Math.sin(a)); } };
    tri(r * 1.1); tri(r * 0.6);
    for (let k = 0; k < 3; k++) { const a = -Math.PI / 2 + (k * 2 * Math.PI) / 3; x.moveTo(r * 0.6 * Math.cos(a), r * 0.6 * Math.sin(a)); x.lineTo(r * 1.1 * Math.cos(a), r * 1.1 * Math.sin(a)); }
  } else {
    for (let k = 0; k < 7; k++) {
      const a = (k * 2 * Math.PI) / 7;
      x.moveTo(r * 0.12 * Math.cos(a), r * 0.12 * Math.sin(a)); x.lineTo(r * 1.15 * Math.cos(a), r * 1.15 * Math.sin(a));
      x.moveTo(r * 1.15 * Math.cos(a) + 2, r * 1.15 * Math.sin(a)); x.arc(r * 1.15 * Math.cos(a), r * 1.15 * Math.sin(a), 2, 0, Math.PI * 2);
    }
  }
  x.stroke();
}

function drawHazard(ctx: CanvasRenderingContext2D, hx: number, hy: number, r: number, phase: number, scale: number) {
  const pulse = 1 + 0.12 * Math.sin(phase);
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(phase * 0.25);
  ctx.strokeStyle = COLORS.hazard; ctx.fillStyle = 'rgba(255, 179, 71, 0.16)';
  ctx.lineWidth = 2 / scale;
  ctx.shadowColor = COLORS.hazardGlow; ctx.shadowBlur = 10;
  ctx.beginPath();
  const spikes = 9;
  for (let k = 0; k <= spikes * 2; k++) {
    const a = (k * Math.PI) / spikes, rr = (k % 2 ? r * 0.55 : r * 1.25) * pulse;
    k ? ctx.lineTo(rr * Math.cos(a), rr * Math.sin(a)) : ctx.moveTo(rr * Math.cos(a), rr * Math.sin(a));
  }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}
