// A simple pilot for the title screen's attract mode (visual QA and playtest 1: show the
// verb before asking for it). It picks the densest cluster of diatoms, approaches it on a
// tangent and orbits it until the line crosses its own approach and the loop closes. Pure
// and deterministic; it returns the input for one tick.
import { R, TURN, type Game, type Input } from './sim';
import type { Vec } from './geometry';

const REPLAN = 7;   // s on one target before giving up
const REACH = 380;  // u: a cluster centred further out can't be looped whole

/** `avoid` marks cluster centres the pilot should rather not use (where the title card
 *  would hide the demo). */
export function createAutopilot(opts: { avoid?: (c: Vec) => boolean } = {}): (g: Game) => Input {
  let ids: number[] = [];
  let since = 0;
  let loops = -1;

  function plan(g: Game) {
    let best = -Infinity;
    ids = [];
    for (const d of g.diatoms) {
      const near = g.diatoms.filter((e) => Math.hypot(e.x - d.x, e.y - d.y) < 90);
      const c = { x: near.reduce((s, e) => s + e.x, 0) / near.length, y: near.reduce((s, e) => s + e.y, 0) / near.length };
      const score = near.length * 300 - Math.hypot(d.x - g.pen.x, d.y - g.pen.y)
        - (Math.hypot(c.x, c.y) > REACH ? 900 : 0) - (opts.avoid?.(c) ? 700 : 0);
      if (score > best) { best = score; ids = near.map((e) => e.id); }
    }
    since = g.t;
    loops = g.stats.loops;
  }

  return (g: Game): Input => {
    const live = g.diatoms.filter((d) => ids.includes(d.id));
    if (!live.length || g.stats.loops !== loops || g.t - since > REPLAN) plan(g);
    const members = g.diatoms.filter((d) => ids.includes(d.id));
    if (!members.length) return { left: false, right: false, aim: null };
    // Orbit the cluster's centre, wide enough to take it all in and at least a turning
    // circle and a bit, kept clear of the rim.
    const c = { x: members.reduce((s, d) => s + d.x, 0) / members.length, y: members.reduce((s, d) => s + d.y, 0) / members.length };
    const spread = Math.max(0, ...members.map((d) => Math.hypot(d.x - c.x, d.y - c.y)));
    const r = Math.max(1.25 * (g.params.penSpeed / TURN), spread + 38);
    const m = Math.hypot(c.x, c.y), room = R - r - 30;
    if (m > room && m > 0) { c.x *= room / m; c.y *= room / m; }
    return { left: false, right: false, aim: orbitAim(g.pen, c, r) };
  };
}

/** A point to steer at: towards the tangent of a circle of radius r around c, then round it. */
function orbitAim(pen: Vec, c: Vec, r: number): Vec {
  const rho = Math.max(1e-6, Math.hypot(pen.x - c.x, pen.y - c.y));
  const phi = Math.atan2(pen.y - c.y, pen.x - c.x);
  const alpha = rho > r ? Math.PI / 2 - Math.asin(r / rho) : -Math.min(1.2, (1.5 * (r - rho)) / r);
  const th = phi + Math.PI / 2 + alpha;
  return { x: pen.x + 200 * Math.cos(th), y: pen.y + 200 * Math.sin(th) };
}
