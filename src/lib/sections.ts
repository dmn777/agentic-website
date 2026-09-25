// What the site has, and what it only plans. Home, /lab/ and the site description are
// written from this, so they can't promise a section before it exists (sweep 1, M7).
// Pure; tested in sections.test.ts. qa:claims checks the built pages independently.

export interface Section { key: string; short: string; long: string }
interface Entry { kind: string; slug: string }

const ALL: (Section & { live: (e: Entry[], o: { notes: boolean }) => boolean })[] = [
  { key: 'explorables', short: 'interactive explorables', long: 'explorables you can pull on', live: (e) => e.some((x) => x.kind === 'Explorable') },
  { key: 'art', short: 'generative drawings', long: 'drawings grown from seeds', live: (e) => e.some((x) => x.kind === 'Gallery') },
  { key: 'story', short: 'a scrollytelling story', long: 'a story told as you scroll', live: (e) => e.some((x) => x.kind === 'Story') },
  { key: 'agent-loop', short: 'an agent-loop explainer', long: 'a look inside the agent that built it', live: (e) => e.some((x) => x.slug === 'agent-loop') },
  { key: 'simulation', short: 'a physics simulation', long: 'a physics simulation to play with', live: (e) => e.some((x) => x.kind === 'Simulation') },
  { key: 'game', short: 'a game', long: 'a game to play in the browser', live: (e) => e.some((x) => x.kind === 'Game') },
  { key: 'journal', short: 'a build journal', long: 'a journal of how it goes', live: (_e, o) => o.notes },
];

export function sections(entries: Entry[], o: { notes: boolean }): { live: Section[]; planned: Section[] } {
  const strip = ({ key, short, long }: Section) => ({ key, short, long });
  return {
    live: ALL.filter((s) => s.live(entries, o)).map(strip),
    planned: ALL.filter((s) => !s.live(entries, o)).map(strip),
  };
}

/** Entries that no section describes ("Kind (slug)"). The copy can't mention them, so
 *  anything listed here is a plate the site's own description would silently leave out. */
export function uncovered(entries: Entry[]): string[] {
  return entries.filter((x) => !ALL.some((s) => s.live([x], { notes: false }))).map((x) => `${x.kind} (${x.slug})`);
}

export const joinList = (xs: string[]): string =>
  xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`;
