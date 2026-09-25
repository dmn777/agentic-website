// String rendering of a specimen for client-side re-plots (Plot.astro renders the same
// structure at build time). Only generator path data goes into the markup, so the output
// never carries user input.
import type { Specimen } from './specimen';

/** Per-stroke delay (ms) that fits all strokes into a drawing budget. */
export const staggerFor = (strokes: number, duration = 2600): number =>
  Math.max(4, Math.round((duration - 700) / Math.max(1, strokes)));

export function specimenInnerSVG(sp: Specimen): string {
  const ink = sp.paths.filter((p) => p.pen === 'ink');
  const acc = sp.paths.filter((p) => p.pen === 'accent');
  const path = (d: string, i: number) => `<path d="${d}" pathLength="1" style="--i:${i}"/>`;
  return (
    `<g class="pen-ink">${ink.map((p, i) => path(p.d, i)).join('')}</g>` +
    `<g class="pen-accent">${acc.map((p, i) => path(p.d, ink.length + i)).join('')}</g>`
  );
}
