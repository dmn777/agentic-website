// Studio for the Notes section of Unattended, hosted on *.sanity.studio (never embedded in
// the static site). projectId and dataset come from the site's public config, so the two
// can't disagree.
import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { schemaTypes } from './schemaTypes';
import { sanityConfig } from '../src/lib/notes/sanity.config';

export default defineConfig({
  name: 'default',
  title: 'Unattended · Notes',
  projectId: sanityConfig.projectId,
  dataset: sanityConfig.dataset,
  plugins: [structureTool()],
  schema: { types: schemaTypes },
});
