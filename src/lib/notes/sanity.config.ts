// Public Sanity configuration for the Notes section. These values are public by design
// (the dataset is public; see SANITY.md). projectId stays null until T15 creates the
// project; while it is null, the Notes adapter reads the local seeds instead.
export const sanityConfig = {
  projectId: null as string | null,
  dataset: 'production',
  apiVersion: '2026-09-25',
};
