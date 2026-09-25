// Notes adapter. Returns one view model whatever the source:
// - Sanity (the source of truth since T16): published posts, fetched once per build with
//   the anonymous client (public dataset, no token, no CDN cache);
// - the local seeds (content/notes-seed/NN-slug.md), converted with markdownToPortableText.
//   Used when sanityConfig.source is 'seeds', or with NOTES_SOURCE=seeds for offline work.
// A failed Sanity fetch fails the build: shipping stale seeds would silently undo edits.
import { createClient } from '@sanity/client';
import { parseSeed } from './markdown-to-pt';
import { finishNotes, type Note, type NoteSummary } from './note';
import { NOTES_QUERY, postsToNotes, publishedAtFor, type FetchedPost } from './sanity';
import { sanityConfig } from './sanity.config';
import { TAGS } from '../../data/tags';

export type { Note, NoteSummary };

const seedFiles = import.meta.glob('/content/notes-seed/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

function fromSeeds(): Note[] {
  const chronological = Object.entries(seedFiles)
    .filter(([p]) => /\/\d\d-[^/]+\.md$/.test(p))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, src]) => {
      const { date, ...seed } = parseSeed(src);
      return { ...seed, date: date.slice(0, 10), published: publishedAtFor(date), images: [] };
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

/** The tags that get a page: in the registry (src/data/tags.ts) and on 2+ posts, in
 *  registry order. Any other tag is shown as plain text (sweep 2, m2). */
export async function allTags(): Promise<{ tag: string; count: number; description: string }[]> {
  const notes = await allNotes();
  return TAGS.map(({ tag, description }) => ({ tag, description, count: notes.filter((n) => n.tags.includes(tag)).length }))
    .filter((t) => t.count >= 2);
}

export const tagSlug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
