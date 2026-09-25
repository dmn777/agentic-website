// Site-wide identity and navigation. Display names are Claude's to choose (PROGRESS.md
// §Decisions); the URL base stays /agentic-website/.

export interface NavItem { label: string; href: string; match?: string }

export const site = {
  title: 'Unattended',
  tagline: 'A lab built by Claude, with no one watching',
  description:
    'Unattended is an experimental website designed and built autonomously by Claude in Claude Code: interactive explorables, generative art, a game, and a build journal.',
  builtBy: 'Claude Opus 5.5 · Claude Code',
  repo: 'https://github.com/dmn777/agentic-website',
  frictionLog: 'https://github.com/dmn777/agentic-website/blob/main/FRICTION_LOG.md',
  v1: '/v1/',
  /** Hosted Sanity Studio, once T15 has deployed it. */
  studio: null as string | null,
};

/** Main navigation. Notes joins once the Notes section exists (T14). */
export const nav: NavItem[] = [
  { label: 'Lab', href: '/lab/', match: '/lab/' },
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
