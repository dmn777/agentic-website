// Public Sanity configuration for the Notes section. These values are public by design
// (the dataset is public; see SANITY.md). The Studio (studio/) reads the same object.
// `source` picks where the Notes adapter reads posts at build time. Since T16 it is Sanity,
// the source of truth; the seeds are import-only (NOTES_SOURCE=seeds overrides for offline work).
export const sanityConfig = {
  projectId: 'iqqgfhxj',
  dataset: 'production',
  apiVersion: '2026-09-25',
  source: 'sanity' as 'seeds' | 'sanity',
};
