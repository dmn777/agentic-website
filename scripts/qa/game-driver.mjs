// game-driver — plays Darkfield from a plan and records what happened, for the playtest
// subagent (TESTING.md §Game → Playtest). It is also the home of the in-page bot library
// (window.__qa) that the harness (game.mjs) and the qa:shots states (states/darkfield.mjs)
// share.
//
//   npm run build
//   node scripts/qa/game-driver.mjs --plan plan.json --out ../qa/game/session-1 \
//        [--variant desktop-dark] [--format jpeg|png] [--real-clock]
//
// It serves dist/, opens /lab/darkfield/?test=1, seeds the game with plan.seed and plays the
// actions through the test hook (window.__game) one tick at a time. It saves a screenshot of
// `.darkfield` every `every` ticks and one at every event (a capture or empty loop, a snap,
// the game over, a start), and writes log.json: the plan, one full state snapshot per shot,
// every event (captures, snaps, rim hits, low ink, new slides, game over), each action's
// result, and the final result. Console or page errors are logged and make the exit code 1.
//
// Plan: { "seed": "pt-1", "every": 120, "actions": [ ... ] }. Actions (ticks are 1/60 s):
//   {"press": "start"}                    click Start / Play again (tap on a touch variant);
//                                         mid-run it restarts the run through the hook
//   {"press": "pause"}                    click Pause / Resume;  {"press": "mute"}: the Sound button
//   {"aim": [x, y], "ticks": 60}          steer towards a world point (field radius 500,
//                                         centre 0,0, y down; the pen starts at 0,150 heading up)
//   {"hold": "left"|"right", "ticks": 30} hold a turn key (or a thumb button)
//   {"idle": 90}                          no input: the pen runs straight on
//   {"loopAround": "nearest"|"cluster", "radius": 90, "maxTicks": 900, "safe": false}
//                                         steer a loop round the nearest diatom, or round the
//                                         densest cluster (the orbit grows to fit it); ends at
//                                         the first capture, or after maxTicks. "safe" skips
//                                         targets with a contaminant near them. It is a
//                                         simple steering helper, not a skilled player.
//   {"repeat": 5, "actions": [...]}       run the inner actions 5 times
//   {"untilOver": [...], "maxTicks": 36000}  repeat the inner actions until the run ends
//   {"shot": "label"}                     an extra screenshot now
//   {"cheat": {"ink": 1e9, "hazards": "on"|"frozen"|"off"}}  harness switches; the log marks them
// A movement action on the title screen starts the run first; while paused or on the
// game-over card it is skipped (add {"press": "start"} to play another run).
//
// Worked example: two strategies, one run each, a shot every 2 s.
//   cat > /tmp/plan.json <<'EOF'
//   { "seed": "pt-1", "every": 120, "actions": [
//     {"press": "start"},
//     {"untilOver": [{"loopAround": "nearest", "radius": 85, "safe": true}]},
//     {"press": "start"},
//     {"idle": 30}, {"hold": "left", "ticks": 40},
//     {"untilOver": [{"loopAround": "cluster", "radius": 120}]}
//   ]}
//   EOF
//   node scripts/qa/game-driver.mjs --plan /tmp/plan.json --out ../qa/game/pt-1
// → ../qa/game/pt-1/0001-t00000-start.jpg, 0002-t00120-every.jpg, 0005-t00233-capture.jpg,
//   …, NNNN-t02710-over.jpg and log.json. The console prints one line per run.
//
// Time: the renderer's effects (capture wash, flights, snap fragments, the game-over blot)
// age by performance.now(). With the real clock they would age by wall time, which runs
// much faster than the simulation here, so the driver swaps in a virtual clock that moves
// 1/60 s per tick: every screenshot shows the effects as a player at 60 fps would see them
// on that tick. --real-clock turns this off.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { start } from './serve.mjs';
import { parseArgs } from './routes.mjs';
import { VARIANTS, contextOptions, watch } from './shots.mjs';

export const ROUTE = '/lab/darkfield/';

/**
 * The in-page bot library. Serialised into the page with page.evaluate(qaLib), so it must
 * not refer to anything outside itself. Installs window.__qa:
 *   clock      {on, t}: the virtual clock (see the header); useVirtualClock() switches it on;
 *              step(n) is __game.step(n) that moves it on too, redraw(ms) moves it and draws
 *   realNow()  the untouched performance.now, for timing
 *   apply(inp) set the held input {left, right, aim:{x,y}|null} through the hook
 *   begin(action)  make a controller for a movement action (aim/hold/idle/loopAround)
 *   run(opts)  step the active controller one tick (or `stride` ticks) at a time until it is
 *              done, the run leaves play, an event happens (stopOnEvents), a multiple of
 *              `every` ticks is reached, or `budget` ticks pass. Returns {reason, state,
 *              events, ticks, result, inputs?}; with record: true, `inputs` lists each tick's
 *              applied input so replay() can play it back without looking at the state.
 *   replay(inputs)  apply recorded inputs tick by tick
 *   events(prev, next)  the events between two snapshots
 */
export function qaLib() {
  if (window.__qa) return true;
  const g = window.__game;
  if (!g) throw new Error('window.__game is missing: open the page with ?test=1 and let it hydrate');
  const R = 500, TURN = 3.4, DT = 1 / 60, FRAME = 1000 / 60;
  const realNow = performance.now.bind(performance);
  const clock = { on: false, t: 0 };
  performance.now = () => (clock.on ? clock.t : realNow());
  const useVirtualClock = () => { if (!clock.on) { clock.t = realNow(); clock.on = true; } };
  const redraw = (ms = 0) => { if (clock.on) clock.t += ms; return g.step(0); };
  /** __game.step(n) that also moves the virtual clock on by n ticks. */
  const step = (n = 1) => { if (clock.on) clock.t += FRAME * n; return g.step(n); };

  const POINTS = { disc: 10, boat: 20, triangle: 40, star: 100 };
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const centroid = (ps) => ({ x: ps.reduce((s, p) => s + p.x, 0) / ps.length, y: ps.reduce((s, p) => s + p.y, 0) / ps.length });

  // The held input, so apply() only calls the hook when something changes.
  let held = { left: false, right: false, aim: null };
  function apply(inp) {
    const want = { left: !!inp.left, right: !!inp.right, aim: inp.aim ? { x: inp.aim.x, y: inp.aim.y } : null };
    // input('left'|'right') also drops the aim, so keys go first and the aim after.
    if (want.left !== held.left) g.input('left', want.left);
    if (want.right !== held.right) g.input('right', want.right);
    if (want.aim) g.aim(want.aim.x, want.aim.y);
    else if (held.aim || want.left !== held.left || want.right !== held.right) g.aim(null);
    held = want;
  }
  function release() { apply({}); }

  /** Events between two consecutive snapshots. */
  function events(a, b) {
    const out = [];
    const at = { tick: b.tick, t: b.t };
    if (b.stats.runs > a.stats.runs) return [{ type: 'start', ...at, run: b.stats.runs }];
    if (b.stats.loops > a.stats.loops) {
      const caught = b.stats.captured - a.stats.captured;
      out.push({ type: caught > 0 ? 'capture' : 'loop', ...at, caught, points: b.score - a.score, score: b.score, ink: b.ink });
    }
    if (b.stats.snaps > a.stats.snaps) out.push({ type: 'snap', ...at, ink: b.ink });
    if (b.stats.rimHits > a.stats.rimHits) out.push({ type: 'rim', ...at, ink: b.ink });
    if (a.ink >= 20 && b.ink < 20 && b.mode === 'play') out.push({ type: 'lowInk', ...at });
    const per = b.slidePoints ?? 500; // the game's own slide size, from its state
    if (Math.floor(b.score / per) > Math.floor(a.score / per)) out.push({ type: 'slide', ...at, slide: Math.floor(b.score / per) + 1 });
    if (b.mode === 'over' && a.mode !== 'over') out.push({ type: 'over', ...at, reason: b.overReason, score: b.score, best: b.best });
    return out;
  }

  // ---- Targets for loopAround -------------------------------------------------------
  // A simple, deterministic steering helper, not a skilled player: it picks a target, joins
  // a circle round where the target will be half a lap later, and holds that circle until
  // the line closes. Diatoms have no ids in the snapshot, so they are tracked by position.
  const RIM = R - 18;
  const clearOf = (s, c, r) => s.hazardList.every((h) => dist(h, c) > r + 70);
  // Every diatom's velocity, estimated from consecutive snapshots (the snapshot has none).
  let seen = { tick: -1, run: -1, list: [] };
  function observe(s) {
    if (s.stats.runs === seen.run && s.tick === seen.tick) return seen.list;
    const gap = s.tick - seen.tick, dt = gap * DT;
    const consecutive = s.stats.runs === seen.run && gap > 0 && gap <= 6;
    const list = s.diatomList.map((d) => {
      let m = null;
      if (consecutive) { let bd = 3 + gap; for (const p of seen.list) if (p.kind === d.kind && dist(p, d) < bd) { bd = dist(p, d); m = p; } }
      if (!m) return { ...d, vx: 0, vy: 0, n: 0 };
      const vx = (d.x - m.x) / dt, vy = (d.y - m.y) / dt, k = m.n ? 0.2 : 1;
      return { ...d, vx: m.vx + k * (vx - m.vx), vy: m.vy + k * (vy - m.vy), n: m.n + 1 };
    });
    seen = { tick: s.tick, run: s.stats.runs, list };
    return list;
  }
  function pickNearest(s, r, safe) {
    const all = observe(s).map((d) => ({ ...d }));
    const cost = (d) => dist(d, s.pen) + 50 * Math.abs(wrap(Math.atan2(d.y - s.pen.y, d.x - s.pen.x) - s.pen.heading));
    let cands = all.filter((d) => Math.hypot(d.x, d.y) + r <= RIM && (!safe || clearOf(s, d, r)));
    if (!cands.length) cands = all.filter((d) => !safe || clearOf(s, d, r));
    if (!cands.length) cands = all;
    if (!cands.length) return null;
    cands.sort((a, b) => cost(a) - cost(b));
    return [cands[0]];
  }
  function pickCluster(s, r, safe) {
    const all = observe(s).map((d) => ({ ...d }));
    const speed = s.params.penSpeed, r0 = Math.max(r, (1.35 * speed) / TURN);
    let best = null;
    for (const seed of all) {
      // Grow a group round each diatom, then shed the member that strays furthest over the
      // coming lap until the circle that holds them all is small enough.
      let members = all.filter((d) => dist(d, seed) <= 2 * r0);
      let p;
      for (;;) {
        p = plan(members, s.pen, speed, r0);
        if (p.r <= 165 || members.length === 1) break;
        members = members.filter((m) => m !== seed).sort((a, b) => dist(b, p.c) - dist(a, p.c)).slice(1).concat([seed]);
      }
      if (safe && !clearOf(s, p.c, p.r)) continue;
      const pts = members.reduce((a, m) => a + POINTS[m.kind], 0) * members.length;
      const key = [members.length, pts, -(dist(p.c, s.pen) + 2 * Math.PI * p.r)];
      if (!best || key[0] > best.key[0] || (key[0] === best.key[0] && (key[1] > best.key[1] || (key[1] === best.key[1] && key[2] > best.key[2]))))
        best = { members, key };
    }
    return best ? best.members : pickNearest(s, r, safe);
  }
  /** Follow the targets from tick to tick (by kind and nearest position). */
  function track(members, s, stride) {
    const list = observe(s), out = [];
    for (const m of members) {
      let hit = null, bd = 4 + 1.2 * stride;
      for (const d of list) if (d.kind === m.kind && dist(d, m) < bd) { bd = dist(d, m); hit = d; }
      if (hit) out.push({ ...hit });
    }
    return out;
  }
  /** The heading that joins, then holds, the circle (c, r) in direction dir (+1 clockwise on screen). */
  function circleHeading(pen, c, r, dir) {
    const rho = Math.max(1e-6, dist(pen, c)), phi = Math.atan2(pen.y - c.y, pen.x - c.x);
    const alpha = rho > r ? Math.PI / 2 - Math.asin(r / rho) : -Math.min(1.2, (1.5 * (r - rho)) / r);
    return phi + dir * (Math.PI / 2 + alpha);
  }
  /** A point ahead on that heading, for __game.aim(). */
  function circleAim(pen, c, r, dir) {
    const th = circleHeading(pen, c, r, dir);
    return { x: pen.x + 200 * Math.cos(th), y: pen.y + 200 * Math.sin(th) };
  }
  /** Where to put the circle: round the members' positions over the coming lap. */
  function plan(members, pen, speed, r0) {
    let r = r0, c = centroid(members);
    for (let k = 0; k < 3; k++) {
      const tApp = Math.max(0, dist(pen, c) - r) / speed, lap = (2 * Math.PI * r) / speed;
      const at = (m, t) => ({ x: m.x + (m.vx ?? 0) * t, y: m.y + (m.vy ?? 0) * t });
      c = centroid(members.map((m) => at(m, tApp + lap / 2)));
      const need = Math.max(...members.flatMap((m) => [dist(at(m, tApp), c), dist(at(m, tApp + lap), c)])) + 28;
      r = Math.min(210, Math.max(r0, need));
    }
    // Keep the circle off the rim (the pen bounces there) as far as the targets allow.
    const m = Math.hypot(c.x, c.y), over = m + r - RIM;
    if (over > 0 && m > 1) { const k = Math.max(m - over, m - 0.45 * r) / m; c = { x: c.x * k, y: c.y * k }; }
    return { c, r };
  }

  // ---- Controllers -------------------------------------------------------------------
  // next(state) returns the input for the next tick, or {done: true, result}.
  function timed(ticks, input) {
    let n = 0;
    return { next: () => (n++ >= ticks ? { done: true, result: { ok: true, ticks } } : input) };
  }
  function loopCtl(a, stride) {
    const kind = a.loopAround === 'cluster' ? 'cluster' : 'nearest';
    const radius = a.radius ?? (kind === 'cluster' ? 100 : 80);
    const maxTicks = a.maxTicks ?? 900, safe = !!a.safe;
    let n = 0, base = null, members = null, dir = 1, picks = 0, target = null, orbit = null, orbitTicks = 0;
    const done = (ok, s, why) => ({ done: true, result: { ok, why, kind, target, ticks: n, caught: s.stats.captured - base.caught, points: s.score - base.score, loops: s.stats.loops - base.loops } });
    const select = (s) => {
      const m = kind === 'cluster' ? pickCluster(s, radius, safe) : pickNearest(s, radius, safe);
      if (!m) return false;
      picks++;
      members = m.map((d) => ({ ...d }));
      orbit = null;
      const c = centroid(members), h = s.pen.heading;
      dir = Math.cos(h) * (c.y - s.pen.y) - Math.sin(h) * (c.x - s.pen.x) >= 0 ? 1 : -1;
      target = { n: members.length, kinds: members.map((d) => d.kind), x: +c.x.toFixed(1), y: +c.y.toFixed(1), dir };
      return true;
    };
    return {
      next(s) {
        if (!base) {
          base = { caught: s.stats.captured, score: s.score, loops: s.stats.loops };
          if (!select(s)) return done(false, s, 'no diatoms');
        } else members = track(members, s, stride);
        if (s.stats.captured > base.caught) return done(true, s, 'caught');
        if (n >= maxTicks) return done(false, s, 'maxTicks');
        if (!members.length && (picks > 4 || !select(s))) return done(false, s, 'target lost');
        const speed = s.params.penSpeed, r0 = Math.max(radius, (1.35 * speed) / TURN);
        let c, r;
        if (orbit) {
          ({ c, r } = orbit);
          orbitTicks += stride;
          // A lap and a half without closing: the circle missed; plan it again.
          if (orbitTicks * DT > (3 * Math.PI * r) / speed) orbit = null;
        } else {
          ({ c, r } = plan(members, s.pen, speed, r0));
          const rho = dist(s.pen, c);
          const tangent = Math.atan2(s.pen.y - c.y, s.pen.x - c.x) + dir * Math.PI / 2;
          if (Math.abs(rho - r) < 0.15 * r && Math.abs(wrap(s.pen.heading - tangent)) < 0.6) { orbit = { c, r }; orbitTicks = 0; target.r = +r.toFixed(1); }
        }
        n += stride;
        return { aim: circleAim(s.pen, c, r, dir) };
      },
    };
  }
  function makeCtl(a, stride = 1) {
    if (a.aim) return timed(a.ticks ?? 60, { aim: { x: a.aim[0], y: a.aim[1] } });
    if (a.hold) return timed(a.ticks ?? 30, { [a.hold]: true });
    if (a.idle !== undefined) return timed(a.idle, {});
    if (a.loopAround) return loopCtl(a, stride);
    throw new Error('not a movement action: ' + JSON.stringify(a));
  }

  let active = null, activeStride = 1;
  function begin(action, stride = 1) { active = makeCtl(action, stride); activeStride = stride; return true; }

  function run(opts = {}) {
    const { every = 0, stopOnEvents = false, budget = Infinity, record = false } = opts;
    const stride = activeStride;
    const evs = [], inputs = record ? [] : null;
    let s = g.getState(), ticks = 0;
    for (;;) {
      if (!active) return { reason: 'idle', state: s, events: evs, ticks, inputs };
      if (s.mode !== 'play') { active = null; release(); return { reason: 'mode', state: s, events: evs, ticks, inputs }; }
      observe(s);
      const out = active.next(s);
      if (out.done) { active = null; release(); return { reason: 'done', result: out.result, state: s, events: evs, ticks, inputs }; }
      apply(out);
      if (record) inputs.push(held.aim ? [held.aim.x, held.aim.y] : held.left ? 'L' : held.right ? 'R' : 0);
      if (clock.on) clock.t += FRAME * stride;
      const prev = s;
      s = g.step(stride);
      ticks += stride;
      const ev = events(prev, s);
      evs.push(...ev);
      if (stopOnEvents && ev.some((e) => e.type !== 'rim' && e.type !== 'lowInk' && e.type !== 'slide')) return { reason: 'event', state: s, events: evs, ticks, inputs };
      if (every && Math.floor(s.tick / every) > Math.floor(prev.tick / every)) return { reason: 'every', state: s, events: evs, ticks, inputs };
      if (ticks >= budget) return { reason: 'budget', state: s, events: evs, ticks, inputs };
    }
  }

  function replay(inputs) {
    let s = g.getState();
    for (const i of inputs) {
      if (s.mode !== 'play') break;
      apply(Array.isArray(i) ? { aim: { x: i[0], y: i[1] } } : i === 'L' ? { left: true } : i === 'R' ? { right: true } : {});
      s = g.step(1);
    }
    release();
    return s;
  }

  /** Seeded PRNG for bots (mulberry32 over an FNV-1a hash of the seed string). */
  function rng(seed) {
    let h = 0x811c9dc5;
    for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193); }
    let a = h >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  window.__qa = { clock, useVirtualClock, redraw, step, realNow, apply, release, events, begin, run, replay, observe, circleAim, pickNearest, pickCluster, rng, wrap, TURN, DT, R };
  return true;
}

/** Open the game in test mode, wait for the hook and install window.__qa. */
export async function openGame(browser, server, variant = 'desktop-light') {
  const ctx = await browser.newContext(contextOptions(VARIANTS[variant]));
  const page = await ctx.newPage();
  const problems = watch(page, server.origin);
  await page.goto(server.url(ROUTE + '?test=1'));
  await gameReady(page);
  return { ctx, page, problems };
}

/** On a loaded Darkfield page: bring the game into view (it hydrates when visible), wait for
 *  the hook and fonts, and install window.__qa. Used by the qa:shots states too. */
export async function gameReady(page) {
  await page.locator('.darkfield').evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForFunction(() => !!window.__game, null, { timeout: 10000 });
  await page.evaluate(() => document.fonts?.ready);
  await page.evaluate(qaLib);
}

/**
 * Press start, pause or mute the way a player does: click (or, on a touch variant, tap) the
 * visible button — Start / Play again on the title and game-over cards, the HUD's Pause /
 * Resume and Sound buttons — then move the mouse off the field so it doesn't steer. Falls
 * back to the hook when no button is showing (e.g. start mid-run). Returns the state.
 */
export async function press(page, what) {
  const sel = { start: '[data-action="start"]', pause: '[data-action="pause"]', mute: '[data-action="sound"]' }[what];
  if (!sel) throw new Error(`press: unknown button ${what}`);
  const btn = page.locator(sel).first();
  if (await btn.isVisible() && await btn.isEnabled()) {
    const touch = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
    if (touch) await btn.tap(); else { await btn.click(); await page.mouse.move(1, 1); }
    return page.evaluate(() => window.__game.getState());
  }
  return game(page, 'input', what);
}

/** Call a hook method: game(page, 'step', 60). */
export const game = (page, fn, ...a) => page.evaluate(([f, a]) => window.__game[f](...a), [fn, a]);

/** Run a movement action to completion in the page; returns {reason, result, state, events, ticks}. */
export const act = (page, action, opts = {}) =>
  page.evaluate(([a, o]) => { window.__qa.begin(a, o.stride ?? 1); return window.__qa.run(o); }, [action, opts]);

// ---- The CLI ---------------------------------------------------------------------------

const MOVES = ['aim', 'hold', 'idle', 'loopAround'];
const isMove = (a) => MOVES.some((k) => a[k] !== undefined);

async function main() {
  const args = parseArgs();
  if (typeof args.plan !== 'string' || typeof args.out !== 'string') {
    console.error('usage: node scripts/qa/game-driver.mjs --plan plan.json --out <dir> [--variant desktop-dark] [--format jpeg|png] [--real-clock]');
    process.exit(2);
  }
  const plan = JSON.parse(fs.readFileSync(args.plan, 'utf8'));
  const variant = typeof args.variant === 'string' ? args.variant : 'desktop-dark';
  if (!VARIANTS[variant]) throw new Error(`unknown variant ${variant}; one of ${Object.keys(VARIANTS).join(', ')}`);
  const format = args.format === 'png' ? 'png' : 'jpeg';
  const every = Number(plan.every ?? 120);
  const out = path.resolve(args.out);
  fs.mkdirSync(out, { recursive: true });
  for (const f of fs.readdirSync(out)) if (/^\d{4}-t\d+-.*\.(jpe?g|png)$/.test(f) || f === 'log.json') fs.rmSync(path.join(out, f));

  const server = await start();
  const browser = await chromium.launch();
  const log = { plan, variant, clock: args['real-clock'] ? 'real' : 'virtual', started: new Date().toISOString(), shots: [], events: [], actions: [], runs: [], final: null, problems: [] };
  let shotNo = 0;
  try {
    const { page, problems } = await openGame(browser, server, variant);
    if (!args['real-clock']) await page.evaluate(() => window.__qa.useVirtualClock());
    const el = page.locator('.darkfield');
    let state = await game(page, 'seed', String(plan.seed ?? 'playtest'));

    const shot = async (why, s) => {
      const file = `${String(++shotNo).padStart(4, '0')}-t${String(s.tick).padStart(5, '0')}-${why.replace(/[^a-z0-9-]+/gi, '-')}.${format === 'png' ? 'png' : 'jpg'}`;
      await el.screenshot({ path: path.join(out, file), type: format, ...(format === 'jpeg' ? { quality: 82 } : {}) });
      log.shots.push({ file, why, run: s.stats.runs, tick: s.tick, t: s.t, state: s });
    };
    const record = async (evs, s) => {
      for (const e of evs) {
        log.events.push({ run: s.stats.runs, ...e });
        if (e.type === 'over') {
          log.runs.push({ run: s.stats.runs, t: e.t, score: e.score, reason: e.reason, stats: s.stats });
          console.log(`run ${s.stats.runs}: ${e.reason} at ${e.t.toFixed(1)} s, score ${e.score}, ${s.stats.captured} caught in ${s.stats.loops} loops, ${s.stats.snaps} snaps`);
        }
      }
      for (const e of evs) {
        if (e.type === 'over') {
          // Let the ink blot bloom (500 ms of effect time) before the shot.
          s = await page.evaluate(() => window.__qa.redraw(600));
          await shot('over', s);
        } else if (e.type === 'capture' || e.type === 'loop' || e.type === 'snap' || e.type === 'start') await shot(e.type, s);
      }
      return s;
    };
    const pressBtn = async (what) => {
      const before = state;
      await page.evaluate(() => { window.__qa.release(); if (window.__qa.clock.on) window.__qa.clock.t += 1000 / 60; });
      state = await press(page, what);
      const evs = await page.evaluate(([a, b]) => window.__qa.events(a, b), [before, state]);
      state = await record(evs, state);
    };

    let totalTicks = 0;
    const move = async (a) => {
      if (state.mode === 'title') { await pressBtn('start'); log.events.push({ type: 'auto-start', tick: 0 }); }
      if (state.mode !== 'play') return { skipped: `mode ${state.mode}` };
      await page.evaluate((a) => window.__qa.begin(a, 1), a);
      for (;;) {
        const r = await page.evaluate((every) => window.__qa.run({ every, stopOnEvents: true }), every);
        totalTicks += r.ticks;
        state = r.state;
        state = await record(r.events, state);
        if (r.reason === 'every') await shot('every', state);
        if (r.reason === 'done') return r.result;
        if (r.reason === 'mode' || r.reason === 'idle') return { ended: `mode ${state.mode}` };
      }
    };
    const exec = async (a, depth = 0) => {
      const from = state.tick;
      let result;
      if (a.press) await pressBtn(a.press);
      else if (a.shot) await shot('shot-' + a.shot, state);
      else if (a.cheat) { state = await game(page, 'cheat', a.cheat); log.events.push({ type: 'cheat', tick: state.tick, run: state.stats.runs, cheat: a.cheat }); }
      else if (a.repeat) { for (let i = 0; i < a.repeat; i++) for (const b of a.actions ?? []) await exec(b, depth + 1); }
      else if (a.untilOver) {
        if (state.mode === 'title') await pressBtn('start');
        const cap = a.maxTicks ?? 36000, t0 = totalTicks;
        while (state.mode === 'play' && totalTicks - t0 < cap) {
          const before = totalTicks;
          for (const b of a.untilOver) await exec(b, depth + 1);
          if (totalTicks === before && state.mode === 'play') await exec({ idle: 30 }, depth + 1); // nothing to do: drift on
        }
        result = { mode: state.mode, ticks: totalTicks - t0 };
      } else if (isMove(a)) result = await move(a);
      else throw new Error('unknown action ' + JSON.stringify(a));
      if (depth === 0 || !a.repeat) log.actions.push({ depth, action: a.untilOver || a.repeat ? { ...a, untilOver: a.untilOver ? '[…]' : undefined, actions: a.actions ? '[…]' : undefined } : a, run: state.stats.runs, fromTick: from, toTick: state.tick, result });
    };

    await shot('title', state);
    for (const a of plan.actions ?? []) await exec(a);
    if (state.mode === 'play' || state.mode === 'paused') await shot('end', state);
    log.final = { mode: state.mode, run: state.stats.runs, tick: state.tick, t: state.t, score: state.score, best: state.best, ink: state.ink, overReason: state.overReason, stats: state.stats };
    log.problems = problems;
  } finally {
    await browser.close();
    await server.close();
  }
  log.finished = new Date().toISOString();
  fs.writeFileSync(path.join(out, 'log.json'), JSON.stringify(log, null, 2));
  const f = log.final;
  console.log(`${log.shots.length} shots, ${log.events.filter((e) => e.type === 'capture').length} captures, ${log.events.filter((e) => e.type === 'snap').length} snaps; final: ${f.mode}, score ${f.score}, t ${f.t} s → ${path.join(out, 'log.json')}`);
  for (const p of log.problems) console.log(`  ${p.kind}: ${p.text}`);
  process.exitCode = log.problems.length ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(2); });
}
