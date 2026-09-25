// qa:redirects: every first-edition URL must land on its /v1/ twin (TESTING.md, T5).
//
//   npm run qa:redirects [-- --live]
//
// Reads the map from src/data/site.ts (legacyRedirects), opens each old URL in Chromium
// (local GitHub-Pages-like server, or the live site with --live), and checks:
// the browser ends on the /v1/ URL with status 200, the #fragment survives, and the stub
// carries noindex + a canonical pointing at the target. Also checks the no-JS path
// (meta refresh) with JavaScript disabled.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { start, BASE } from './serve.mjs';
import { parseArgs } from './routes.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = fs.readFileSync(path.resolve(here, '../../src/data/site.ts'), 'utf8');
const block = src.match(/legacyRedirects[^{]*\{([\s\S]*?)\};/)?.[1] ?? '';
const map = [...block.matchAll(/'([^']+)':\s*'([^']+)'/g)].map(([, from, to]) => ({ from: `/${from}/`, to }));
if (!map.length) throw new Error('Could not read legacyRedirects from src/data/site.ts');

const args = parseArgs();
const server = args.live ? null : await start();
const origin = args.live ? 'https://dmn777.github.io' : server.origin;
const browser = await chromium.launch();
let failures = 0;

for (const js of [true, false]) {
  const ctx = await browser.newContext({ javaScriptEnabled: js });
  for (const { from, to } of map) {
    const page = await ctx.newPage();
    const hash = from === '/workflow/' ? '#friction-log-so-far' : '';
    const want = origin + BASE + to + (js ? hash : '');
    const problems = [];
    await page.goto(origin + BASE + from + hash, { waitUntil: 'load' });
    await page.waitForURL((u) => u.pathname === BASE + to, { timeout: 5000 }).catch(() => problems.push(`stayed at ${page.url()}`));
    const final = page.url();
    if (final.split('?')[0] !== want) problems.push(`ended at ${final}, wanted ${want}`);
    const status = (await page.request.get(final)).status();
    if (status !== 200) problems.push(`target status ${status}`);
    if (js) {
      const stub = await (await page.request.get(origin + BASE + from)).text();
      if (!/name="robots" content="noindex"/.test(stub)) problems.push('stub lacks noindex');
      if (!stub.includes(`rel="canonical" href="https://dmn777.github.io${BASE}${to}"`)) problems.push('stub canonical wrong');
    }
    failures += problems.length ? 1 : 0;
    console.log(`${problems.length ? 'FAIL' : 'ok  '} ${js ? 'js   ' : 'no-js'} ${from}${hash} → ${to}${problems.length ? '  ' + problems.join('; ') : ''}`);
    await page.close();
  }
  await ctx.close();
}
await browser.close();
await server?.close();
console.log(failures ? `\n${failures} redirect check(s) failed` : `\nall ${map.length * 2} redirect checks passed`);
process.exitCode = failures ? 1 : 0;
