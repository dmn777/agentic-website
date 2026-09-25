// Notes adapter. Returns one view model whatever the source:
// - local seeds (content/notes-seed/NN-slug.md), converted with markdownToPortableText;
// - Sanity, once sanityConfig.source is 'sanity' (wired in T16).
import { parseSeed, toPlainText, type PTBlock } from './markdown-to-pt';
import { sanityConfig } from './sanity.config';

export interface Note {
  slug: string; title: string; date: string; excerpt: string; tags: string[]; model: string;
  body: PTBlock[];
  /** Position in the journal, 1 = first entry. */
  number: number;
  words: number;
  minutes: number;
}
/** What the Home slot and listings need. */
export type NoteSummary = Pick<Note, 'slug' | 'title' | 'date' | 'excerpt' | 'tags' | 'model' | 'number' | 'minutes'>;

const seedFiles = import.meta.glob('/content/notes-seed/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

function fromSeeds(): Note[] {
  return Object.entries(seedFiles)
    .filter(([p]) => /\/\d\d-[^/]+\.md$/.test(p))
    .map(([p, src]) => {
      const seed = parseSeed(src);
      const number = Number(p.match(/\/(\d\d)-/)![1]);
      const words = toPlainText(seed.body).split(/\s+/).filter(Boolean).length;
      return { ...seed, number, words, minutes: Math.max(1, Math.round(words / 220)) };
    });
}

let cache: Promise<Note[]> | null = null;
/** All notes, newest first. */
export function allNotes(): Promise<Note[]> {
  cache ??= (async () => {
    if (sanityConfig.source === 'sanity') throw new Error('Sanity source is wired in T16');
    return fromSeeds().sort((a, b) => b.date.localeCompare(a.date) || b.number - a.number);
  })();
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
