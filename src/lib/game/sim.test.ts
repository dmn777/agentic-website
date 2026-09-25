import { describe, expect, it } from 'vitest';
import { createGame, start, step, togglePause, snapshot, R, DT, TURN, MAX_TRAIL, SPECIES, type Game, type Input } from './sim';

const idle: Input = { left: false, right: false, aim: null };
const left: Input = { left: true, right: false, aim: null };
const run = (g: Game, n: number, input: Input | ((i: number) => Input) = idle) => {
  for (let i = 0; i < n; i++) step(g, typeof input === 'function' ? input(i) : input);
};
/** A quiet test field: no spawning, nothing on it. */
function quiet(seed = 'test') {
  const g = createGame(seed, { spawn: false });
  start(g);
  g.diatoms = []; g.hazards = [];
  return g;
}
/** Centre of the circle the pen draws while holding left from its current pose. */
function leftCircleCentre(g: Game) {
  const rTurn = g.params.penSpeed / TURN;
  return { x: g.pen.x + rTurn * Math.sin(g.pen.heading), y: g.pen.y - rTurn * Math.cos(g.pen.heading) };
}
/**
 * A teardrop loop, the way a player closes one: straight for 30 ticks, turn left through
 * 270°, then straight across the first leg. (Holding a key alone traces a perfect circle,
 * which runs back along its own line instead of crossing it.) Returns the loop's centre.
 */
function teardrop(g: Game): { x: number; y: number; drive: () => void } {
  const turnTicks = Math.round((1.5 * Math.PI) / (TURN * DT));
  const c = leftCircleCentre(g);
  const lead = 30 * g.params.penSpeed * DT;
  const centre = { x: c.x + lead * Math.cos(g.pen.heading), y: c.y + lead * Math.sin(g.pen.heading) };
  return { ...centre, drive: () => run(g, 30 + turnTicks + 40, (i) => ({ left: i >= 30 && i < 30 + turnTicks, right: false, aim: null })) };
}
const angleDiff = (a: number, b: number) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const diatom = (x: number, y: number, kind: 'disc' | 'boat' | 'triangle' | 'star' = 'disc') =>
  ({ id: Math.random(), kind, x, y, vx: 0, vy: 0, rot: 0, spin: 0, r: 14, age: 0 });

describe('state machine', () => {
  it('starts on the title screen, then plays with a full ink well and a stocked field', () => {
    const g = createGame('s1');
    expect(g.mode).toBe('title');
    start(g);
    expect(g.mode).toBe('play');
    expect(g.ink).toBe(100);
    expect(g.score).toBe(0);
    expect(g.diatoms.length).toBe(9);
    expect(g.hazards.length).toBe(0);
  });
  it('does not advance while paused, and resumes', () => {
    const g = createGame('s1');
    start(g);
    run(g, 10);
    togglePause(g);
    expect(g.mode).toBe('paused');
    run(g, 50);
    expect(g.tick).toBe(10);
    togglePause(g);
    run(g, 5);
    expect(g.tick).toBe(15);
  });
  it('restarts after game over with a fresh run and keeps the best score', () => {
    const g = quiet();
    g.score = 120;
    g.ink = 0.01;
    step(g, idle);
    expect(g.mode).toBe('over');
    expect(g.overReason).toBe('ink');
    expect(g.best).toBe(120);
    start(g);
    expect(g.mode).toBe('play');
    expect(g.score).toBe(0);
    expect(g.best).toBe(120);
  });
});

describe('determinism', () => {
  it('gives the same game for the same seed and inputs', () => {
    const a = createGame('same'), b = createGame('same');
    start(a); start(b);
    const script = (i: number): Input => ({ left: i % 97 < 40, right: i % 131 > 100, aim: null });
    run(a, 1200, script); run(b, 1200, script);
    expect(JSON.stringify(snapshot(a))).toBe(JSON.stringify(snapshot(b)));
  });
  it('lays out a different field for a different seed', () => {
    const a = createGame('one'), b = createGame('two');
    start(a); start(b);
    expect(a.diatoms.map((d) => d.x)).not.toEqual(b.diatoms.map((d) => d.x));
  });
});

describe('the pen', () => {
  it('moves at the pen speed', () => {
    const g = quiet();
    const x0 = g.pen.x, y0 = g.pen.y;
    run(g, 60);
    expect(Math.hypot(g.pen.x - x0, g.pen.y - y0)).toBeCloseTo(g.params.penSpeed * 60 * DT, 0);
  });
  it('turns at most TURN radians per second with the keys', () => {
    const g = quiet();
    const h0 = g.pen.heading;
    run(g, 30, left);
    expect(angleDiff(h0, g.pen.heading)).toBeCloseTo(TURN * 0.5, 5);
  });
  it('turns towards an aim point, never faster than TURN, and then holds course', () => {
    const g = quiet();
    const target = { x: g.pen.x + 300, y: g.pen.y }; // due east of a pen heading north
    const aim: Input = { left: false, right: false, aim: target };
    step(g, aim);
    const turned = Math.abs(g.pen.heading - -Math.PI / 2);
    expect(turned).toBeLessThanOrEqual(TURN * DT + 1e-9);
    run(g, 40, aim);
    const want = Math.atan2(target.y - g.pen.y, target.x - g.pen.x);
    expect(Math.abs(Math.atan2(Math.sin(g.pen.heading - want), Math.cos(g.pen.heading - want)))).toBeLessThan(0.1);
  });
  it('stays inside the field, bouncing off the rim at a cost in ink', () => {
    const g = quiet();
    g.ink = 1e9;
    run(g, 60 * 20, (i) => ({ left: Math.sin(i / 50) > 0.6, right: Math.sin(i / 37) < -0.8, aim: null }));
    expect(Math.hypot(g.pen.x, g.pen.y)).toBeLessThanOrEqual(R);
    expect(g.stats.rimHits).toBeGreaterThan(0);
  });
  it('keeps at most MAX_TRAIL of wet ink', () => {
    const g = quiet();
    g.ink = 1e9;
    run(g, 60 * 15, (i) => ({ left: i % 300 < 20, right: false, aim: null }));
    expect(g.trailLen).toBeLessThanOrEqual(MAX_TRAIL + 1e-6);
  });
});

describe('loops', () => {
  it('captures a diatom inside a closed loop, scores it and refills ink', () => {
    const g = quiet();
    const c = teardrop(g);
    g.diatoms = [diatom(c.x, c.y)];
    c.drive();
    expect(g.diatoms).toHaveLength(0);
    expect(g.score).toBe(10);
    expect(g.stats.captured).toBe(1);
    // replay the same path and measure the ink change on the capture tick
    const h = quiet();
    const c2 = teardrop(h);
    h.diatoms = [diatom(c2.x, c2.y)];
    h.ink = 50; // below the cap, so the whole refill shows
    const turnTicks = Math.round((1.5 * Math.PI) / (TURN * DT));
    let jump = 0;
    for (let i = 0; i < 30 + turnTicks + 40 && h.stats.captured === 0; i++) {
      const before = h.ink;
      step(h, { left: i >= 30 && i < 30 + turnTicks, right: false, aim: null });
      jump = h.ink - before;
    }
    expect(jump).toBeCloseTo(12 - h.params.drain * DT, 5);
    expect(h.trailLen).toBe(0); // the loop used up the whole wet line
  });
  it('multiplies: three diatoms in one loop score (10+10+10)×3', () => {
    const g = quiet();
    const c = teardrop(g);
    g.diatoms = [diatom(c.x, c.y), diatom(c.x + 12, c.y), diatom(c.x, c.y + 12)];
    c.drive();
    expect(g.score).toBe(90);
    expect(g.stats.bestLoop).toEqual({ points: 90, n: 3 });
  });
  it('leaves diatoms outside the loop alone', () => {
    const g = quiet();
    const c = teardrop(g);
    g.diatoms = [diatom(c.x + 200, c.y + 200)];
    c.drive();
    expect(g.diatoms).toHaveLength(1);
    expect(g.score).toBe(0);
    expect(g.stats.loops).toBe(1);
  });
  it('removes a contaminant caught in a loop for 25 points', () => {
    const g = quiet();
    const c = teardrop(g);
    g.hazards = [{ id: 1, x: c.x, y: c.y, vx: 0, vy: 0, heading: 0, r: 12, phase: 0 }];
    g.frozenHazards = true;
    c.drive();
    expect(g.hazards).toHaveLength(0);
    expect(g.score).toBe(25);
  });
});

describe('contaminants', () => {
  it('end the run when they touch the pen', () => {
    const g = quiet();
    g.hazards = [{ id: 1, x: g.pen.x, y: g.pen.y - 40, vx: 0, vy: 0, heading: 0, r: 12, phase: 0 }];
    g.frozenHazards = true;
    run(g, 30);
    expect(g.mode).toBe('over');
    expect(g.overReason).toBe('contact');
  });
  it('snap the wet line when they touch it, costing ink', () => {
    const g = quiet();
    run(g, 40); // draw a line straight up
    const mid = { x: g.pen.x, y: g.pen.y + 60 };
    g.hazards = [{ id: 1, x: mid.x + 5, y: mid.y, vx: 0, vy: 0, heading: 0, r: 12, phase: 0 }];
    g.frozenHazards = true;
    const ink = g.ink;
    step(g, idle);
    expect(g.trailLen).toBeLessThan(10);
    expect(g.stats.snaps).toBe(1);
    expect(ink - g.ink).toBeGreaterThan(5.9);
  });
});

describe('the ink economy and difficulty', () => {
  it('runs dry for a passive player in about 30 s (between 25 and 40)', () => {
    const g = createGame('passive');
    start(g);
    g.hazards = []; g.frozenHazards = true; g.noHazards = true;
    let t = 0;
    while (g.mode === 'play' && t < 60 * 60) { step(g, idle); t++; }
    expect(g.mode).toBe('over');
    expect(g.overReason).toBe('ink');
    expect(t / 60).toBeLessThan(40);
    expect(t / 60).toBeGreaterThan(25);
  });
  it('raises difficulty and its parameters over a long run', () => {
    const g = quiet();
    g.ink = 1e9;
    const seen: { d: number; speed: number; drain: number }[] = [];
    for (let s = 0; s < 240; s++) { run(g, 60, (i) => ({ left: i % 120 < 30, right: false, aim: null })); seen.push({ d: g.d, speed: g.params.penSpeed, drain: g.params.drain }); }
    for (let i = 1; i < seen.length; i++) {
      expect(seen[i].d).toBeGreaterThan(seen[i - 1].d);
      expect(seen[i].speed).toBeGreaterThanOrEqual(seen[i - 1].speed);
      expect(seen[i].drain).toBeGreaterThanOrEqual(seen[i - 1].drain);
    }
    expect(seen.at(-1)!.d).toBeGreaterThan(0.8);
  });
  it('spawns contaminants after a short grace period, more of them later', () => {
    const g = createGame('spawns');
    start(g);
    g.ink = 1e9;
    run(g, 60 * 3);
    expect(g.hazards.length).toBe(0);
    run(g, 60 * 6, (i) => ({ left: i % 100 < 25, right: false, aim: null }));
    if (g.mode === 'play') expect(g.hazards.length).toBeGreaterThanOrEqual(1);
  });
  it('keeps restocking diatoms up to the target', () => {
    const g = createGame('stock');
    start(g);
    g.diatoms = []; g.ink = 1e9; g.noHazards = true;
    run(g, 60 * 8);
    expect(g.diatoms.length).toBe(g.params.diatomTarget);
    for (const d of g.diatoms) expect(Math.hypot(d.x, d.y)).toBeLessThanOrEqual(R);
  });
});

describe('species', () => {
  it('spawns all four species in roughly their shares', () => {
    const g = createGame('species');
    const counts: Record<string, number> = { disc: 0, boat: 0, triangle: 0, star: 0 };
    for (let k = 0; k < 400; k++) { start(g); for (const d of g.diatoms) counts[d.kind]++; }
    const n = Object.values(counts).reduce((a, b) => a + b, 0);
    expect(counts.disc / n).toBeGreaterThan(0.45);
    expect(counts.disc / n).toBeLessThan(0.65);
    expect(counts.star / n).toBeGreaterThan(0.015);
    expect(counts.star / n).toBeLessThan(0.07);
    expect(counts.boat).toBeGreaterThan(counts.triangle);
    expect(counts.triangle).toBeGreaterThan(counts.star);
  });
  it('lets the star colony leave after 8 s, and scores it 100 with a 25-ink refill', () => {
    expect(SPECIES.star.ink).toBe(25);
    const g = quiet();
    g.diatoms = [diatom(300, -300, 'star')];
    run(g, Math.round(7.9 / DT));
    expect(g.diatoms.length).toBe(1);
    run(g, Math.round(0.2 / DT));
    expect(g.diatoms.length).toBe(0);
    const h = quiet('star-catch');
    const loop = teardrop(h);
    h.diatoms = [diatom(loop.x, loop.y, 'star')];
    h.ink = 50;
    loop.drive();
    expect(h.score).toBe(100);
    expect(h.stats.captured).toBe(1);
  });
});

describe('snapshot', () => {
  it('lists where the diatoms and contaminants are, for bots and the harness', () => {
    const g = createGame('snap');
    start(g);
    g.hazards = [{ id: 99, x: 12.345, y: -6.789, vx: 0, vy: 0, heading: 0, r: 12, phase: 0 }];
    const s = snapshot(g);
    expect(s.diatomList.length).toBe(g.diatoms.length);
    expect(s.diatomList[0]).toEqual({ x: +g.diatoms[0].x.toFixed(1), y: +g.diatoms[0].y.toFixed(1), kind: g.diatoms[0].kind });
    expect(s.hazardList).toEqual([{ x: 12.3, y: -6.8 }]);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});
