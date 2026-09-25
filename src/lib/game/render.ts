// Darkfield's Canvas 2D renderer (GAME_DESIGN.md §Art direction, §Juice). It draws the
// state; it never changes it. Colours are fixed: the slide is the same dark field in both
// site themes. Effects (capture washes, flying catches, snap fragments, rim sparks, the
// game-over blot, slide banners) are driven by the events a tick emits. Under reduced
// motion nothing moves that isn't gameplay: no shake, particles or flights, and fades
// become plain on/off states.
import { R, SPECIES, type Game, type GameEvent, type Species } from './sim';
import type { Vec } from './geometry';
import { mulberry32 } from '../random';

// Drawn art, not interface: these are the slide's own colours (DESIGN.md allows raw
// values in generated art).
export const COLORS = {
  slide: '#04070b', lit: '#10202f', reticle: 'rgba(150, 200, 225, 0.13)',
  glass: '#d4eef4', glow: 'rgba(110, 215, 255, 0.55)', ink: '#ff6a48',
  hazard: '#ffb347', hazardGlow: 'rgba(255, 170, 60, 0.6)', label: 'rgba(212, 238, 244, 0.55)',
};
const MONO = '"Martian Mono Variable", ui-monospace, monospace';
const DISPLAY = '"Imbue Variable", Georgia, serif';

type Effect =
  | { kind: 'wash'; born: number; poly: Vec[]; text: string }
  | { kind: 'catch'; born: number; x: number; y: number; sp: Species; delay: number }
  | { kind: 'snap'; born: number; pts: { x: number; y: number; vx: number; vy: number; a: number }[] }
  | { kind: 'rim'; born: number; x: number; y: number }
  | { kind: 'banner'; born: number; text: string };
const LIFE: Record<Effect['kind'], number> = { wash: 650, catch: 750, snap: 500, rim: 260, banner: 1500 };

export interface Renderer {
  resize(cssSize: number, dpr: number): void;
  /** Screen (CSS px, relative to the canvas) → world units. */
  toWorld(px: number, py: number): Vec;
  events(evts: GameEvent[], now: number): void;
  /** A new slide (every 1,000 points): a banner across the field. */
  milestone(slide: number, now: number): void;
  /** Clear effects and the game-over blot (a new run or a new seed). */
  reset(): void;
  /** `hidePen` draws the field without the pen and its ink (the title screen's attract mode). */
  draw(g: Game, now: number, o?: { hidePen?: boolean }): void;
}

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];

export function createRenderer(canvas: HTMLCanvasElement, opts: { reducedMotion: () => boolean }): Renderer {
  const ctx = canvas.getContext('2d')!;
  let size = 600, dpr = 1, scale = size / (2 * R + 40);
  const sprites = new Map<Species, HTMLCanvasElement>();
  let effects: Effect[] = [];
  let shakeUntil = 0;
  let blot: { x: number; y: number; born: number; lobes: number[] } | null = null;
  let hatch: CanvasPattern | null = null;
  /** World units for n CSS pixels: keeps strokes and small marks legible on a phone. */
  const px = (n: number) => n / scale;
  /** Drawn radius of a species: 1.7–2× its world (capture) radius, never under 8 CSS px.
   *  Capture is by centre, so a larger drawing changes nothing in the rules. */
  const GROW: Record<Species, number> = { disc: 1.7, boat: 2, triangle: 1.9, star: 1.8 };
  const drawnR = (kind: Species) => Math.max(SPECIES[kind].r * GROW[kind], px(8));
  let bg: HTMLCanvasElement | null = null;

  function buildSprites() {
    sprites.clear();
    for (const kind of Object.keys(SPECIES) as Species[]) {
      const r = drawnR(kind) * scale * dpr;
      const pad = Math.ceil(r * 0.9 + 16 * dpr);
      const c = document.createElement('canvas');
      c.width = c.height = Math.ceil(2 * r + 2 * pad);
      const x = c.getContext('2d')!;
      x.translate(c.width / 2, c.height / 2);
      // Bloom: a wide faint pass, then the crisp line with a tight glow.
      x.strokeStyle = COLORS.glow;
      x.lineWidth = Math.max(2, 3 * dpr);
      x.shadowColor = COLORS.glow;
      x.shadowBlur = 14 * dpr;
      x.globalAlpha = 0.35;
      drawDiatom(x, kind, r);
      x.globalAlpha = 1;
      x.strokeStyle = COLORS.glass;
      x.lineWidth = Math.max(1, 1.2 * dpr);
      x.shadowBlur = 5 * dpr;
      drawDiatom(x, kind, r);
      sprites.set(kind, c);
    }
    // Diagonal hatching for the capture wash, in device pixels.
    const t = document.createElement('canvas');
    const step = Math.round(7 * dpr);
    t.width = t.height = step;
    const h = t.getContext('2d')!;
    h.strokeStyle = COLORS.ink; h.lineWidth = Math.max(1, dpr);
    h.beginPath(); h.moveTo(0, step); h.lineTo(step, 0); h.moveTo(-1, 1); h.lineTo(1, -1); h.moveTo(step - 1, step + 1); h.lineTo(step + 1, step - 1); h.stroke();
    hatch = ctx.createPattern(t, 'repeat');
  }

  function resize(css: number, ratio: number) {
    size = css; dpr = ratio;
    canvas.width = Math.round(css * ratio);
    canvas.height = Math.round(css * ratio);
    canvas.style.width = canvas.style.height = `${css}px`;
    scale = css / (2 * R + 40);
    buildSprites();
    buildBackground();
  }

  /** The still layers, drawn once per size: the lit field, out-of-focus diatoms and dust
   *  below the focal plane (depth), the eyepiece reticle and the scale bar. */
  function buildBackground() {
    const W = canvas.width, s = scale * dpr;
    bg = document.createElement('canvas');
    bg.width = bg.height = W;
    const b = bg.getContext('2d')!;
    b.fillStyle = COLORS.slide; b.fillRect(0, 0, W, W);
    b.setTransform(s, 0, 0, s, W / 2, W / 2);
    // The field stop: a lit disc with a crisp edge, falling off towards it.
    const lit = b.createRadialGradient(0, 0, 0, 0, 0, R);
    lit.addColorStop(0, COLORS.lit); lit.addColorStop(0.7, '#0a1621'); lit.addColorStop(1, '#070e16');
    b.fillStyle = lit;
    b.beginPath(); b.arc(0, 0, R, 0, Math.PI * 2); b.fill();
    b.save();
    b.beginPath(); b.arc(0, 0, R, 0, Math.PI * 2); b.clip();
    const rnd = mulberry32(8);
    // Out-of-focus diatoms: large, soft and faint.
    const kinds = Object.keys(SPECIES) as Species[];
    for (let k = 0; k < 7; k++) {
      const sp = sprites.get(kinds[k % 3])!;
      const a = rnd() * Math.PI * 2, r = R * Math.sqrt(rnd()) * 0.9, z = 1.8 + rnd() * 1.4;
      b.save();
      b.filter = `blur(${(3 + rnd() * 4) * dpr}px)`;
      b.globalAlpha = 0.06 + rnd() * 0.05;
      b.translate(r * Math.cos(a), r * Math.sin(a)); b.rotate(rnd() * Math.PI);
      b.drawImage(sp, (-sp.width / 2 / s) * z, (-sp.height / 2 / s) * z, (sp.width / s) * z, (sp.height / s) * z);
      b.restore();
    }
    // Dust: faint specks, a few of them soft.
    for (let k = 0; k < 90; k++) {
      const a = rnd() * Math.PI * 2, r = R * Math.sqrt(rnd());
      b.globalAlpha = 0.08 + rnd() * 0.22;
      b.fillStyle = COLORS.glass;
      b.beginPath(); b.arc(r * Math.cos(a), r * Math.sin(a), px(0.6 + rnd() * 1.4), 0, Math.PI * 2); b.fill();
    }
    b.restore();
    b.globalAlpha = 1;
    // The eyepiece reticle: a faint crosshair and an ocular micrometer along the horizontal,
    // a long tick every 50 u and a short one every 10 u.
    b.strokeStyle = COLORS.reticle; b.lineWidth = px(1);
    b.beginPath();
    b.moveTo(-R, 0); b.lineTo(R, 0); b.moveTo(0, -R * 0.06); b.lineTo(0, R * 0.06);
    b.moveTo(0, -R); b.lineTo(0, -R * 0.62); b.moveTo(0, R * 0.62); b.lineTo(0, R);
    for (let u = -300; u <= 300; u += 10) {
      const h = u % 50 === 0 ? (u % 100 === 0 ? 16 : 11) : 5;
      b.moveTo(u, 0); b.lineTo(u, -h);
    }
    b.stroke();
    // Scale bar (100 µm, by the fiction's convention), inside the disc, bottom right.
    b.strokeStyle = COLORS.label; b.fillStyle = COLORS.label; b.lineWidth = px(1);
    const bx = R * 0.2, by = R * 0.8, tick = px(4);
    b.beginPath(); b.moveTo(bx, by); b.lineTo(bx + 100, by);
    b.moveTo(bx, by - tick); b.lineTo(bx, by + tick); b.moveTo(bx + 100, by - tick); b.lineTo(bx + 100, by + tick);
    b.stroke();
    b.font = `${px(10)}px ${MONO}`; b.textAlign = 'center'; b.textBaseline = 'alphabetic';
    b.fillText('100 µm', bx + 50, by - px(7));
  }

  const toWorld = (sx: number, sy: number): Vec => ({ x: (sx - size / 2) / scale, y: (sy - size / 2) / scale });

  function events(evts: GameEvent[], now: number) {
    const still = opts.reducedMotion();
    for (const e of evts) {
      if (e.type === 'loop') {
        effects.push({ kind: 'wash', born: now, poly: e.poly, text: e.points ? `+${e.points}${e.multiplier > 1 ? ` ×${e.multiplier}` : ''}` : '' });
        if (!still) e.caught.forEach((c, i) => effects.push({ kind: 'catch', born: now, x: c.x, y: c.y, sp: c.kind, delay: i * 40 }));
      } else if (e.type === 'snap' && !still) {
        const pts = e.trail.filter((_, i) => i % 5 === 0).map((p) => ({ x: p.x, y: p.y, vx: (Math.random() - 0.5) * 70, vy: (Math.random() - 0.5) * 70, a: Math.random() * Math.PI }));
        effects.push({ kind: 'snap', born: now, pts });
      } else if (e.type === 'rim' && !still) {
        effects.push({ kind: 'rim', born: now, x: e.x, y: e.y });
      } else if (e.type === 'over') {
        if (e.reason === 'contact' && !still) shakeUntil = now + 250;
      }
    }
  }
  function milestone(slide: number, now: number) {
    effects.push({ kind: 'banner', born: now, text: `Slide ${ROMAN[slide] ?? slide}` });
  }
  function reset() { effects = []; blot = null; shakeUntil = 0; }

  function draw(g: Game, now: number, o: { hidePen?: boolean } = {}) {
    const still = opts.reducedMotion();
    const W = canvas.width;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = COLORS.slide;
    ctx.fillRect(0, 0, W, W);
    const s = scale * dpr;
    let ox = W / 2, oy = W / 2;
    if (now < shakeUntil && !still) { ox += (Math.random() - 0.5) * 10 * dpr; oy += (Math.random() - 0.5) * 10 * dpr; }
    if (bg) ctx.drawImage(bg, ox - W / 2, oy - W / 2);
    ctx.setTransform(s, 0, 0, s, ox, oy);

    // The game-over blot sits under everything that still moves.
    if (g.mode === 'over') {
      if (!blot) blot = { x: g.pen.x, y: g.pen.y, born: now, lobes: Array.from({ length: 11 }, () => 0.75 + Math.random() * 0.5) };
      const grow = still ? 1 : easeOut(Math.min(1, (now - blot.born) / 500));
      drawBlot(ctx, blot.x, blot.y, px(46) * grow, blot.lobes);
    }

    // Diatoms (sprites) and contaminants (drawn: they pulse).
    for (const d of g.diatoms) {
      const sp = sprites.get(d.kind);
      if (!sp) continue;
      const ttl = SPECIES[d.kind].ttl;
      ctx.save();
      if (ttl) ctx.globalAlpha = Math.max(0.2, Math.min(1, (ttl - d.age) / 1.5));
      ctx.globalCompositeOperation = 'lighter'; // glass lit on black: light adds up
      ctx.translate(d.x, d.y); ctx.rotate(d.rot);
      ctx.drawImage(sp, -sp.width / 2 / s, -sp.height / 2 / s, sp.width / s, sp.height / s);
      ctx.restore();
    }
    for (const h of g.hazards) drawHazard(ctx, h.x, h.y, Math.max(h.r * 1.5, px(9)), still ? 0 : h.phase, px(2), dpr);

    // Effects under the ink.
    effects = effects.filter((e) => now - e.born < LIFE[e.kind] + (e.kind === 'catch' ? e.delay : 0));
    for (const e of effects) {
      const age = Math.max(0, (now - e.born - (e.kind === 'catch' ? e.delay : 0)) / LIFE[e.kind]);
      if (e.kind === 'wash') {
        ctx.save();
        tracePoly(ctx, e.poly);
        ctx.clip();
        ctx.globalAlpha = still ? 0.16 : 0.22 * (1 - age);
        ctx.fillStyle = COLORS.ink; ctx.fill();
        if (hatch) {
          ctx.globalAlpha = still ? 0.5 : 0.7 * (1 - age);
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.fillStyle = hatch; ctx.fillRect(0, 0, W, W);
        }
        ctx.restore();
        ctx.save();
        ctx.globalAlpha = still ? 0.8 : 0.9 * (1 - age);
        ctx.strokeStyle = COLORS.ink; ctx.lineWidth = px(1.5);
        tracePoly(ctx, e.poly); ctx.stroke();
        ctx.restore();
      } else if (e.kind === 'snap') {
        ctx.save();
        ctx.strokeStyle = COLORS.ink; ctx.globalAlpha = 1 - age; ctx.lineWidth = px(2.5); ctx.lineCap = 'round';
        const len = px(4);
        ctx.beginPath();
        for (const p of e.pts) {
          const x = p.x + p.vx * age, y = p.y + p.vy * age + 40 * age * age, a = p.a + age * 3;
          ctx.moveTo(x - len * Math.cos(a), y - len * Math.sin(a)); ctx.lineTo(x + len * Math.cos(a), y + len * Math.sin(a));
        }
        ctx.stroke();
        ctx.restore();
      } else if (e.kind === 'rim') {
        ctx.save();
        ctx.strokeStyle = COLORS.glass; ctx.globalAlpha = 0.8 * (1 - age); ctx.lineWidth = px(1.5);
        ctx.beginPath(); ctx.arc(e.x, e.y, px(4 + 14 * age), 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
    }

    // The wet ink: dim at the tail, bright at the nib. Butt caps where chunks meet, so the
    // overlaps don't show as beads.
    const tr = g.trail;
    if (tr.length > 1 && !o.hidePen) {
      ctx.lineJoin = 'round';
      ctx.strokeStyle = COLORS.ink;
      ctx.lineWidth = px(3.2);
      const chunks = Math.min(16, tr.length - 1);
      for (let k = 0; k < chunks; k++) {
        const a = Math.floor((k * (tr.length - 1)) / chunks), b = Math.floor(((k + 1) * (tr.length - 1)) / chunks);
        if (b <= a) continue;
        ctx.globalAlpha = 0.25 + 0.75 * ((k + 1) / chunks) ** 1.5;
        ctx.lineCap = k === chunks - 1 ? 'round' : 'butt';
        ctx.beginPath(); ctx.moveTo(tr[a].x, tr[a].y);
        for (let i = a + 1; i <= b; i++) ctx.lineTo(tr[i].x, tr[i].y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    // The nib.
    if (g.mode !== 'title' && !o.hidePen) {
      const nib = Math.max(6, px(3.5));
      ctx.fillStyle = COLORS.ink;
      ctx.shadowColor = COLORS.ink; ctx.shadowBlur = 12 * dpr;
      ctx.beginPath(); ctx.arc(g.pen.x, g.pen.y, nib, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = COLORS.glass; ctx.lineWidth = px(1.5);
      const tip = Math.max(16, px(11));
      ctx.beginPath(); ctx.moveTo(g.pen.x, g.pen.y); ctx.lineTo(g.pen.x + tip * Math.cos(g.pen.heading), g.pen.y + tip * Math.sin(g.pen.heading)); ctx.stroke();
    }

    // Catches flash, then fly to the catalogue corner (top left, towards the score).
    const corner = { x: -R * 0.74, y: -R * 0.74 };
    for (const e of effects) {
      if (e.kind !== 'catch') continue;
      // A catch waiting for its turn (they flash one after another) stays where it was.
      const age = Math.max(0, (now - e.born - e.delay) / LIFE.catch);
      const sp = sprites.get(e.sp);
      if (!sp) continue;
      const fly = easeIn(Math.max(0, (age - 0.3) / 0.7));
      const x = e.x + (corner.x - e.x) * fly, y = e.y + (corner.y - e.y) * fly;
      ctx.save();
      ctx.translate(x, y);
      if (age < 0.35) {
        ctx.globalAlpha = 1 - age / 0.35;
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = px(2);
        ctx.beginPath(); ctx.arc(0, 0, drawnR(e.sp) * (1 + age * 3), 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1 - fly * 0.8;
      const k = 1 - fly * 0.6;
      ctx.drawImage(sp, (-sp.width / 2 / s) * k, (-sp.height / 2 / s) * k, (sp.width / s) * k, (sp.height / s) * k);
      ctx.restore();
    }

    // Labels over everything: the loop's score, and slide banners.
    for (const e of effects) {
      const age = Math.max(0, (now - e.born) / LIFE[e.kind]);
      if (e.kind === 'wash' && e.text) {
        const c = centroid(e.poly);
        ctx.save();
        ctx.globalAlpha = still ? 1 : 1 - age * age;
        ctx.font = `600 ${px(15)}px ${MONO}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = px(4); ctx.strokeStyle = COLORS.slide; ctx.lineJoin = 'round';
        const y = c.y - (still ? 0 : age * px(28));
        ctx.strokeText(e.text, c.x, y);
        ctx.fillStyle = COLORS.glass; ctx.fillText(e.text, c.x, y);
        ctx.restore();
      } else if (e.kind === 'banner') {
        ctx.save();
        ctx.globalAlpha = still ? 1 : Math.min(1, age * 6, (1 - age) * 3);
        ctx.font = `${px(30)}px ${DISPLAY}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = px(6); ctx.strokeStyle = COLORS.slide; ctx.lineJoin = 'round';
        ctx.strokeText(e.text, 0, -R * 0.55);
        ctx.fillStyle = COLORS.glass; ctx.fillText(e.text, 0, -R * 0.55);
        ctx.restore();
      }
    }
  }

  return { resize, toWorld, events, milestone, reset, draw };
}

const easeOut = (t: number) => 1 - (1 - t) ** 3;
const easeIn = (t: number) => t * t;

function tracePoly(ctx: CanvasRenderingContext2D, poly: Vec[]) {
  ctx.beginPath();
  poly.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
}

function centroid(poly: Vec[]): Vec {
  let x = 0, y = 0;
  for (const p of poly) { x += p.x; y += p.y; }
  return { x: x / poly.length, y: y / poly.length };
}

/** An ink blot: a lobed disc with a few satellite drops. */
function drawBlot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, lobes: number[]) {
  if (r <= 0) return;
  ctx.save();
  ctx.fillStyle = COLORS.ink;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  const n = lobes.length;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2, rr = r * lobes[i % n];
    const a0 = ((i - 0.5) / n) * Math.PI * 2, rm = r * 0.8;
    if (i === 0) ctx.moveTo(x + rr * Math.cos(a), y + rr * Math.sin(a));
    else ctx.quadraticCurveTo(x + rm * Math.cos(a0) * 1.15, y + rm * Math.sin(a0) * 1.15, x + rr * Math.cos(a), y + rr * Math.sin(a));
  }
  ctx.fill();
  for (let i = 0; i < n; i += 3) {
    const a = (i / n) * Math.PI * 2 + 0.3, d = r * (1.25 + lobes[i] * 0.3);
    ctx.beginPath(); ctx.arc(x + d * Math.cos(a), y + d * Math.sin(a), r * 0.09 * lobes[i], 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
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
      const a = (k * 2 * Math.PI) / 7, ex = r * 1.15 * Math.cos(a), ey = r * 1.15 * Math.sin(a);
      x.moveTo(r * 0.12 * Math.cos(a), r * 0.12 * Math.sin(a)); x.lineTo(ex, ey);
      x.moveTo(ex + r * 0.14, ey); x.arc(ex, ey, r * 0.14, 0, Math.PI * 2);
    }
  }
  x.stroke();
}

function drawHazard(ctx: CanvasRenderingContext2D, hx: number, hy: number, r: number, phase: number, line: number, dpr: number) {
  const pulse = 1 + 0.12 * Math.sin(phase);
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(phase * 0.25);
  ctx.strokeStyle = COLORS.hazard; ctx.fillStyle = 'rgba(255, 179, 71, 0.16)';
  ctx.lineWidth = line;
  ctx.shadowColor = COLORS.hazardGlow; ctx.shadowBlur = 10 * dpr;
  ctx.beginPath();
  const spikes = 9;
  for (let k = 0; k <= spikes * 2; k++) {
    const a = (k * Math.PI) / spikes, rr = (k % 2 ? r * 0.55 : r * 1.25) * pulse;
    k ? ctx.lineTo(rr * Math.cos(a), rr * Math.sin(a)) : ctx.moveTo(rr * Math.cos(a), rr * Math.sin(a));
  }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}
