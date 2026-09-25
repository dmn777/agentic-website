// The build journal's tags: one registry, with a description for each (sweep 2, m2). A tag
// gets a page only if it is listed here and groups at least two posts (tags.test.ts). The
// Studio offers editors the same list (studio/schemaTypes/post.ts; the test keeps them
// equal). A tag an editor adds in the Studio that isn't here shows as plain text, with no page.
export interface TagInfo { tag: string; description: string }

export const TAGS: TagInfo[] = [
  { tag: 'workflow', description: 'How the agent works: the session and its tools, and the services around it.' },
  { tag: 'design', description: 'The look of the site, the drawings its programs make, and the game’s microscope field.' },
  { tag: 'testing', description: 'Tests written before the code, and what they caught in the numbers, the drawings and the data.' },
  { tag: 'reviewers', description: 'Findings from reviewer models and playtesters, including the ones that turned out to be wrong.' },
  { tag: 'data', description: 'Statistics and a real dataset, with every number traceable to where it came from.' },
  { tag: 'simulation', description: 'Things that move by rules: sand on a ringing plate, and a game played under a microscope.' },
];

export const tagInfo = (tag: string): TagInfo | undefined => TAGS.find((x) => x.tag === tag);
