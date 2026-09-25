// qa:claims — the site must not promise sections that aren't live (sweep 1, M7).
//
//   npm run build && npm run qa:claims
//
// Reads every built page's meta description, og:description and lede (.lede,
// .hero__lede). A mention of a section (game, build journal, agent-loop explainer, story)
// passes only if that section exists in dist/ — evidence: a plate page carrying
// data-lab-kind / data-lab-slug, or /notes/ — or if the sentence says it is still to come.
// Deliberately independent of src/lib/sections.ts, which writes the copy.
//
// Since sweep 2 (M2) it also checks the other direction, completeness: every kind of plate
// that is live and listed (not noindex) must be mentioned in the Home lede, the Home meta
// description and the /lab/ meta description. A kind with no mention rule below fails too,
// so a new kind can't slip out of the site's description unnoticed.
//
//   --dist <dir>   check another build (the self-test plants an omission in a copy)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DIST as BUILT } from './serve.mjs';
import { discoverRoutes, parseArgs } from './routes.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = parseArgs();
const DIST = typeof args.dist === 'string' ? path.resolve(args.dist) : BUILT;
const pages = discoverRoutes({ dist: DIST }).filter((r) => !r.redirect);
const html = new Map(pages.map((r) => [r.route, fs.readFileSync(r.file, 'utf8')]));
const kinds = new Set(), slugs = new Set();
for (const h of html.values()) {
  const k = h.match(/data-lab-kind="([^"]+)"/)?.[1], s = h.match(/data-lab-slug="([^"]+)"/)?.[1];
  if (k) kinds.add(k); if (s) slugs.add(s);
}
const live = {
  game: kinds.has('Game'),
  journal: fs.existsSync(path.join(DIST, 'notes', 'index.html')),
  'agent-loop': slugs.has('agent-loop'),
  story: kinds.has('Story'),
};
const MENTIONS = [
  ['game', /\bgames?\b/i],
  ['journal', /\bjournal\b|\bnotes section\b/i],
  ['agent-loop', /agent[- ]loop|inside the agent/i],
  ['story', /\bstory\b|scrollytelling/i],
];
const FUTURE = /still to come|on the way|coming soon|will be|planned/i;
const strip = (s) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();

const problems = [];
let checked = 0;
for (const [route, h] of html) {
  const texts = [
    ...[...h.matchAll(/<meta (?:name|property)="(?:description|og:description)" content="([^"]*)"/g)].map((m) => ['meta', m[1]]),
    ...[...h.matchAll(/<p class="[^"]*\b(?:hero__)?lede\b[^"]*"[^>]*>([\s\S]*?)<\/p>/g)].map((m) => ['lede', strip(m[1])]),
  ];
  for (const [where, text] of texts) {
    checked++;
    for (const sentence of text.split(/(?<=[.!?])\s+/)) {
      for (const [key, re] of MENTIONS) {
        if (re.test(sentence) && !live[key] && !FUTURE.test(sentence))
          problems.push(`${route} ${where}: mentions "${key}" (not live) in: "${sentence.slice(0, 140)}"`);
      }
    }
  }
}
// Completeness: every listed kind is named where the site describes itself.
const KIND_MENTIONS = {
  Explorable: /explorable/i,
  Gallery: /drawings|gallery/i,
  Story: /\bstory\b|scrollytelling/i,
  Explainer: /agent[- ]loop|inside the agent|explainer/i,
  Simulation: /simulation/i,
  Game: /\bgames?\b/i,
};
const listedKinds = new Set();
for (const h of html.values()) {
  const k = h.match(/data-lab-kind="([^"]+)"/)?.[1];
  if (k && !/<meta name="robots" content="noindex"/.test(h)) listedKinds.add(k);
}
const metaOf = (h) => h?.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '';
const selfDescriptions = [
  ['/ lede', strip(html.get('/')?.match(/<p class="[^"]*\bhero__lede\b[^"]*"[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? '')],
  ['/ meta', metaOf(html.get('/'))],
  ['/lab/ meta', metaOf(html.get('/lab/'))],
];
for (const kind of listedKinds) {
  const re = KIND_MENTIONS[kind];
  if (!re) { problems.push(`OMISSION no mention rule for plate kind "${kind}" (add it to KIND_MENTIONS and to src/lib/sections.ts)`); continue; }
  for (const [where, text] of selfDescriptions) {
    checked++;
    if (!re.test(text)) problems.push(`OMISSION ${where} never mentions the live kind "${kind}": "${text.slice(0, 160)}"`);
  }
}

console.log(`live: ${Object.entries(live).map(([k, v]) => `${k}=${v ? 'yes' : 'no'}`).join(', ')}`);
console.log(`listed kinds: ${[...listedKinds].sort().join(', ')}`);
for (const p of problems) console.log(p.startsWith('OMISSION') ? p : 'PROMISE ' + p);
const omissions = problems.filter((p) => p.startsWith('OMISSION')).length;
console.log(`${pages.length} page(s), ${checked} text check(s), ${problems.length - omissions} unkept promise(s), ${omissions} omission(s)`);
process.exitCode = problems.length ? 1 : 0;
