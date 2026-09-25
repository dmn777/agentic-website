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
  species?: Species;     // force a plotter species for the card specimen
}

export const lab: LabEntry[] = [];

const ROMAN: [number, string][] = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
export function roman(n: number): string {
  let out = '';
  for (const [v, s] of ROMAN) while (n >= v) { out += s; n -= v; }
  return out;
}
