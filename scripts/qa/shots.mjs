// qa:shots — screenshot + console/overflow gate over the built site (TESTING.md §Gates 4).
//
//   npm run qa:shots [-- --routes /,/lab/art/] [--label T7] [--variants desktop-light,mobile-dark]
//                    [--include-v1] [--no-states] [--out ../qa/custom]
//
// Serves dist/ with GitHub-Pages semantics (serve.mjs), then for every route and variant:
// loads the page, scrolls through it (so client:visible islands hydrate), and fails on
// console errors, uncaught page errors, same-origin 4xx/5xx or failed requests, horizontal
// overflow at 390 px, and blank canvases on pages that declare data-qa-canvas.
// Pages that declare data-qa-motion also get a reduced-motion shot.
// Interaction states live in scripts/qa/states/*.mjs (see README there).
// Output: ../qa/<date>/<label>/*.png, thumbs/*.jpg (half-size), tiles/*-<k>.jpg (desktop
// shots cut into readable 1000 px-wide sections; mobile shots as side-by-side strips — give
// reviewers these), summary.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import { start } from './serve.mjs';
import { discoverRoutes, slugOf, today, parseArgs } from './routes.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(here, '../..');
const args = parseArgs();

export const VARIANTS = {
  'desktop-light': { viewport: { width: 1440, height: 900 }, colorScheme: 'light' },
  'desktop-dark': { viewport: { width: 1440, height: 900 }, colorScheme: 'dark' },
  'mobile-light': { viewport: { width: 390, height: 844 }, colorScheme: 'light', mobile: true },
  'mobile-dark': { viewport: { width: 390, height: 844 }, colorScheme: 'dark', mobile: true },
  'desktop-light-rm': { viewport: { width: 1440, height: 900 }, colorScheme: 'light', reducedMotion: 'reduce', motionOnly: true },
};

export function contextOptions(v) {
  return {
    viewport: v.viewport,
    colorScheme: v.colorScheme,
    reducedMotion: v.reducedMotion ?? 'no-preference',
    hasTouch: !!v.mobile,
    isMobile: !!v.mobile,
    deviceScaleFactor: 1,
  };
}

/** Collapse repeated problems into one entry with a count. */
export function dedupe(problems) {
  const seen = new Map();
  for (const p of problems) {
    const k = p.kind + '|' + p.text;
    if (seen.has(k)) seen.get(k).count++;
    else seen.set(k, { ...p, count: 1 });
  }
  return [...seen.values()].map((p) => (p.count > 1 ? { ...p, text: `${p.text} (×${p.count})` } : { kind: p.kind, text: p.text }));
}

/** Attach listeners that collect problems; returns the array they fill. */
export function watch(page, origin) {
  const problems = [];
  page.on('console', (m) => { if (m.type() === 'error') problems.push({ kind: 'console', text: m.text().slice(0, 400) }); });
  page.on('pageerror', (e) => problems.push({ kind: 'pageerror', text: String(e?.message ?? e).slice(0, 400) }));
  page.on('response', (r) => {
    if (r.url().startsWith(origin) && r.status() >= 400 && r.request().resourceType() !== 'document')
      problems.push({ kind: 'http', text: `${r.status()} ${r.url().slice(origin.length)}` });
  });
  page.on('requestfailed', (r) => {
    const err = r.failure()?.errorText ?? '';
    if (r.url().startsWith(origin) && err !== 'net::ERR_ABORTED')
      problems.push({ kind: 'requestfailed', text: `${err} ${r.url().slice(origin.length)}` });
  });
  return problems;
}

/** Wait for load, fonts, and scroll the whole page once so lazy islands hydrate. */
export async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  await page.evaluate(() => document.fonts?.ready);
  await page.evaluate(async () => {
    const step = Math.max(200, Math.floor(innerHeight * 0.8));
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    scrollTo(0, 0);
  });
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  // Let finite animations (plotter drawings, reveals) finish so shots show final states.
  await page.waitForFunction(() => document.getAnimations().every((a) =>
    a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity), null, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(300);
}

/** Elements sticking out past the right edge (for overflow diagnostics). Compares with the
 *  configured viewport width, not innerWidth: mobile emulation widens the layout viewport
 *  to fit overflowing content, which would hide the very overflow we are looking for. */
async function overflow(page, W) {
  return page.evaluate((W) => {
    if (document.documentElement.scrollWidth <= W) return null;
    const culprits = [];
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (r.right > W + 1 && r.width > 0) {
        culprits.push(el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''));
        if (culprits.length >= 6) break;
      }
    }
    return { scrollWidth: document.documentElement.scrollWidth, innerWidth: W, culprits };
  }, W);
}

/** Canvases inside [data-qa-canvas] must show more than one colour. */
async function blankCanvases(page) {
  const blank = [];
  const handles = await page.$$('[data-qa-canvas] canvas, canvas[data-qa-canvas]');
  for (const [i, h] of handles.entries()) {
    const box = await h.boundingBox();
    if (!box || box.width < 2 || box.height < 2) { blank.push(`canvas#${i} has no size`); continue; }
    await h.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(300);
    const png = PNG.sync.read(await h.screenshot());
    const colours = new Set();
    for (let p = 0; p < png.data.length && colours.size < 3; p += 4 * 97) colours.add(png.data.readUInt32BE(p));
    if (colours.size < 2) blank.push(`canvas#${i} is a single colour`);
  }
  return blank;
}

/** Half-size JPEG via the browser's own canvas (no image dependency). */
async function thumb(browser, pngPath, jpgPath, scale = 0.5) {
  const page = await browser.newPage();
  const b64 = fs.readFileSync(pngPath).toString('base64');
  const data = await page.evaluate(async ({ b64, scale }) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale);
    c.height = Math.min(Math.round(img.height * scale), 16000);
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(img, 0, 0, c.width, Math.round(img.height * scale));
    return c.toDataURL('image/jpeg', 0.78).split(',')[1];
  }, { b64, scale });
  fs.writeFileSync(jpgPath, Buffer.from(data, 'base64'));
  await page.close();
}

/** Cut a tall desktop shot into ~1400 px-high tiles scaled to 1000 px wide (JPEG), so a
 *  reviewer can read a long page at legible size, section by section. */
async function tiles(browser, pngPath, outPrefix, tileH = 1400, width = 1000) {
  const page = await browser.newPage();
  const b64 = fs.readFileSync(pngPath).toString('base64');
  const parts = await page.evaluate(async ({ b64, tileH, width }) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const k = width / img.width, out = [];
    for (let y = 0; y < img.height; y += tileH) {
      const h = Math.min(tileH, img.height - y);
      const c = document.createElement('canvas');
      c.width = width; c.height = Math.round(h * k);
      const g = c.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.drawImage(img, 0, y, img.width, h, 0, 0, c.width, c.height);
      out.push(c.toDataURL('image/jpeg', 0.82).split(',')[1]);
    }
    return out;
  }, { b64, tileH, width });
  parts.forEach((d, i) => fs.writeFileSync(`${outPrefix}-${i + 1}.jpg`, Buffer.from(d, 'base64')));
  await page.close();
  return parts.length;
}

/** Mobile shots are narrow and very tall: lay 1600 px slices side by side, three per image
 *  (≈1210×1600 JPEG), so a reviewer reads a whole phone page in a few images. */
async function strips(browser, pngPath, outPrefix, sliceH = 1600, perImage = 3, gap = 20) {
  const page = await browser.newPage();
  const b64 = fs.readFileSync(pngPath).toString('base64');
  const parts = await page.evaluate(async ({ b64, sliceH, perImage, gap }) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const slices = Math.ceil(img.height / sliceH), out = [];
    for (let s0 = 0; s0 < slices; s0 += perImage) {
      const n = Math.min(perImage, slices - s0);
      const c = document.createElement('canvas');
      c.width = n * img.width + (n - 1) * gap; c.height = sliceH;
      const g = c.getContext('2d');
      g.fillStyle = '#808080'; g.fillRect(0, 0, c.width, c.height);
      for (let k = 0; k < n; k++) {
        const y = (s0 + k) * sliceH, h = Math.min(sliceH, img.height - y);
        g.drawImage(img, 0, y, img.width, h, k * (img.width + gap), 0, img.width, h);
      }
      out.push(c.toDataURL('image/jpeg', 0.82).split(',')[1]);
    }
    return out;
  }, { b64, sliceH, perImage, gap });
  parts.forEach((d, i) => fs.writeFileSync(`${outPrefix}-${i + 1}.jpg`, Buffer.from(d, 'base64')));
  await page.close();
  return parts.length;
}

async function pool(items, n, fn) {
  const out = [];
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
  }));
  return out;
}

async function loadStates() {
  const dir = path.join(here, 'states');
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.mjs'));
  const mods = await Promise.all(files.map((f) => import(pathToFileURL(path.join(dir, f)).href)));
  // A module exports one { route, states } or an array of them.
  return mods.flatMap((m, k) => [m.default].flat().filter(Boolean)
    .flatMap((d) => (d.states ?? []).map((s) => ({ ...s, route: d.route, source: files[k] }))));
}

async function main() {
  const label = args.label ?? 'adhoc';
  const outDir = path.resolve(SITE, args.out ?? path.join('..', 'qa', today(), label));
  fs.mkdirSync(path.join(outDir, 'thumbs'), { recursive: true });
  fs.mkdirSync(path.join(outDir, 'tiles'), { recursive: true });

  let routes = discoverRoutes({ includeV1: !!args['include-v1'] });
  if (args.routes) {
    const want = String(args.routes).split(',').map((r) => r.trim()).filter(Boolean);
    const missing = want.filter((w) => !routes.some((r) => r.route === w));
    if (missing.length) throw new Error(`Routes not in dist/: ${missing.join(', ')}`);
    routes = routes.filter((r) => want.includes(r.route));
  }
  const skipped = routes.filter((r) => r.redirect).map((r) => r.route);
  routes = routes.filter((r) => !r.redirect);
  const variantNames = args.variants ? String(args.variants).split(',') : Object.keys(VARIANTS);

  const server = await start();
  const browser = await chromium.launch();
  const jobs = routes.flatMap((r) => variantNames
    .filter((v) => !VARIANTS[v].motionOnly || r.motion)
    .map((v) => ({ r, v })));

  const results = await pool(jobs, 4, async ({ r, v }) => {
    const spec = VARIANTS[v];
    const ctx = await browser.newContext(contextOptions(spec));
    const page = await ctx.newPage();
    const problems = watch(page, server.origin);
    const name = `${slugOf(r.route)}__${v}`;
    try {
      const resp = await page.goto(server.url(r.route), { waitUntil: 'load' });
      if (resp?.status() !== 200) problems.push({ kind: 'http', text: `document ${resp?.status()}` });
      await settle(page);
      if (spec.mobile) {
        const o = await overflow(page, spec.viewport.width);
        if (o) problems.push({ kind: 'overflow', text: `scrollWidth ${o.scrollWidth} > ${o.innerWidth}: ${o.culprits.join(', ')}` });
      }
      if (r.canvas) for (const b of await blankCanvases(page)) problems.push({ kind: 'canvas', text: b });
      await page.evaluate(() => scrollTo(0, 0));
      const file = path.join(outDir, name + '.png');
      await page.screenshot({ path: file, fullPage: true });
      await thumb(browser, file, path.join(outDir, 'thumbs', name + '.jpg'), spec.mobile ? 1 : 0.5);
      if (!spec.mobile) await tiles(browser, file, path.join(outDir, 'tiles', name));
      else await strips(browser, file, path.join(outDir, 'tiles', name));
    } catch (e) {
      problems.push({ kind: 'runner', text: String(e?.message ?? e).split('\n')[0] });
    }
    await ctx.close();
    const uniq = dedupe(problems);
    return { route: r.route, variant: v, file: name + '.png', problems: uniq, ok: uniq.length === 0 };
  });

  // Interaction states
  const stateResults = [];
  if (!args['no-states']) {
    const states = (await loadStates()).filter((s) => routes.some((r) => r.route === s.route));
    for (const s of states) {
      const v = s.variant ?? 'desktop-light';
      const ctx = await browser.newContext(contextOptions(VARIANTS[v]));
      const page = await ctx.newPage();
      const problems = watch(page, server.origin);
      const name = `${slugOf(s.route)}__state-${s.name}__${v}`;
      try {
        await page.goto(server.url(s.route), { waitUntil: 'load' });
        await settle(page);
        await s.run(page);
        await page.waitForTimeout(s.wait ?? 500);
        const file = path.join(outDir, name + '.png');
        await page.screenshot({ path: file, fullPage: !!s.fullPage });
        await thumb(browser, file, path.join(outDir, 'thumbs', name + '.jpg'), s.fullPage ? 0.5 : 0.75);
      } catch (e) {
        problems.push({ kind: 'runner', text: String(e?.message ?? e).split('\n')[0] });
      }
      await ctx.close();
      // A state may expect specific console errors (e.g. the 404 of a deliberately missing page).
      const allowed = (p) => p.kind === 'console' && (s.allowConsole ?? []).some((re) => re.test(p.text));
      const kept = dedupe(problems.filter((p) => !allowed(p)));
      stateResults.push({ route: s.route, state: s.name, variant: v, source: s.source, file: name + '.png', problems: kept, allowed: problems.length - kept.length, ok: kept.length === 0 });
    }
  }

  await browser.close();
  await server.close();

  const all = [...results, ...stateResults];
  const summary = {
    label, date: today(), when: new Date().toISOString(), outDir,
    ok: all.every((x) => x.ok),
    routes: routes.map((r) => r.route), skippedRedirects: skipped,
    results, states: stateResults,
  };
  fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));

  for (const x of all) {
    const tag = x.ok ? 'ok  ' : 'FAIL';
    console.log(`${tag} ${x.route} ${x.state ? '[' + x.state + '] ' : ''}${x.variant}`);
    for (const p of x.problems) console.log(`       ${p.kind}: ${p.text}`);
  }
  if (skipped.length) console.log(`skipped redirect stubs: ${skipped.join(', ')}`);
  console.log(`\n${all.filter((x) => x.ok).length}/${all.length} ok → ${path.relative(SITE, outDir)}/summary.json`);
  process.exitCode = summary.ok ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(2); });
}
