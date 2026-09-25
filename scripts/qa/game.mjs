// qa:game — Darkfield's harness (TESTING.md §Game). Drives the built game through its
// ?test=1 hook (window.__game), so every check is deterministic and runs in simulated time.
//
//   npm run build && npm run qa:game [-- --only state-machine,random-bots] [--label T12]
//
// Each check gets a fresh page and fails on a thrown error, a console error or an uncaught
// page error. Output: ../qa/<date>/<label>/game.json (and shots where a check takes them).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { start } from './serve.mjs';
import { today, parseArgs } from './routes.mjs';
import { VARIANTS, contextOptions, watch } from './shots.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = parseArgs();
const label = typeof args.label === 'string' ? args.label : 'game';
const OUT = path.resolve(here, '../../../qa', today(), label);
const ROUTE = '/lab/darkfield/?test=1';

/** Open the game in test mode and wait for the hook. */
async function open(browser, server, variant = 'desktop-light') {
  const ctx = await browser.newContext(contextOptions(VARIANTS[variant]));
  const page = await ctx.newPage();
  const problems = watch(page, server.origin);
  await page.goto(server.url(ROUTE));
  await page.locator('.darkfield').scrollIntoViewIfNeeded();
  await page.waitForFunction(() => !!window.__game, null, { timeout: 10000 });
  return { ctx, page, problems };
}
const game = (page, fn, ...a) => page.evaluate(([f, a]) => window.__game[f](...a), [fn, a]);
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };

/** Step in chunks until pred(state) holds or the tick budget runs out. */
async function stepUntil(page, pred, budget, chunk = 60) {
  let s = await game(page, 'getState');
  for (let n = 0; n < budget && !pred(s); n += chunk) s = await game(page, 'step', chunk);
  return s;
}

const checks = {
  // T11 stub: title → play → game over → restart, with no input at all.
  async 'slice-loop'({ page }) {
    let s = await game(page, 'seed', 'harness');
    expect(s.mode === 'title', `starts on ${s.mode}, not title`);
    expect(await page.locator('[data-screen="title"]').isVisible(), 'title card not visible');
    s = await game(page, 'input', 'start');
    expect(s.mode === 'play', `start → ${s.mode}`);
    expect(s.diatoms > 0, 'no diatoms at the start of a run');
    s = await stepUntil(page, (x) => x.mode === 'over', 60 * 60);
    expect(s.mode === 'over', `no game over within 60 simulated s (tick ${s.tick}, ink ${s.ink})`);
    await page.waitForSelector('[data-screen="over"]');
    const result = { overAt: s.t, reason: s.overReason, score: s.score };
    s = await game(page, 'input', 'start');
    expect(s.mode === 'play' && s.tick === 0 && s.ink === 100 && s.score === 0, 'restart did not reset the run');
    return result;
  },
};

const only = typeof args.only === 'string' ? args.only.split(',') : Object.keys(checks);
const server = await start();
const browser = await chromium.launch();
const results = [];
try {
  for (const name of only) {
    const fn = checks[name];
    if (!fn) { results.push({ name, ok: false, error: 'no such check' }); continue; }
    const env = await open(browser, server);
    let r;
    try {
      const detail = await fn({ ...env, browser, server });
      r = { name, ok: env.problems.length === 0, detail, problems: env.problems };
    } catch (e) {
      r = { name, ok: false, error: e.message.split('\n')[0], problems: env.problems };
    }
    await env.ctx.close();
    results.push(r);
    console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${name}${r.detail ? ' ' + JSON.stringify(r.detail) : ''}${r.error ? ' — ' + r.error : ''}`);
    for (const p of r.problems ?? []) console.log(`       ${p.kind}: ${p.text}`);
  }
} finally {
  await browser.close();
  await server.close();
}
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'game.json'), JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} ok → ${path.relative(process.cwd(), path.join(OUT, 'game.json'))}`);
process.exitCode = failed ? 1 : 0;
