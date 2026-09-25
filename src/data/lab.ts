// The single source of Lab metadata, shared by Home and /lab/ (T5). Only built pages are
// listed: no "coming soon" cards. A `draft` plate has a live, noindex page but no listing
// anywhere (Home, /lab/, neighbours' pagers, the site description) until the flag goes.
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
  draft?: boolean;       // built and deployed, but unlisted and noindex
}

/** Groups of plates with a hub page. Titles, hub labels and counts are derived from here. */
export interface Series { id: string; title: string; href: string; blurb: string }
export const series: Series[] = [
  {
    id: 'stats', title: 'Statistics, seen', href: '/lab/stats/',
    blurb: 'Three ideas that most of statistics rests on, each as something to pull on rather than a formula to memorise: why averages behave, why base rates matter, and what a best-fit line is fitting.',
  },
];

/** Every plate, drafts included. Listings use `lab`. */
export const plates: LabEntry[] = [
  {
    slug: 'stats/sampling', plate: 1, series: 'stats', kind: 'Explorable', species: 'ridge',
    title: 'Sampling, seen',
    blurb: 'Draw samples from odd-shaped populations and watch their averages line up into a bell curve anyway.',
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
  {
    slug: 'agent-loop', plate: 6, kind: 'Explainer', species: 'radial',
    title: 'Inside the loop',
    blurb: 'Replay a real task from the session that built this site: every model turn, tool call and result, and the context growing as it goes.',
    tags: ['agents', 'Claude Code'],
  },
  {
    slug: 'chladni', plate: 7, kind: 'Simulation', species: 'contour',
    title: 'The shape of a sound',
    blurb: 'Sand on a ringing plate runs off everything that moves and gathers on the lines that stay still. Pick a mode, shake the plate, and listen if you like.',
    tags: ['physics', 'sound'],
  },
  {
    slug: 'darkfield', plate: 8, kind: 'Game', species: 'valve',
    title: 'Darkfield',
    blurb: 'Loop your ink around drifting diatoms to catalogue them, before the pen runs dry.',
    tags: ['game', 'microscopy'],
  },
];

/** The listed plates: everything that is not a draft. */
export const lab: LabEntry[] = plates.filter((e) => !e.draft);

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

/** What a note's `labPage` route points at: a plate, or a series hub by its range. */
export function plateFor(route: string | undefined): { label: string; title: string; href: string } | undefined {
  if (!route) return undefined;
  const ser = series.find((x) => x.href === route);
  if (ser) return { label: plateRange(ser.id).replace(/^Plates?/, 'Pl.'), title: ser.title, href: ser.href };
  const e = plates.find((x) => `/lab/${x.slug}/` === route);
  return e ? { label: `Pl. ${roman(e.plate)}`, title: e.title, href: route } : undefined;
}

/** The labPage routes by which a note belongs to this plate: its own, then its series hub. */
export const journalRoutes = (e: LabEntry): string[] => [`/lab/${e.slug}/`, ...(seriesById(e.series) ? [seriesById(e.series)!.href] : [])];

export const labEntry = (slug: string): LabEntry => {
  const e = plates.find((x) => x.slug === slug);
  if (!e) throw new Error(`No Lab entry for ${slug}`);
  return e;
};

const ROMAN: [number, string][] = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
export function roman(n: number): string {
  let out = '';
  for (const [v, s] of ROMAN) while (n >= v) { out += s; n -= v; }
  return out;
}
