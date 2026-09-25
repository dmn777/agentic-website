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

/** Main navigation. Until the v2 launch (T5) this points at the old pages that still exist. */
export const nav: NavItem[] = [
  { label: 'Workflow', href: '/workflow/' },
  { label: 'How it works', href: '/how-it-works/' },
  { label: 'Authors', href: '/authors/', match: '/authors/' },
];
