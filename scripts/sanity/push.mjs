// notes:push — import Markdown posts into Sanity (T16).
//
//   npm run notes:push -- <file.md…> [--force] [--dry-run]
//
// Each file is parsed with the site's own converter (frontmatter + Markdown → Portable
// Text), its images are uploaded as Sanity assets, and the post is upserted by slug:
// - a new slug is created, published;
// - an existing slug is skipped unless --force, which replaces it under the id it
//   already has (so Studio links and history stay attached).
// publishedAt: a full timestamp in the frontmatter, else the file's first-commit time,
// else noon UTC on the frontmatter date. After pushing, run `npm run deploy:trigger` to
// rebuild the site. The token is read from the private secrets file and never printed.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseSeed } from '../../src/lib/notes/markdown-to-pt.ts';
import { publishedAtFor, seedToPost, postId } from '../../src/lib/notes/sanity.ts';
import { writeClient } from './client.mjs';

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const argv = process.argv.slice(2);
const force = argv.includes('--force');
const dryRun = argv.includes('--dry-run');
const files = argv.filter((a) => !a.startsWith('--'));
if (!files.length) {
  console.error('usage: npm run notes:push -- <file.md…> [--force] [--dry-run]');
  process.exit(2);
}

function firstCommit(file) {
  try {
    const out = execFileSync('git', ['log', '--diff-filter=A', '--follow', '--format=%aI', '--', file], { cwd: SITE, encoding: 'utf8' }).trim();
    return out.split('\n').filter(Boolean).pop();
  } catch { return undefined; }
}

/** Image bytes for a src in a post: a URL, a site path (under public/), or a path next to the file. */
async function imageBytes(src, file) {
  if (/^https?:\/\//.test(src)) {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`image ${src}: HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
  const p = src.startsWith('/') ? path.join(SITE, 'public', src) : path.resolve(path.dirname(file), src);
  return fs.readFileSync(p);
}

const client = dryRun ? null : writeClient();
let failed = 0;

for (const rel of files) {
  const file = path.resolve(process.cwd(), rel);
  try {
    const seed = parseSeed(fs.readFileSync(file, 'utf8'));
    const publishedAt = publishedAtFor(seed.date, firstCommit(file));

    const refs = new Map();
    for (const b of seed.body.filter((x) => x._type === 'image')) {
      if (refs.has(b.src)) continue;
      if (dryRun) { refs.set(b.src, 'image-dryrun0-1x1-png'); continue; }
      const asset = await client.assets.upload('image', await imageBytes(b.src, file), { filename: path.basename(b.src.split('?')[0]) });
      refs.set(b.src, asset._id); // Sanity dedupes by content, so re-uploads are no-ops
    }

    const doc = seedToPost(seed, { publishedAt, assetRef: (src) => refs.get(src) });
    const existing = dryRun ? [] : await client.fetch('*[_type == "post" && slug.current == $slug]._id', { slug: seed.slug });
    const baseIds = [...new Set(existing.map((id) => id.replace(/^drafts\./, '')))];
    if (baseIds.length > 1) throw new Error(`slug "${seed.slug}" is used by ${baseIds.length} documents: ${baseIds.join(', ')}`);
    const id = baseIds[0] ?? postId(seed.slug);
    const tag = `${seed.slug} (${id}, ${doc.body.length} blocks, ${refs.size} image(s), ${publishedAt})`;

    if (dryRun) { console.log(`dry-run  ${tag}`); continue; }
    if (baseIds.length && !force) { console.log(`skip     ${tag}: exists; --force replaces it`); continue; }
    await client.createOrReplace({ ...doc, _id: id });
    if (existing.includes(`drafts.${id}`)) console.log(`  note: an unpublished Studio draft of ${seed.slug} still exists`);
    console.log(`${baseIds.length ? 'replaced' : 'created '} ${tag}`);
  } catch (e) {
    failed++;
    console.error(`FAIL     ${rel}: ${e.statusCode ?? ''} ${e.message}`.replace(/\s+/g, ' '));
  }
}
if (failed) process.exitCode = 1;
