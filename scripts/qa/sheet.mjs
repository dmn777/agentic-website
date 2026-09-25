// qa:sheet — contact sheets for milestone sweeps (TESTING.md §Milestone sweep).
//
//   npm run qa:sheet -- --from ../qa/2026-09-25/sweep-1 [--variants desktop-light,mobile-dark]
//                       [--height 1300] [--per 6]
//
// Reads a qa:shots output folder (summary.json + full-page PNGs) and lays the top of every
// page side by side, labelled, so a reviewer can compare typography, colour, cards, header,
// footer and nav across the whole site in a few images. Desktop and mobile get separate
// sheets. Also checks that every Lab card (on / and /lab/) links to a page whose <h1>
// matches the card title, and writes cards.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { start } from './serve.mjs';
import { parseArgs } from './routes.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(here, '../..');
const args = parseArgs();
if (!args.from) throw new Error('--from <qa:shots output folder> is required');
const dir = path.resolve(SITE, args.from);
const summary = JSON.parse(fs.readFileSync(path.join(dir, 'summary.json'), 'utf8'));
const variants = String(args.variants ?? 'desktop-light,mobile-dark').split(',');
const H = Number(args.height ?? 1300), PER = Number(args.per ?? 6);

const browser = await chromium.launch();
const page = await browser.newPage();
fs.mkdirSync(path.join(dir, 'sheets'), { recursive: true });

for (const v of variants) {
  const shots = summary.results.filter((r) => r.variant === v);
  const mobile = v.startsWith('mobile');
  const cellW = mobile ? 390 : 720, cellH = mobile ? H : Math.round(H * 0.5);
  for (let s = 0; s * PER < shots.length; s++) {
    const group = shots.slice(s * PER, (s + 1) * PER);
    const imgs = group.map((r) => ({ label: `${r.route}  ·  ${v}`, b64: fs.readFileSync(path.join(dir, r.file)).toString('base64') }));
    const data = await page.evaluate(async ({ imgs, cellW, cellH, mobile, H }) => {
      const cols = mobile ? imgs.length : Math.min(3, imgs.length), rows = Math.ceil(imgs.length / cols);
      const pad = 16, lab = 28;
      const c = document.createElement('canvas');
      c.width = cols * cellW + (cols + 1) * pad; c.height = rows * (cellH + lab) + (rows + 1) * pad;
      const g = c.getContext('2d');
      g.fillStyle = '#6b6b6b'; g.fillRect(0, 0, c.width, c.height);
      for (const [i, im] of imgs.entries()) {
        const img = new Image(); img.src = 'data:image/png;base64,' + im.b64; await img.decode();
        const x = pad + (i % cols) * (cellW + pad), y = pad + Math.floor(i / cols) * (cellH + lab + pad);
        const srcH = Math.min(img.height, mobile ? H : H);
        const k = cellW / img.width;
        g.fillStyle = '#fff'; g.font = '600 16px monospace'; g.fillText(im.label, x, y + 19);
        g.drawImage(img, 0, 0, img.width, srcH, x, y + lab, cellW, Math.min(cellH, srcH * k));
      }
      return c.toDataURL('image/jpeg', 0.82).split(',')[1];
    }, { imgs, cellW, cellH, mobile, H });
    const out = path.join(dir, 'sheets', `${v}-${s + 1}.jpg`);
    fs.writeFileSync(out, Buffer.from(data, 'base64'));
    console.log(`sheet ${path.relative(SITE, out)} (${group.length} pages)`);
  }
}

// Card ↔ page check
const server = await start();
const problems = [], checked = [];
for (const listing of ['/', '/lab/', '/lab/stats/']) {
  await page.goto(server.url(listing));
  const cards = await page.$$eval('.lab-card', (cs) => cs.map((c) => ({ title: c.querySelector('.lab-card__title')?.textContent?.trim(), href: c.querySelector('a.card__link')?.getAttribute('href'), blurb: c.querySelector('.lab-card__blurb')?.textContent?.trim() })));
  for (const card of cards) {
    const res = await page.request.get(server.origin + card.href);
    const html = await res.text();
    const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1].replace(/<[^>]+>/g, '').trim();
    const desc = html.match(/<meta name="description" content="([^"]*)"/)?.[1];
    const ok = res.status() === 200 && h1 === card.title;
    checked.push({ listing, ...card, status: res.status(), h1, pageDescription: desc, ok });
    if (!ok) problems.push(`${listing}: card "${card.title}" → ${card.href} (${res.status()}, h1 "${h1}")`);
  }
}
await server.close();
await browser.close();
fs.writeFileSync(path.join(dir, 'cards.json'), JSON.stringify({ checked, problems }, null, 2));
console.log(`${checked.length} card(s) checked, ${problems.length} mismatch(es)`);
for (const p of problems) console.log('  ' + p);
process.exitCode = problems.length ? 1 : 0;
