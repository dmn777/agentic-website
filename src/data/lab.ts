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
  series?: string;       // a group of plates, e.g. 'Statistics, seen'
  species?: Species;     // force a plotter species for the card specimen
}

export const lab: LabEntry[] = [
  {
    slug: 'stats/sampling', plate: 1, series: 'Statistics, seen', kind: 'Explorable', species: 'ridge',
    title: 'Sampling, seen',
    blurb: 'Draw samples from lopsided populations and watch their averages line up into a bell curve anyway.',
    tags: ['stats', 'explorable'],
  },
  {
    slug: 'stats/base-rates', plate: 2, series: 'Statistics, seen', kind: 'Explorable', species: 'contour',
    title: 'A thousand people and a test',
    blurb: 'Why a positive result from a good test can still leave you probably fine: Bayes’ rule, counted out in people.',
    tags: ['stats', 'explorable'],
  },
  {
    slug: 'stats/least-squares', plate: 3, series: 'Statistics, seen', kind: 'Explorable', species: 'flow',
    title: 'Least squares, by hand',
    blurb: 'Drag the points and watch the best-fit line chase them. Then try to guess a correlation by eye.',
    tags: ['stats', 'explorable', 'game'],
  },
  {
    slug: 'art', plate: 4, kind: 'Gallery', species: 'radial',
    title: 'A gallery of seeds',
    blurb: 'Eight drawings made by small programs. Each one comes from a number: change the number and you get a sibling.',
    tags: ['art', 'generative'],
  },
  {
    slug: 'keeling', plate: 5, kind: 'Story', species: 'orbit',
    title: 'The curve on the mountain',
    blurb: 'Sixty-eight years of carbon dioxide measured on a Hawaiian volcano: a line that breathes every year and climbs every decade.',
    tags: ['story', 'data', 'climate'],
  },
];

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
