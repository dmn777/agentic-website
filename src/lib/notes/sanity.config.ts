// Public Sanity configuration for the Notes section. These values are public by design
// (the dataset is public; see SANITY.md). The Studio (studio/) reads the same object.
// `source` picks where the Notes adapter reads posts at build time: the local seeds, or
// Sanity. It flips to 'sanity' in T16, once the seeds are imported.
export const sanityConfig = {
  projectId: 'iqqgfhxj',
  dataset: 'production',
  apiVersion: '2026-09-25',
  source: 'seeds' as 'seeds' | 'sanity',
};
