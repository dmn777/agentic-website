// Every piece must be deterministic for a seed (identical drawing calls), differ between
// seeds, draw something in still(), and finish (or at least draw) in frame().
import { describe, expect, it } from 'vitest';
import { PIECES } from './pieces';
import { defaults, type Palette } from './types';

const PAL: Palette = { paper: '#f2ede3', paperRaised: '#f8f5ee', ink: '#191d28', ink2: '#414654', ink3: '#5a5f6b', accent: '#e0442b', teal: '#1d7a80', ochre: '#a8741a', rule: '#cbc2b0' };

/** A canvas context that records every call and property write (numbers rounded). */
function recorder() {
  const log: string[] = [];
  const fmt = (a: unknown) => (typeof a === 'number' ? a.toFixed(2) : typeof a === 'object' ? '[obj]' : String(a));
  const target: Record<string, unknown> = { canvas: { width: 400, height: 300 } };
  const ctx = new Proxy(target, {
    get(t, k) {
      if (k in t) return t[k as string];
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return (...a: unknown[]) => { log.push(`${String(k)}(${a.map(fmt)})`); return { addColorStop: (...b: unknown[]) => log.push(`stop(${b.map(fmt)})`) }; };
      if (k === 'getImageData') return (_x: number, _y: number, w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h });
      if (k === 'measureText') return (s: string) => ({ width: s.length * 7 });
      return (...a: unknown[]) => { log.push(`${String(k)}(${a.map(fmt).join(',')})`); };
    },
    set(t, k, v) { t[k as string] = v; log.push(`${String(k)}=${fmt(v)}`); return true; },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, log };
}

describe('gallery pieces', () => {
  it('there are 6–9 of them with unique ids and distinct techniques', () => {
    expect(PIECES.length).toBeGreaterThanOrEqual(6);
    expect(PIECES.length).toBeLessThanOrEqual(9);
    expect(new Set(PIECES.map((p) => p.id)).size).toBe(PIECES.length);
    expect(new Set(PIECES.map((p) => p.technique)).size).toBe(PIECES.length);
  });
  for (const piece of PIECES) {
    describe(piece.id, () => {
      const run = (seed: number, fn: 'still' | 'frame', params = defaults(piece)) => {
        const r = recorder();
        const inst = piece.make({ w: 400, h: 300, seed, params, pal: PAL });
        if (fn === 'still') inst.still(r.ctx); else { inst.frame(r.ctx, 0.5); inst.frame(r.ctx, 2); }
        return r.log;
      };
      it('has a title, a one-line description and sane params', () => {
        expect(piece.title.length).toBeGreaterThan(2);
        expect(piece.description.length).toBeGreaterThan(10);
        expect(piece.description).not.toMatch(/\n/);
        for (const q of piece.params) { expect(q.value).toBeGreaterThanOrEqual(q.min); expect(q.value).toBeLessThanOrEqual(q.max); }
      });
      it('is deterministic for a seed and draws something', () => {
        const a = run(7, 'still'), b = run(7, 'still');
        expect(a.length).toBeGreaterThan(20);
        expect(a).toEqual(b);
      });
      it('changes with the seed', () => {
        expect(run(7, 'still')).not.toEqual(run(8, 'still'));
      });
      it('responds to every parameter', () => {
        const base = defaults(piece);
        for (const q of piece.params) {
          const alt = { ...base, [q.key]: q.value === q.max ? q.min : q.max };
          expect(run(7, 'still', alt), q.key).not.toEqual(run(7, 'still', base));
        }
      });
      it('animates deterministically', () => {
        expect(run(3, 'frame')).toEqual(run(3, 'frame'));
        expect(run(3, 'frame').length).toBeGreaterThan(5);
      });
    });
  }

  // "Deterministic and in bounds" passed while Drift's particles crawled 0.015 px per step
  // and drew dots. Stroke-based pieces must lay down a real amount of line.
  it.each(['combed', 'drift', 'survey'])('%s draws a substantial total line length', (id) => {
    const piece = PIECES.find((p) => p.id === id)!;
    const r = recorder();
    piece.make({ w: 400, h: 300, seed: 7, params: defaults(piece), pal: PAL }).still(r.ctx);
    let len = 0, last: [number, number] | null = null;
    for (const call of r.log) {
      const m = call.match(/^(moveTo|lineTo)\((-?[\d.]+),(-?[\d.]+)\)$/);
      if (!m) continue;
      const pt: [number, number] = [Number(m[2]), Number(m[3])];
      if (m[1] === 'lineTo' && last) len += Math.hypot(pt[0] - last[0], pt[1] - last[1]);
      last = pt;
    }
    expect(len).toBeGreaterThan(400 * 300 / 20); // at least ~ one line every 20 px across the sheet
  });
});
