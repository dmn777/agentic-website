// The Notes view model, shared by both sources (local seeds and Sanity).
import { toPlainText, type PTBlock } from './markdown-to-pt.ts';

export interface Note {
  slug: string; title: string; date: string; excerpt: string; tags: string[]; model: string;
  /** The full publication time (ISO, UTC). `date` is its UTC day, for display. */
  published: string;
  body: PTBlock[];
  /** Optional route of the Lab plate the post belongs to. */
  labPage?: string;
  /** Sanity image asset ids used in the body (copied into the site at build time). */
  images: string[];
  /** Position in the journal, 1 = first entry. */
  number: number;
  words: number;
  minutes: number;
}
/** What the Home slot and listings need. */
export type NoteSummary = Pick<Note, 'slug' | 'title' | 'date' | 'excerpt' | 'tags' | 'model' | 'number' | 'minutes'>;

export type NoteCore = Omit<Note, 'number' | 'words' | 'minutes'>;

/** Numbers entries in the order given (oldest first), adds word counts, returns newest first. */
export function finishNotes(chronological: NoteCore[]): Note[] {
  return chronological
    .map((n, i) => {
      const words = toPlainText(n.body).split(/\s+/).filter(Boolean).length;
      return { ...n, number: i + 1, words, minutes: Math.max(1, Math.round(words / 220)) };
    })
    .reverse();
}
