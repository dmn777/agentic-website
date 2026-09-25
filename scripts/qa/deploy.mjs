// qa:deploy — deploy verification after a push (TESTING.md §Deploy verification).
//
//   npm run qa:deploy [-- --sha <sha>] [--routes /,/lab/] [--label T5] [--after <ISO time>]
//                     [--timeout 600] [--no-shots]
//
// 1. Polls the GitHub Actions runs for the commit (default: HEAD) until the newest one
//    completes, and requires conclusion=success. --after ignores runs created earlier
//    (useful for re-runs triggered by workflow_dispatch on the same commit).
// 2. Fetches every route on the live site (cache-busted) and requires 200. When a page
//    carries <meta name="build-sha">, it must match the commit; the check retries for up
//    to 3 minutes while the Pages CDN catches up.
// 3. Takes a desktop-light screenshot of each route.
// The GitHub token is read from the private _secrets file and is never printed.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { discoverRoutes, slugOf, today, parseArgs } from './routes.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.resolve(here, '../..');
const REPO = 'dmn777/agentic-website';
const LIVE = 'https://dmn777.github.io/agentic-website';
const TOKEN_FILE = process.env.QA_GH_TOKEN_FILE ?? path.resolve(SITE, '../_secrets/github_token.txt');
const args = parseArgs();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function token() {
  try { return fs.readFileSync(TOKEN_FILE, 'utf8').replace(/[\r\n ]/g, ''); }
  catch { return null; }
}

async function gh(pathname) {
  const t = token();
  const res = await fetch(`https://api.github.com${pathname}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${pathname}`); // never echo headers
  return res.json();
}

async function waitForRun(sha, { after, timeoutS }) {
  const t0 = Date.now();
  let last = '';
  while (Date.now() - t0 < timeoutS * 1000) {
    const { workflow_runs: runs = [] } = await gh(`/repos/${REPO}/actions/runs?head_sha=${sha}&per_page=20`);
    const cands = runs
      .filter((r) => !after || new Date(r.created_at) >= new Date(after))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    const run = cands[0];
    const line = run ? `${run.name} #${run.run_number}: ${run.status}${run.conclusion ? ' / ' + run.conclusion : ''}` : 'no run yet';
    if (line !== last) { console.log(`  ${line}`); last = line; }
    if (run?.status === 'completed') return run;
    await sleep(10_000);
  }
  throw new Error(`Timed out after ${timeoutS}s waiting for the Actions run of ${sha.slice(0, 7)}`);
}

async function checkRoute(route, sha) {
  const t0 = Date.now();
  let status = 0, buildSha = null;
  while (Date.now() - t0 < 180_000) {
    const u = `${LIVE}${route}${route.includes('?') ? '&' : '?'}qa=${sha.slice(0, 7)}-${Date.now()}`;
    const res = await fetch(u, { redirect: 'manual', headers: { 'cache-control': 'no-cache' } });
    status = res.status;
    const html = status === 200 ? await res.text() : '';
    buildSha = html.match(/<meta[^>]+name=["']build-sha["'][^>]+content=["']([0-9a-f]+)["']/i)?.[1] ?? null;
    if (status === 200 && (!buildSha || buildSha === sha)) break;
    await sleep(15_000);
  }
  const problems = [];
  if (status !== 200) problems.push(`status ${status}`);
  if (buildSha && buildSha !== sha) problems.push(`build-sha ${buildSha.slice(0, 7)} ≠ ${sha.slice(0, 7)} after 3 min`);
  return { route, status, buildSha, shaChecked: !!buildSha, problems, ok: problems.length === 0 };
}

async function main() {
  const sha = args.sha ?? execFileSync('git', ['rev-parse', 'HEAD'], { cwd: SITE, encoding: 'utf8' }).trim();
  const label = args.label ?? 'adhoc';
  const outDir = path.resolve(SITE, '..', 'qa', today(), `${label}-deploy`);
  fs.mkdirSync(outDir, { recursive: true });
  if (!token()) console.log('  (no token file: using unauthenticated API calls)');

  console.log(`Waiting for the Actions run of ${sha.slice(0, 7)}…`);
  const run = await waitForRun(sha, { after: args.after, timeoutS: Number(args.timeout ?? 600) });
  const summary = {
    sha, label, when: new Date().toISOString(),
    run: { url: run.html_url, name: run.name, number: run.run_number, event: run.event, conclusion: run.conclusion },
    routes: [], ok: false,
  };
  console.log(`  ${run.html_url}`);
  if (run.conclusion !== 'success') {
    fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
    console.log(`FAIL run concluded ${run.conclusion}`);
    process.exitCode = 1;
    return;
  }

  const routes = args.routes
    ? String(args.routes).split(',').map((r) => r.trim()).filter(Boolean)
    : discoverRoutes().map((r) => r.route);
  console.log(`Checking ${routes.length} live route(s)…`);
  summary.routes = await Promise.all(routes.map((r) => checkRoute(r, sha)));

  if (!args['no-shots']) {
    const browser = await chromium.launch();
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
    for (const r of summary.routes.filter((x) => x.status === 200)) {
      const page = await ctx.newPage();
      await page.goto(`${LIVE}${r.route}`, { waitUntil: 'load' });
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
      r.shot = `${slugOf(r.route)}__live.png`;
      await page.screenshot({ path: path.join(outDir, r.shot) });
      await page.close();
    }
    await browser.close();
  }

  summary.ok = summary.routes.every((r) => r.ok);
  fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
  for (const r of summary.routes)
    console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${r.route} ${r.status}${r.shaChecked ? ' sha✓' : ''}${r.problems.length ? '  ' + r.problems.join('; ') : ''}`);
  const unchecked = summary.routes.filter((r) => r.ok && !r.shaChecked).length;
  if (unchecked) console.log(`  note: ${unchecked} route(s) carry no build-sha meta, so only the status was checked`);
  console.log(`\n${summary.ok ? 'DEPLOY OK' : 'DEPLOY FAILED'} → ${path.relative(SITE, outDir)}/summary.json`);
  process.exitCode = summary.ok ? 0 : 1;
}

main().catch((e) => { console.error(String(e?.message ?? e)); process.exit(2); });
