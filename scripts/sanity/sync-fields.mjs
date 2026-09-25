// notes:sync — copy chosen fields (labPage, tags) from the seeds' frontmatter onto the posts
// in Sanity (T27, T29).
//
//   npm run notes:sync [-- --dry-run] [--fields labPage,tags]
//
// Sanity is the Notes' source of truth, so this patches the named fields and nothing else:
// no replace, no other field touched, and Studio edits to titles and bodies survive
// (unlike `notes:push --force`). An unset labPage in a seed is left alone. On a 403 it
// stops with exit code 3 (SANITY.md §403 rule). The token is read from the private secrets
// file and never printed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSeed } from '../../src/lib/notes/markdown-to-pt.ts';
import { writeClient, isForbidden, FORBIDDEN_HELP } from './client.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(here, '../../content/notes-seed');
const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const fi = argv.indexOf('--fields');
const FIELDS = fi >= 0 ? argv[fi + 1].split(',') : ['labPage', 'tags'];
const client = writeClient();
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

try {
  let changed = 0;
  for (const f of fs.readdirSync(dir).filter((x) => /^\d\d-.*\.md$/.test(x)).sort()) {
    const seed = parseSeed(fs.readFileSync(path.join(dir, f), 'utf8'));
    const want = Object.fromEntries(FIELDS.filter((k) => seed[k] !== undefined).map((k) => [k, seed[k]]));
    if (!Object.keys(want).length) continue;
    const docs = await client.fetch(`*[_type == "post" && slug.current == $slug]{_id, ${FIELDS.join(', ')}}`, { slug: seed.slug });
    if (!docs.length) { console.log(`missing  ${seed.slug}: not in Sanity (notes:push it first)`); process.exitCode = 1; continue; }
    for (const d of docs) {
      const diff = Object.fromEntries(Object.entries(want).filter(([k, v]) => !same(d[k], v)));
      if (!Object.keys(diff).length) { console.log(`ok       ${seed.slug}`); continue; }
      const says = Object.entries(diff).map(([k, v]) => `${k}: ${JSON.stringify(d[k] ?? null)} → ${JSON.stringify(v)}`).join('; ');
      if (dryRun) { console.log(`dry-run  ${d._id}: ${says}`); continue; }
      await client.patch(d._id).set(diff).commit();
      console.log(`patched  ${d._id}: ${says}`);
      changed++;
    }
  }
  console.log(`${changed} post(s) patched${dryRun ? ' (dry run)' : ''}. Rebuild the site to show the change.`);
} catch (e) {
  if (isForbidden(e)) { console.error(FORBIDDEN_HELP); process.exit(3); }
  throw e;
}
