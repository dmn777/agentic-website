import { describe, expect, it } from 'vitest';
import { createGame, start, step } from './sim';
import { createAutopilot } from './autopilot';

// The title screen's attract mode flies the pen with this pilot, so it has to demonstrate
// the verb: close loops around diatoms, several at a time when it can, without grinding
// the rim.
describe('autopilot', () => {
  it('loops a still cluster within 12 s', () => {
    const g = createGame('pilot', { spawn: false });
    start(g);
    g.noHazards = true;
    g.diatoms = [0, 1, 2].map((k) => ({ id: 100 + k, kind: 'disc' as const, x: 220 + k * 18, y: -120 + (k % 2) * 16, vx: 0, vy: 0, rot: 0, spin: 0, r: 14, age: 0 }));
    const pilot = createAutopilot();
    for (let i = 0; i < 60 * 12 && g.stats.captured === 0; i++) step(g, pilot(g));
    expect(g.stats.captured).toBe(3);
  });
  it('keeps catching on a live field, often more than one at a time', () => {
    const g = createGame('pilot-live');
    start(g);
    Object.assign(g, { ink: Infinity, noHazards: true });
    const pilot = createAutopilot();
    for (let i = 0; i < 60 * 60; i++) step(g, pilot(g));
    expect(g.stats.captured).toBeGreaterThanOrEqual(12);
    expect(g.stats.bestLoop.n).toBeGreaterThanOrEqual(2);
    expect(g.stats.rimHits).toBeLessThanOrEqual(6);
  });
  it('prefers a cluster it can be seen looping (outside the title card)', () => {
    const g = createGame('pilot-avoid', { spawn: false });
    start(g);
    g.noHazards = true;
    const pair = (id: number, x: number, y: number) => [0, 1].map((k) => ({ id: id + k, kind: 'disc' as const, x: x + k * 20, y, vx: 0, vy: 0, rot: 0, spin: 0, r: 14, age: 0 }));
    g.diatoms = [...pair(10, -10, 60), ...pair(20, -10, -290)]; // under the card / in view
    const pilot = createAutopilot({ avoid: (c) => c.y > -170 });
    for (let i = 0; i < 60 * 12 && g.stats.captured === 0; i++) step(g, pilot(g));
    expect(g.diatoms.map((d) => d.id).sort()).toEqual([10, 11]);
  });
  it('is deterministic', () => {
    const run = () => {
      const g = createGame('pilot-det'); start(g); Object.assign(g, { ink: Infinity, noHazards: true });
      const p = createAutopilot();
      for (let i = 0; i < 60 * 20; i++) step(g, p(g));
      return [g.score, g.pen.x, g.pen.y];
    };
    expect(run()).toEqual(run());
  });
});
