// Sanity clients for scripts (T15+). The public config (projectId, dataset, apiVersion) is
// the same object the site and the Studio read; the write token comes from the private
// _secrets file and is never printed or logged.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@sanity/client';
import { sanityConfig } from '../../src/lib/notes/sanity.config.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
export const TOKEN_FILE = process.env.SANITY_TOKEN_FILE ?? path.resolve(here, '../../../_secrets/sanity_token.txt');

function token() {
  try { return fs.readFileSync(TOKEN_FILE, 'utf8').replace(/[\r\n ]/g, ''); }
  catch { throw new Error(`No Sanity token at ${TOKEN_FILE} (see SANITY.md §Setup, step 5)`); }
}

const base = { projectId: sanityConfig.projectId, dataset: sanityConfig.dataset, apiVersion: sanityConfig.apiVersion, useCdn: false };

/** Sanity said 403: a permission this setup relied on is gone (e.g. the trial ended). */
export const isForbidden = (e) => e?.statusCode === 403 || e?.response?.statusCode === 403;

/** Printed on a 403. The project's standing rule, not a hint to fix it here. */
export const FORBIDDEN_HELP = [
  '',
  '  SANITY 403: access refused. Project rule (SANITY.md §403 rule, David 2026-09-25):',
  '  1. Stop this step. Do not work around it: no new token, no role or plan change,',
  '     no switch of the Notes back to the local seeds.',
  '  2. Log an open question for /spec in PROGRESS.md (template in SANITY.md).',
  '  3. Treat every step that needs Sanity as blocked until David resolves it.',
  '  4. Tell David in the final message of the turn.',
  '',
].join('\n');

/** Anonymous client: what the public site and any visitor can read (published documents only). */
export const publicClient = () => createClient(base);

/** Authenticated editor client for scripts that write. Sees drafts (perspective 'raw'). */
export const writeClient = () => createClient({ ...base, token: token(), perspective: 'raw' });
