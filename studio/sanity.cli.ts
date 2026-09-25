import { defineCliConfig } from 'sanity/cli';
import { sanityConfig } from '../src/lib/notes/sanity.config';

export default defineCliConfig({
  api: { projectId: sanityConfig.projectId, dataset: sanityConfig.dataset },
  // Hosted at https://agentic-website.sanity.studio. The appId came from the first
  // `sanity deploy`; with it, later deploys run without prompts.
  deployment: { appId: 'bsnegwqfz43grndlbeivarpt', autoUpdates: false },
});
