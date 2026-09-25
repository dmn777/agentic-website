// qa:links — internal link crawl over dist/ (TESTING.md §Milestone sweep 2).
//
//   npm run qa:links [-- --scope /v1/] [--stay-under /v1/] [--label sweep-1] [--no-fragments]
//
// For every HTML page under --scope (default: all, including /v1/), collects URLs from
// a[href], link[href], script/img/source/video/audio/iframe[src], [srcset], [poster],
// meta-refresh targets, plus url(...) in built CSS. Each same-origin URL must live under
// the base and resolve (after 301s) to 200 on the GitHub-Pages-like server. Fragments
// (#id) must exist in the target page. --stay-under additionally flags internal links
// that leave the given prefix (used to prove the /v1/ snapshot is self-contained).
// Also fails on orphans: indexable pages that no other page links to.
// And (T27, sweep 2 M1) on a broken journal pairing: a note that names a Lab page
// (data-lab-page) must link to it, and that page must link back to the note.
// And (sweep 3, M1) on a feed that isn't faithful: atom:self, channel and item links,
// newest-first dates, dc:creator, and each item's HTML matching its page (checkFeeds).
//   --dist <dir>   crawl another build (for self-tests with planted faults)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { start, BASE, DIST as BUILT } from './serve.mjs';
import { discoverRoutes, today, parseArgs } from './routes.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(here, '../..');
const args = parseArgs();
const DIST = typeof args.dist === 'string' ? path.resolve(args.dist) : BUILT;

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x2F;/gi, '/');

export function extractUrls(html) {
  const out = [];
  const tagRe = /<(a|link|script|img|source|video|audio|iframe|meta|use|image)\b([^>]*)>/gi;
  for (const [, tag, attrs] of html.matchAll(tagRe)) {
    const attr = (name) => attrs.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))?.slice(1).find((x) => x !== undefined);
    const t = tag.toLowerCase();
    if (t === 'meta') {
      if (/http-equiv\s*=\s*["']?refresh/i.test(attrs)) {
        const m = (attr('content') ?? '').match(/url\s*=\s*['"]?([^'";]+)/i);
        if (m) out.push({ tag: 'meta-refresh', url: decode(m[1].trim()) });
      }
      continue;
    }
    if (t === 'link' && /rel\s*=\s*["']?(preconnect|dns-prefetch)/i.test(attrs)) continue;
    for (const a of ['href', 'src', 'poster', 'xlink:href']) {
      const v = attr(a);
      if (v !== undefined && v !== '') out.push({ tag: t, url: decode(v) });
    }
    const srcset = attr('srcset');
    if (srcset) for (const part of srcset.split(',')) {
      const u = part.trim().split(/\s+/)[0];
      if (u) out.push({ tag: t, url: decode(u) });
    }
  }
  return out;
}

const idsOf = (html) => new Set([...html.matchAll(/\s(?:id|name)\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]));

async function main() {
  const scope = args.scope ?? '/';
  const stayUnder = args['stay-under'];
  const checkFragments = !args['no-fragments'];
  const server = await start(DIST);
  const pages = discoverRoutes({ dist: DIST, includeV1: true }).filter((r) => r.route.startsWith(scope));

  const cache = new Map(); // url (no hash) -> { status, finalUrl, html? }
  async function resolve(u) {
    if (cache.has(u)) return cache.get(u);
    const p = (async () => {
      let cur = u, status = 0, hops = 0, res;
      while (hops++ < 5) {
        res = await fetch(cur, { redirect: 'manual' });
        status = res.status;
        if (status >= 300 && status < 400 && res.headers.get('location')) { cur = new URL(res.headers.get('location'), cur).href; continue; }
        break;
      }
      const isHtml = (res.headers.get('content-type') ?? '').includes('text/html');
      return { status, finalUrl: cur, html: status === 200 && isHtml ? await res.text() : null };
    })();
    cache.set(u, p);
    return p;
  }

  const broken = [];
  let checked = 0;
  const inbound = new Map(); // route -> Set of source routes (a[href] only)
  const sources = pages.map((r) => ({ page: r.route, html: fs.readFileSync(r.file, 'utf8') }));
  // Built CSS: url(...) references (fonts, images) resolved relative to the CSS file.
  for (const f of walkCss(path.join(DIST, '_astro'))) {
    // Drop quoted data: URIs first: an inline SVG can contain url(#id) references of its own.
    const css = fs.readFileSync(f, 'utf8').replace(/url\(\s*"data:[^"]*"\s*\)/g, '').replace(/url\(\s*'data:[^']*'\s*\)/g, '');
    const rel = '/' + path.relative(DIST, f).split(path.sep).join('/');
    for (const m of css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g))
      if (!m[1].startsWith('data:')) sources.push({ page: rel, css: true, urls: [{ tag: 'css', url: m[1] }] });
  }

  for (const s of sources) {
    const pageUrl = server.url(s.page);
    const urls = s.urls ?? extractUrls(s.html);
    for (const { tag, url } of urls) {
      if (/^(mailto|tel|javascript|data|blob):/i.test(url)) continue;
      const abs = new URL(url, pageUrl);
      if (abs.origin !== server.origin) continue; // external: not gated
      checked++;
      const shown = abs.pathname + abs.hash;
      const note = (why) => broken.push({ page: s.page, tag, url, resolved: shown, why });
      if (!abs.pathname.startsWith(BASE + '/') && abs.pathname !== BASE) { note('outside the base path'); continue; }
      if (stayUnder && !s.css && s.page.startsWith(stayUnder) && !abs.pathname.startsWith(BASE + stayUnder)) {
        note(`leaves ${stayUnder}`);
      }
      const bare = abs.origin + abs.pathname + abs.search;
      const r = await resolve(bare);
      if (r.status !== 200) { note(`status ${r.status}`); continue; }
      if (tag === 'a' && !s.css) {
        const target = new URL(r.finalUrl).pathname.slice(BASE.length) || '/';
        if (target !== s.page) inbound.set(target, (inbound.get(target) ?? new Set()).add(s.page));
      }
      if (checkFragments && abs.hash && abs.hash !== '#' && r.html && tag === 'a') {
        const id = decodeURIComponent(abs.hash.slice(1));
        if (!idsOf(r.html).has(id)) note(`missing #${id}`);
      }
    }
  }
  const feeds = await checkFeeds({ sources, resolve, server, broken });
  await server.close();

  // Orphans: every indexable page needs at least one inbound link from another page
  // (sweep 1: the /lab/stats/ hub had none). Redirect stubs don't count as sources.
  const stubs = new Set(pages.filter((r) => r.redirect).map((r) => r.route));
  for (const r of pages) {
    const html = fs.readFileSync(r.file, 'utf8');
    if (r.redirect || r.route === '/404.html' || /<meta name="robots" content="noindex"/.test(html)) continue;
    const from = [...(inbound.get(r.route) ?? [])].filter((src) => !stubs.has(src));
    if (!from.length) broken.push({ page: r.route, tag: 'orphan', url: r.route, resolved: r.route, why: 'orphan: no inbound link from any other page' });
  }

  // Journal pairs: each note about a Lab page links to it, and the page links back.
  let pairs = 0;
  for (const r of pages) {
    const lab = fs.readFileSync(r.file, 'utf8').match(/data-lab-page="([^"]+)"/)?.[1];
    if (!lab || !r.route.startsWith('/notes/')) continue;
    pairs++;
    const linked = (from, to) => (inbound.get(to) ?? new Set()).has(from);
    if (!linked(r.route, lab)) broken.push({ page: r.route, tag: 'journal', url: lab, resolved: lab, why: `the note is about ${lab} but doesn't link to it` });
    if (!linked(lab, r.route)) broken.push({ page: lab, tag: 'journal', url: r.route, resolved: r.route, why: `no link back to its journal note ${r.route}` });
  }

  const outDir = path.resolve(SITE, args.out ?? path.join('..', 'qa', today(), args.label ?? 'links'));
  fs.mkdirSync(outDir, { recursive: true });
  const summary = { scope, stayUnder: stayUnder ?? null, pages: pages.length, checked, broken, ok: broken.length === 0 };
  fs.writeFileSync(path.join(outDir, 'links.json'), JSON.stringify(summary, null, 2));
  for (const b of broken) console.log(`BROKEN ${b.page} → ${b.url} (${b.why})`);
  console.log(`${pages.length} page(s), ${checked} internal URL(s) checked, ${pairs} journal pair(s), ${feeds} feed item(s), ${broken.length} broken → ${path.relative(SITE, outDir)}/links.json`);
  process.exitCode = summary.ok ? 0 : 1;
}

// Feeds (sweep 3, M1 and m11). Every RSS feed a page advertises must name itself
// (atom:self), point its channel and items at built pages, date its items in order, and
// carry each post whole: the item's HTML must have as many headings, list items, code
// blocks and links as the page's note body. Absolute production URLs are checked against
// the local server.
async function checkFeeds({ sources, resolve, server, broken }) {
  const unxml = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  const hrefs = new Set();
  for (const s of sources) for (const m of (s.html ?? '').matchAll(/<link[^>]+type="application\/rss\+xml"[^>]*>/g)) {
    const h = m[0].match(/href="([^"]+)"/)?.[1];
    if (h) hrefs.add(new URL(decode(h), server.url('/')).pathname);
  }
  let items = 0;
  for (const feedPath of hrefs) {
    const bad = (url, why) => broken.push({ page: feedPath, tag: 'feed', url, resolved: url, why });
    const res = await fetch(server.origin + feedPath);
    if (res.status !== 200) { bad(feedPath, `feed status ${res.status}`); continue; }
    const xml = await res.text();
    const self = xml.match(/<atom:link[^>]*rel="self"[^>]*>/)?.[0]?.match(/href="([^"]+)"/)?.[1];
    if (!self) { bad(feedPath, 'no atom:link rel="self"'); continue; }
    const prod = new URL(self);
    if (prod.pathname !== feedPath) bad(self, `atom:self is ${prod.pathname}, not the feed's own path ${feedPath}`);
    const local = async (u, why) => {
      const abs = new URL(u, prod);
      if (abs.origin !== prod.origin) return null;
      const r = await resolve(server.origin + abs.pathname + abs.search);
      if (r.status !== 200) bad(u, `${why}: status ${r.status}`);
      return r;
    };
    const channel = xml.slice(0, xml.indexOf('<item>'));
    const chLink = channel.match(/<link>([^<]+)<\/link>/)?.[1];
    if (!chLink) bad(feedPath, 'channel has no <link>');
    else await local(chLink, 'channel link');
    let prev = Infinity;
    for (const [, item] of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      items++;
      const link = item.match(/<link>([^<]+)<\/link>/)?.[1];
      if (!link) { bad(feedPath, 'an item has no <link>'); continue; }
      const page = await local(link, 'item link');
      const when = Date.parse(item.match(/<pubDate>([^<]+)<\/pubDate>/)?.[1] ?? '');
      if (Number.isNaN(when)) bad(link, 'no readable pubDate');
      else if (when > prev) bad(link, 'items are not newest first');
      else prev = when;
      if (/<author>(?![^<]*@)/.test(item)) bad(link, '<author> without an email (use dc:creator)');
      if (!/<dc:creator>[^<]+<\/dc:creator>/.test(item)) bad(link, 'no dc:creator');
      const content = unxml(item.match(/<content:encoded>([\s\S]*?)<\/content:encoded>/)?.[1]?.replace(/^<!\[CDATA\[|\]\]>$/g, '') ?? '');
      if (!content) { bad(link, 'no content:encoded'); continue; }
      for (const [, u] of content.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
        const url = unxml(u);
        if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) bad(link, `a relative URL in the item's HTML: ${url}`);
        else await local(url, 'a link inside the item');
      }
      const html = page?.html ?? '';
      const day = html.match(/<time datetime="([^"]+)"/)?.[1];
      if (day && !Number.isNaN(when) && new Date(when).toISOString().slice(0, 10) !== day) bad(link, `pubDate ${new Date(when).toISOString()} is not the page's date ${day}`);
      const start = html.indexOf('note-body'), end = html.indexOf('post__tags', start);
      if (start < 0 || end < 0) { bad(link, 'the page has no note body to compare with'); continue; }
      const body = html.slice(start, end);
      for (const [what, re] of [['heading', /<h[23][\s>]/g], ['list item', /<li[\s>]/g], ['code block', /<pre[\s>]/g], ['link', /<a\s/g]]) {
        const n = (s) => (s.match(re) ?? []).length;
        if (n(content) !== n(body)) bad(link, `the item has ${n(content)} ${what}(s), the page ${n(body)}`);
      }
    }
  }
  return items;
}

function walkCss(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkCss(p, out);
    else if (e.name.endsWith('.css')) out.push(p);
  }
  return out;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(2); });
}
