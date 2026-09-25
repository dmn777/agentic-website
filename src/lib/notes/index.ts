// Notes adapter. Returns one view model whatever the source:
// - Sanity (the source of truth since T16): published posts, fetched once per build with
//   the anonymous client (public dataset, no token, no CDN cache);
// - the local seeds (content/notes-seed/NN-slug.md), converted with markdownToPortableText.
//   Used when sanityConfig.source is 'seeds', or with NOTES_SOURCE=seeds for offline work.
// A failed Sanity fetch fails the build: shipping stale seeds would silently undo edits.
import { createClient } from '@sanity/client';
import { parseSeed } from './markdown-to-pt';
import { finishNotes, type Note, type NoteSummary } from './note';
import { NOTES_QUERY, postsToNotes, type FetchedPost } from './sanity';
import { sanityConfig } from './sanity.config';

export type { Note, NoteSummary };

const seedFiles = import.meta.glob('/content/notes-seed/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

function fromSeeds(): Note[] {
  const chronological = Object.entries(seedFiles)
    .filter(([p]) => /\/\d\d-[^/]+\.md$/.test(p))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, src]) => {
      const { date, ...seed } = parseSeed(src);
      return { ...seed, date: date.slice(0, 10), images: [] };
    });
  return finishNotes(chronological);
}

async function fromSanity(): Promise<Note[]> {
  const { projectId, dataset, apiVersion } = sanityConfig;
  const client = createClient({ projectId, dataset, apiVersion, useCdn: false, perspective: 'published' });
  try {
    return postsToNotes(await client.fetch<FetchedPost[]>(NOTES_QUERY));
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 403) {
      // Project rule (SANITY.md §403 rule): escalate, don't work around it.
      throw new Error('Sanity refused the public Notes query (403). Stop and escalate per the project\'s Sanity 403 rule; do not switch the Notes back to the seeds without a decision.');
    }
    throw e;
  }
}

export const notesSource = (): 'seeds' | 'sanity' =>
  process.env.NOTES_SOURCE === 'seeds' || process.env.NOTES_SOURCE === 'sanity' ? process.env.NOTES_SOURCE : sanityConfig.source;

let cache: Promise<Note[]> | null = null;
/** All notes, newest first. */
export function allNotes(): Promise<Note[]> {
  cache ??= notesSource() === 'sanity' ? fromSanity() : Promise.resolve(fromSeeds());
  return cache;
}

export async function latestNotes(limit = 3): Promise<NoteSummary[]> {
  return (await allNotes()).slice(0, limit);
}

export async function allTags(): Promise<{ tag: string; count: number }[]> {
  const counts = new Map<string, number>();
  for (const n of await allNotes()) for (const t of n.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export const tagSlug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
