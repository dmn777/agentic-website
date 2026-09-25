// Darkfield's rules as a pure, seeded, fixed-timestep simulation (GAME_DESIGN.md §Rules).
// No DOM and no clock: the shell feeds it inputs one tick at a time. Events emitted during
// a tick (captures, snaps, bounces…) drive the renderer's juice and the sound.
import { rngFrom, type Rng } from '../random';
import { distToSegment, pointInPolygon, polygonArea, segmentIntersection, type Vec } from './geometry';
import { difficulty, loopScore, paramsAt, type Params } from './params';

export const R = 500;            // field radius (u)
export const DT = 1 / 60;        // s per tick
export const TURN = 3.4;         // rad/s
export const MAX_TRAIL = 1500;   // u of wet ink
export const WET_INK = 300;      // u behind the nib that is still wet: only this much can snap
export const MIN_LOOP_AREA = 1500;
export const PEN_R = 5;
export const SLIDE_POINTS = 500; // a "slide" milestone every this many points
export const MAX_INK = 120;      // a run starts at 100; catches can overfill to this
const SKIP_NEWEST = 4;           // segments next to the nib are never tested for crossings
const RIM_COST = 3, SNAP_COST = 6;
const RIM_COOLDOWN = 0.5;        // s: the rim charges at most this often
const AIM_REACH = 0.85 * 500;    // an aim point outside this radius is pulled in to it
export const HAZARD_GRACE = 12;  // s before the first contaminant
const HAZARD_POINTS = 25;
const RIM_CLEAR = 45;            // u diatoms keep from the rim, so a loop can get round them

export type Mode = 'title' | 'play' | 'paused' | 'over';
export type Species = 'disc' | 'boat' | 'triangle' | 'star';
export const SPECIES: Record<Species, { points: number; ink: number; speed: [number, number]; r: number; share: number; ttl?: number }> = {
  disc: { points: 10, ink: 14, speed: [10, 16], r: 14, share: 0.55 },
  boat: { points: 20, ink: 14, speed: [14, 22], r: 15, share: 0.28 },
  triangle: { points: 40, ink: 14, speed: [20, 27], r: 14, share: 0.13 },
  star: { points: 100, ink: 25, speed: [23, 29], r: 16, share: 0.04, ttl: 8 },
};

export interface Input { left: boolean; right: boolean; /** world point to steer towards (pointer) */ aim: Vec | null }
export interface Diatom { id: number; kind: Species; x: number; y: number; vx: number; vy: number; rot: number; spin: number; r: number; age: number }
export interface Hazard { id: number; x: number; y: number; vx: number; vy: number; heading: number; r: number; phase: number }
export type GameEvent =
  | { type: 'loop'; poly: Vec[]; caught: { kind: Species; x: number; y: number }[]; hazards: number; points: number; base: number; multiplier: number; refill: number }
  | { type: 'snap'; trail: Vec[] }
  | { type: 'rim'; x: number; y: number; cost: number }
  | { type: 'over'; reason: 'ink' | 'contact'; best: boolean }
  | { type: 'lowInk' };

export interface Game {
  seed: string; rng: Rng; spawn: boolean;
  mode: Mode; tick: number; t: number; d: number; params: Params;
  score: number; best: number; ink: number; overReason: 'ink' | 'contact' | null;
  pen: { x: number; y: number; heading: number };
  trail: Vec[]; trailLen: number;
  diatoms: Diatom[]; hazards: Hazard[];
  respawnTimer: number; nextId: number;
  /** Time (s) of the last charged rim hit. */
  rimAt: number;
  stats: { loops: number; captured: number; snaps: number; rimHits: number; runs: number; bestLoop: { points: number; n: number } };
  events: GameEvent[];
  /** Test switches: freeze contaminant motion, or keep them from spawning. */
  frozenHazards?: boolean; noHazards?: boolean;
}

export function createGame(seed: string, opts: { spawn?: boolean; best?: number } = {}): Game {
  return {
    seed, rng: rngFrom(`darkfield/${seed}`), spawn: opts.spawn ?? true,
    mode: 'title', tick: 0, t: 0, d: 0, params: paramsAt(0),
    score: 0, best: opts.best ?? 0, ink: 100, overReason: null,
    pen: { x: 0, y: 0, heading: -Math.PI / 2 }, trail: [], trailLen: 0,
    diatoms: [], hazards: [], respawnTimer: 0, nextId: 1, rimAt: -Infinity,
    stats: { loops: 0, captured: 0, snaps: 0, rimHits: 0, runs: 0, bestLoop: { points: 0, n: 0 } }, events: [],
  };
}

/** Start (or restart) a run. The RNG carries on, so each run in a session differs but replays exactly. */
export function start(g: Game): void {
  Object.assign(g, {
    mode: 'play', tick: 0, t: 0, d: 0, params: paramsAt(0), score: 0, ink: 100, overReason: null,
    pen: { x: 0, y: 150, heading: -Math.PI / 2 }, diatoms: [], hazards: [], respawnTimer: 0, events: [], rimAt: -Infinity,
    frozenHazards: false, noHazards: false,
  });
  g.trail = [{ x: g.pen.x, y: g.pen.y }];
  g.trailLen = 0;
  g.stats = { loops: 0, captured: 0, snaps: 0, rimHits: 0, runs: g.stats.runs + 1, bestLoop: { points: 0, n: 0 } };
  if (g.spawn) while (g.diatoms.length < g.params.diatomTarget) spawnDiatom(g);
}

export function togglePause(g: Game): void {
  if (g.mode === 'play') g.mode = 'paused';
  else if (g.mode === 'paused') g.mode = 'play';
}

const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

function pickSpecies(r: Rng): Species {
  let u = r.next();
  for (const k of Object.keys(SPECIES) as Species[]) { u -= SPECIES[k].share; if (u < 0) return k; }
  return 'disc';
}

function spawnDiatom(g: Game): void {
  const r = g.rng;
  let x = 0, y = 0;
  for (let tries = 0; tries < 30; tries++) {
    const a = r.range(0, Math.PI * 2), rad = (R - 70) * Math.sqrt(r.next());
    x = rad * Math.cos(a); y = rad * Math.sin(a);
    if (Math.hypot(x - g.pen.x, y - g.pen.y) >= 180) break;
  }
  const kind = pickSpecies(r), sp = SPECIES[kind];
  const dir = r.range(0, Math.PI * 2), speed = r.range(sp.speed[0], sp.speed[1]);
  g.diatoms.push({ id: g.nextId++, kind, x, y, vx: speed * Math.cos(dir), vy: speed * Math.sin(dir), rot: r.range(0, Math.PI * 2), spin: r.range(-0.6, 0.6), r: sp.r, age: 0 });
}

function spawnHazard(g: Game): void {
  const r = g.rng;
  let a = r.range(0, Math.PI * 2);
  for (let tries = 0; tries < 20 && Math.hypot(R * Math.cos(a) - g.pen.x, R * Math.sin(a) - g.pen.y) < 300; tries++) a = r.range(0, Math.PI * 2);
  const x = (R - 20) * Math.cos(a), y = (R - 20) * Math.sin(a);
  const heading = a + Math.PI + r.range(-0.5, 0.5);
  g.hazards.push({ id: g.nextId++, x, y, vx: 0, vy: 0, heading, r: 12, phase: r.range(0, Math.PI * 2) });
}

/** Keep a moving body inside the field by reflecting its velocity off the rim. */
function bounce(b: { x: number; y: number; vx: number; vy: number }, radius: number): boolean {
  const dist = Math.hypot(b.x, b.y);
  if (dist <= R - radius) return false;
  const nx = b.x / dist, ny = b.y / dist;
  const dot = b.vx * nx + b.vy * ny;
  if (dot > 0) { b.vx -= 2 * dot * nx; b.vy -= 2 * dot * ny; }
  b.x = nx * (R - radius); b.y = ny * (R - radius);
  return true;
}

function endRun(g: Game, reason: 'ink' | 'contact'): void {
  g.mode = 'over';
  g.overReason = reason;
  const best = g.score > g.best;
  if (best) g.best = g.score;
  g.events.push({ type: 'over', reason, best });
}

/** Index of the first trail point in the wet ink: the newest WET_INK of arc back from the
 *  nib (the last point). Segment i (point i to i + 1) is wet when i ≥ wetFrom(trail). */
export function wetFrom(trail: Vec[]): number {
  let arc = 0, j = trail.length - 1;
  while (j > 0 && arc < WET_INK) { arc += Math.hypot(trail[j].x - trail[j - 1].x, trail[j].y - trail[j - 1].y); j--; }
  return j;
}

function clearTrail(g: Game): void {
  g.trail = [{ x: g.pen.x, y: g.pen.y }];
  g.trailLen = 0;
}

/** Advance one fixed tick. Does nothing unless a run is in play. */
export function step(g: Game, input: Input): void {
  g.events = [];
  if (g.mode !== 'play') return;
  g.tick++;
  g.t = g.tick * DT;
  g.d = difficulty(g.t);
  g.params = paramsAt(g.d);
  const p = g.params;

  // Steering: keys turn at the full rate; an aim point turns towards it, never overshooting.
  const pen = g.pen;
  let turn = 0;
  if (input.aim) {
    // A pointer resting outside the field would steer the pen into the rim again and again.
    const m = Math.hypot(input.aim.x, input.aim.y), k = m > AIM_REACH ? AIM_REACH / m : 1;
    const ax = input.aim.x * k, ay = input.aim.y * k;
    turn = Math.max(-TURN * DT, Math.min(TURN * DT, wrapAngle(Math.atan2(ay - pen.y, ax - pen.x) - pen.heading)));
  }
  else turn = ((input.right ? 1 : 0) - (input.left ? 1 : 0)) * TURN * DT;
  pen.heading = wrapAngle(pen.heading + turn);

  const from = { x: pen.x, y: pen.y };
  const body = { x: pen.x + p.penSpeed * DT * Math.cos(pen.heading), y: pen.y + p.penSpeed * DT * Math.sin(pen.heading), vx: Math.cos(pen.heading), vy: Math.sin(pen.heading) };
  if (bounce(body, PEN_R)) {
    pen.heading = Math.atan2(body.vy, body.vx);
    if (g.t - g.rimAt >= RIM_COOLDOWN) {
      g.rimAt = g.t;
      g.ink -= RIM_COST;
      g.stats.rimHits++;
      g.events.push({ type: 'rim', x: body.x, y: body.y, cost: RIM_COST });
    }
  }
  pen.x = body.x; pen.y = body.y;

  // Loop detection: the new segment against the older wet trail.
  const tr = g.trail;
  let hit: { i: number; x: number; y: number; t: number } | null = null;
  for (let i = 0; i < tr.length - 1 - SKIP_NEWEST; i++) {
    const c = segmentIntersection(from, pen, tr[i], tr[i + 1]);
    if (c && (!hit || c.t < hit.t)) hit = { i, x: c.x, y: c.y, t: c.t };
  }
  const segLen = Math.hypot(pen.x - from.x, pen.y - from.y);
  if (hit) {
    const poly: Vec[] = [{ x: hit.x, y: hit.y }, ...tr.slice(hit.i + 1), { x: hit.x, y: hit.y }];
    if (polygonArea(poly) >= MIN_LOOP_AREA) closeLoop(g, poly);
    else { tr.push({ x: pen.x, y: pen.y }); g.trailLen += segLen; }
  } else {
    tr.push({ x: pen.x, y: pen.y });
    g.trailLen += segLen;
  }
  while (g.trailLen > MAX_TRAIL && tr.length > 2) {
    g.trailLen -= Math.hypot(tr[1].x - tr[0].x, tr[1].y - tr[0].y);
    tr.shift();
  }

  // Diatoms drift, spin, bounce, and the star leaves after its time.
  for (const dm of g.diatoms) {
    dm.x += dm.vx * DT; dm.y += dm.vy * DT; dm.rot += dm.spin * DT; dm.age += DT;
    bounce(dm, dm.r + RIM_CLEAR);
  }
  g.diatoms = g.diatoms.filter((dm) => !(SPECIES[dm.kind].ttl && dm.age > SPECIES[dm.kind].ttl!));

  // Contaminants home in lazily, bounce, touch the pen or the line.
  for (const h of g.hazards) {
    h.phase += DT * 4;
    if (g.frozenHazards) continue;
    const want = Math.atan2(pen.y - h.y, pen.x - h.x);
    h.heading = wrapAngle(h.heading + Math.max(-p.homing * DT, Math.min(p.homing * DT, wrapAngle(want - h.heading))));
    h.vx = p.hazardSpeed * Math.cos(h.heading); h.vy = p.hazardSpeed * Math.sin(h.heading);
    h.x += h.vx * DT; h.y += h.vy * DT;
    if (bounce(h, h.r)) h.heading = Math.atan2(h.vy, h.vx);
  }
  for (const h of g.hazards) {
    if (Math.hypot(h.x - pen.x, h.y - pen.y) <= h.r + PEN_R) { endRun(g, 'contact'); return; }
  }
  // Only the wet ink near the nib can snap; further back it has set (T26: most snaps used to
  // land far behind the nib, where nobody was looking).
  const wet = wetFrom(g.trail);
  for (const h of g.hazards) {
    const t = g.trail;
    let touched = false;
    for (let i = wet; i < t.length - 1 && !touched; i++) {
      if (Math.abs(t[i].x - h.x) > h.r + 12 && Math.abs(t[i + 1].x - h.x) > h.r + 12 && Math.sign(t[i].x - h.x) === Math.sign(t[i + 1].x - h.x)) continue;
      if (distToSegment(h, t[i], t[i + 1]) <= h.r) touched = true;
    }
    if (touched) {
      g.events.push({ type: 'snap', trail: g.trail });
      clearTrail(g);
      g.ink -= SNAP_COST;
      g.stats.snaps++;
      break;
    }
  }

  // Ink and supply.
  const before = g.ink;
  g.ink -= p.drain * DT; // capped at 100 only when refilled
  if (before >= 20 && g.ink < 20) g.events.push({ type: 'lowInk' });
  if (g.ink <= 0) { g.ink = 0; endRun(g, 'ink'); return; }
  if (g.spawn) {
    if (g.diatoms.length < p.diatomTarget) {
      g.respawnTimer += DT;
      if (g.respawnTimer >= p.respawnDelay) { spawnDiatom(g); g.respawnTimer = 0; }
    } else g.respawnTimer = 0;
    if (!g.noHazards && g.t >= HAZARD_GRACE && g.hazards.length < p.hazardTarget) spawnHazard(g);
  }
}

function closeLoop(g: Game, poly: Vec[]): void {
  const caught = g.diatoms.filter((dm) => pointInPolygon(dm, poly));
  const zapped = g.hazards.filter((h) => pointInPolygon(h, poly));
  g.diatoms = g.diatoms.filter((dm) => !caught.includes(dm));
  g.hazards = g.hazards.filter((h) => !zapped.includes(h));
  const points = loopScore(caught.map((dm) => SPECIES[dm.kind].points)) + zapped.length * HAZARD_POINTS;
  g.score += points;
  // Ink refills the way points score: the catch's ink times the number caught.
  const refill = caught.reduce((s, dm) => s + SPECIES[dm.kind].ink, 0) * caught.length;
  g.ink = Math.max(g.ink, Math.min(MAX_INK, g.ink + refill)); // a refill never lowers the ink
  g.stats.loops++;
  g.stats.captured += caught.length;
  if (points > g.stats.bestLoop.points) g.stats.bestLoop = { points, n: caught.length };
  const base = caught.reduce((s, dm) => s + SPECIES[dm.kind].points, 0);
  g.events.push({ type: 'loop', poly, caught: caught.map((dm) => ({ kind: dm.kind, x: dm.x, y: dm.y })), hazards: zapped.length, points, base, multiplier: caught.length, refill });
  clearTrail(g);
}

/** A JSON-safe view of the state for the test hook and the harness. */
export function snapshot(g: Game) {
  return {
    seed: g.seed, mode: g.mode, tick: g.tick, t: +g.t.toFixed(3), d: +g.d.toFixed(4), params: g.params,
    score: g.score, best: g.best, ink: +g.ink.toFixed(3), overReason: g.overReason, hazardGrace: HAZARD_GRACE, slidePoints: SLIDE_POINTS, wetInk: WET_INK,
    pen: { x: +g.pen.x.toFixed(2), y: +g.pen.y.toFixed(2), heading: +g.pen.heading.toFixed(4) },
    trailLen: +g.trailLen.toFixed(2), trailPoints: g.trail.length,
    diatoms: g.diatoms.length, hazards: g.hazards.length, stats: { ...g.stats, bestLoop: { ...g.stats.bestLoop } },
    species: g.diatoms.map((d) => d.kind),
    diatomList: g.diatoms.map((d) => ({ x: +d.x.toFixed(1), y: +d.y.toFixed(1), kind: d.kind })),
    hazardList: g.hazards.map((h) => ({ x: +h.x.toFixed(1), y: +h.y.toFixed(1) })),
  };
}
