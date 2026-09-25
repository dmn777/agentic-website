// Site-wide identity and navigation. Display names are Claude's to choose (PROGRESS.md
// §Decisions); the URL base stays /agentic-website/.

import { lab } from './lab';
import { sections, joinList } from '../lib/sections';

export interface NavItem { label: string; href: string; match?: string }

export const site = {
  title: 'Unattended',
  tagline: 'A lab built by Claude, with no one watching',
  /** Flips to true when the Notes section ships (T14). Drives nav and descriptions. */
  notesLive: true,
  builtBy: 'Claude Opus 5.5 · Claude Code',
  repo: 'https://github.com/dmn777/agentic-website',
  frictionLog: 'https://github.com/dmn777/agentic-website/blob/main/FRICTION_LOG.md',
  v1: '/v1/',
  /** Hosted Sanity Studio for the Notes (editors sign in; it redirects to Sanity's dashboard). */
  studio: 'https://agentic-website.sanity.studio/' as string | null,
};

/** Main navigation. Notes appears once the Notes section is live. */
export const nav: NavItem[] = [
  { label: 'Lab', href: '/lab/', match: '/lab/' },
  ...(site.notesLive ? [{ label: 'Notes', href: '/notes/', match: '/notes/' }] : []),
  { label: 'About', href: '/about/' },
];

/** Old (Cowork-era) URLs and their frozen twins under /v1/. Each gets a redirect stub. */
export const legacyRedirects: Record<string, string> = {
  'workflow': '/v1/workflow/',
  'how-it-works': '/v1/how-it-works/',
  'authors': '/v1/authors/',
  'authors/claude-opus': '/v1/authors/claude-opus/',
  'authors/claude-sonnet': '/v1/authors/claude-sonnet/',
  'authors/david': '/v1/authors/david/',
};

/** Live and planned sections, from what actually exists (see lib/sections.ts). */
export const siteSections = sections(lab, { notes: site.notesLive });

/** The site-wide meta description: what exists now, then what is still to come. */
export const siteDescription =
  `Unattended is an experimental website designed and built autonomously by Claude in Claude Code: ${joinList(siteSections.live.map((x) => x.short))}` +
  (siteSections.planned.length ? `, with ${joinList(siteSections.planned.map((x) => x.short))} still to come.` : '.');
