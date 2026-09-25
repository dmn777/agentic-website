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
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { start, BASE, DIST } from './serve.mjs';
import { discoverRoutes, today, parseArgs } from './routes.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(here, '../..');
const args = parseArgs();

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
  const server = await start();
  const pages = discoverRoutes({ includeV1: true }).filter((r) => r.route.startsWith(scope));

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
  const sources = pages.map((r) => ({ page: r.route, html: fs.readFileSync(r.file, 'utf8') }));
  // Built CSS: url(...) references (fonts, images) resolved relative to the CSS file.
  for (const f of walkCss(path.join(DIST, '_astro'))) {
    const css = fs.readFileSync(f, 'utf8');
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
      if (checkFragments && abs.hash && abs.hash !== '#' && r.html && tag === 'a') {
        const id = decodeURIComponent(abs.hash.slice(1));
        if (!idsOf(r.html).has(id)) note(`missing #${id}`);
      }
    }
  }
  await server.close();

  const outDir = path.resolve(SITE, args.out ?? path.join('..', 'qa', today(), args.label ?? 'links'));
  fs.mkdirSync(outDir, { recursive: true });
  const summary = { scope, stayUnder: stayUnder ?? null, pages: pages.length, checked, broken, ok: broken.length === 0 };
  fs.writeFileSync(path.join(outDir, 'links.json'), JSON.stringify(summary, null, 2));
  for (const b of broken) console.log(`BROKEN ${b.page} → ${b.url} (${b.why})`);
  console.log(`${pages.length} page(s), ${checked} internal URL(s) checked, ${broken.length} broken → ${path.relative(SITE, outDir)}/links.json`);
  process.exitCode = summary.ok ? 0 : 1;
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
