// Notes adapter (placeholder). T14 replaces this with the real adapter: local Markdown
// seeds → Portable Text at build time, or Sanity once a projectId is configured.

export interface NoteSummary {
  slug: string;
  title: string;
  date: string;      // YYYY-MM-DD
  excerpt: string;
  tags: string[];
  model: string;
}

/** Newest first. Empty until the Notes section exists, which hides the Home slot. */
export async function latestNotes(_limit = 3): Promise<NoteSummary[]> {
  return [];
}
