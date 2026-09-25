import { describe, expect, it } from 'vitest';
import { specimen } from './specimen';
import { specimenInnerSVG, staggerFor } from './svg';

describe('specimenInnerSVG', () => {
  it('renders an ink group and an accent group with every path', () => {
    const sp = specimen('svg-test', { detail: 0.4 });
    const html = specimenInnerSVG(sp);
    expect(html.startsWith('<g class="pen-ink">')).toBe(true);
    expect(html).toContain('<g class="pen-accent">');
    expect((html.match(/<path /g) ?? []).length).toBe(sp.paths.length);
    expect((html.match(/pathLength="1"/g) ?? []).length).toBe(sp.paths.length);
  });
  it('numbers strokes in plotting order: ink first, then accent', () => {
    const sp = specimen('order', { detail: 0.3 });
    const idx = [...specimenInnerSVG(sp).matchAll(/--i:(\d+)/g)].map((m) => Number(m[1]));
    expect(idx).toEqual(idx.map((_, i) => i));
  });
  it('contains nothing but path data from the generator (no injection surface)', () => {
    const html = specimenInnerSVG(specimen('<script>alert(1)</script>'));
    expect(html).not.toContain('<script');
    expect(html).toMatch(/^(<g class="pen-(ink|accent)">(<path d="[MLZ0-9. -]+" pathLength="1" style="--i:\d+"\/>)*<\/g>)+$/);
  });
});

describe('staggerFor', () => {
  it('spreads strokes over the budget, with a floor', () => {
    expect(staggerFor(100, 2600)).toBe(19);
    expect(staggerFor(10000, 2600)).toBe(4);
    expect(staggerFor(0, 2600)).toBeGreaterThan(0);
  });
});
