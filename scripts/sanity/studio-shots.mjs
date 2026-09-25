// studio:shots — screenshots of the Sanity Studio as an editor sees it (T17).
//
//   (cd studio && npx sanity dev --port 3333) &   then
//   npm run studio:shots [-- --base http://localhost:3333 --out ../qa/T17/studio --doc post-inside-the-loop]
//
// The hosted Studio sits behind Sanity's dashboard login, which a headless browser can't
// pass. A local `sanity dev` Studio accepts a token from localStorage instead, so this
// signs in with the editor token from the private secrets file (never printed) and
// captures the post list, a post open in the editor, and the same post at phone width.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { TOKEN_FILE } from './client.mjs';
import { sanityConfig } from '../../src/lib/notes/sanity.config.ts';
import { parseArgs } from '../qa/routes.mjs';

const args = parseArgs();
const base = String(args.base ?? 'http://localhost:3333').replace(/\/$/, '');
const out = path.resolve(String(args.out ?? '../qa/studio'));
const doc = String(args.doc ?? 'post-inside-the-loop');
fs.mkdirSync(out, { recursive: true });
const token = fs.readFileSync(TOKEN_FILE, 'utf8').replace(/[\r\n ]/g, '');

const browser = await chromium.launch();
const problems = [];
async function shoot(name, url, viewport, prep) {
  const ctx = await browser.newContext({ viewport, colorScheme: 'light', ...(viewport.width < 600 ? { isMobile: true, hasTouch: true } : {}) });
  await ctx.addInitScript(([key, t]) => localStorage.setItem(key, JSON.stringify({ token: t })), [`__studio_auth_token_${sanityConfig.projectId}`, token]);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => problems.push(`${name}: ${e.message}`));
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90_000 });
  await page.waitForTimeout(2500);
  if (prep) await prep(page);
  await page.screenshot({ path: path.join(out, `${name}.png`) });
  const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 160);
  console.log(`${name}: ${text}`);
  await ctx.close();
}

await shoot('list', `${base}/structure/post`, { width: 1440, height: 900 });
await shoot('editor', `${base}/structure/post;${doc}`, { width: 1440, height: 900 });
await shoot('editor-body', `${base}/structure/post;${doc}`, { width: 1440, height: 900 }, async (page) => {
  await page.getByText('Body', { exact: true }).first().scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(800);
});
await shoot('editor-phone', `${base}/structure/post;${doc}`, { width: 390, height: 844 });
await browser.close();
if (problems.length) console.log(`page errors:\n  ${problems.join('\n  ')}`);
console.log(`→ ${out}`);
