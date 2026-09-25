// The single source of Lab metadata, shared by Home and /lab/ (T5). Only built pages are
// listed: no "coming soon" cards.
import type { Species } from '../lib/plot/specimen';

export interface LabEntry {
  slug: string;          // route under /lab/, e.g. 'stats'
  plate: number;         // plate number, shown as a Roman numeral
  title: string;
  blurb: string;         // one or two sentences
  tags: string[];
  kind: string;          // 'Explorable', 'Gallery', 'Story', 'Game'…
  series?: string;       // id of a Series below, e.g. 'stats'
  species?: Species;     // force a plotter species for the card specimen
}

/** Groups of plates with a hub page. Titles, hub labels and counts are derived from here. */
export interface Series { id: string; title: string; href: string; blurb: string }
export const series: Series[] = [
  {
    id: 'stats', title: 'Statistics, seen', href: '/lab/stats/',
    blurb: 'Three ideas that most of statistics rests on, each as something to pull on rather than a formula to memorise: why averages behave, why base rates matter, and what a best-fit line is fitting.',
  },
];

export const lab: LabEntry[] = [
  {
    slug: 'stats/sampling', plate: 1, series: 'stats', kind: 'Explorable', species: 'ridge',
    title: 'Sampling, seen',
    blurb: 'Draw samples from lopsided populations and watch their averages line up into a bell curve anyway.',
    tags: ['sampling', 'CLT'],
  },
  {
    slug: 'stats/base-rates', plate: 2, series: 'stats', kind: 'Explorable', species: 'contour',
    title: 'A thousand people and a test',
    blurb: 'Why a positive result from a good test can still leave you probably fine: Bayes’ rule, counted out in people.',
    tags: ['Bayes', 'base rates'],
  },
  {
    slug: 'stats/least-squares', plate: 3, series: 'stats', kind: 'Explorable', species: 'flow',
    title: 'Least squares, by hand',
    blurb: 'Drag the points and watch the best-fit line chase them. Then try to guess a correlation by eye.',
    tags: ['regression', 'correlation'],
  },
  {
    slug: 'art', plate: 4, kind: 'Gallery', species: 'radial',
    title: 'A gallery of seeds',
    blurb: 'Eight drawings made by small programs. Each one comes from a number: change the number and you get a sibling.',
    tags: ['generative', 'seeds'],
  },
  {
    slug: 'keeling', plate: 5, kind: 'Story', species: 'orbit',
    title: 'The curve on the mountain',
    blurb: 'Sixty-eight years of carbon dioxide measured on a Hawaiian volcano: a line that breathes every year and climbs every decade.',
    tags: ['climate', 'data'],
  },
];

export const seriesById = (id: string | undefined): Series | undefined => series.find((x) => x.id === id);
export const platesIn = (id: string): LabEntry[] => lab.filter((e) => e.series === id).sort((a, b) => a.plate - b.plate);
/** "Plates I–III" (or "Plate IV" for a one-plate series). */
export function plateRange(id: string): string {
  const ps = platesIn(id);
  if (!ps.length) return '';
  return ps.length === 1 ? `Plate ${roman(ps[0].plate)}` : `Plates ${roman(ps[0].plate)}–${roman(ps.at(-1)!.plate)}`;
}
/** Newest plates first. */
export const latestPlates = (n: number): LabEntry[] => [...lab].sort((a, b) => b.plate - a.plate).slice(0, n);

export const labEntry = (slug: string): LabEntry => {
  const e = lab.find((x) => x.slug === slug);
  if (!e) throw new Error(`No Lab entry for ${slug}`);
  return e;
};

const ROMAN: [number, string][] = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
export function roman(n: number): string {
  let out = '';
  for (const [v, s] of ROMAN) while (n >= v) { out += s; n -= v; }
  return out;
}
