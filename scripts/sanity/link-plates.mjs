// notes:link — set each post's `labPage` in Sanity from its seed's frontmatter (T27).
//
//   npm run notes:link [-- --dry-run]
//
// Sanity is the Notes' source of truth, so this patches the one field and nothing else:
// no replace, no other field touched, and Studio edits survive. A post whose seed has no
// labPage is left alone (unset it in the Studio if needed). On a 403 it stops with exit
// code 3 (SANITY.md §403 rule). The token is read from the private secrets file and never
// printed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSeed } from '../../src/lib/notes/markdown-to-pt.ts';
import { writeClient, isForbidden, FORBIDDEN_HELP } from './client.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(here, '../../content/notes-seed');
const dryRun = process.argv.includes('--dry-run');
const client = writeClient();

try {
  let changed = 0;
  for (const f of fs.readdirSync(dir).filter((x) => /^\d\d-.*\.md$/.test(x)).sort()) {
    const seed = parseSeed(fs.readFileSync(path.join(dir, f), 'utf8'));
    if (!seed.labPage) continue;
    const docs = await client.fetch('*[_type == "post" && slug.current == $slug]{_id, labPage}', { slug: seed.slug });
    if (!docs.length) { console.log(`missing  ${seed.slug}: not in Sanity (notes:push it first)`); process.exitCode = 1; continue; }
    for (const d of docs) {
      if (d.labPage === seed.labPage) { console.log(`ok       ${seed.slug} → ${seed.labPage}`); continue; }
      if (dryRun) { console.log(`dry-run  ${d._id}: ${d.labPage ?? '(none)'} → ${seed.labPage}`); continue; }
      await client.patch(d._id).set({ labPage: seed.labPage }).commit();
      console.log(`patched  ${d._id}: ${d.labPage ?? '(none)'} → ${seed.labPage}`);
      changed++;
    }
  }
  console.log(`${changed} post(s) patched${dryRun ? ' (dry run)' : ''}. Rebuild the site to show the links.`);
} catch (e) {
  if (isForbidden(e)) { console.error(FORBIDDEN_HELP); process.exit(3); }
  throw e;
}
