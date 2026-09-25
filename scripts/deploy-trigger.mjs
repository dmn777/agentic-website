// deploy:trigger — rebuild and redeploy the live site without a commit (T16), e.g. after a
// post was published or edited in Sanity Studio.
//
//   npm run deploy:trigger [-- --verify [--routes /notes/] [--expect <text>] [--label L]]
//
// Starts the "Deploy to GitHub Pages" workflow on main through the GitHub API
// (workflow_dispatch). If the token lacks the Actions permission, it falls back to a
// repository_dispatch "sanity-publish" event (Contents permission), a request a Sanity
// webhook could be set up to send. With --verify it then runs qa:deploy for the new run,
// passing on the remaining flags; with --label it also saves what happened to
// ../qa/<date>/<label>-deploy/trigger.json. The token is read from the private secrets
// file, never printed.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { today } from './qa/routes.mjs';

const SITE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = 'dmn777/agentic-website';
const TOKEN_FILE = process.env.QA_GH_TOKEN_FILE ?? path.resolve(SITE, '../_secrets/github_token.txt');
const argv = process.argv.slice(2);

function token() {
  try { return fs.readFileSync(TOKEN_FILE, 'utf8').replace(/[\r\n ]/g, ''); }
  catch { throw new Error(`No GitHub token at ${TOKEN_FILE}`); }
}

async function post(pathname, body) {
  const res = await fetch(`https://api.github.com${pathname}`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28',
      Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, message: res.ok ? '' : (await res.json().catch(() => ({}))).message ?? '' }; // never echo headers
}

// GitHub timestamps have second precision; start the window a little early.
const after = new Date(Date.now() - 5_000).toISOString();
let r = await post(`/repos/${REPO}/actions/workflows/deploy.yml/dispatches`, { ref: 'main' });
let via = 'workflow_dispatch';
let refused = null;
if (r.status === 403 || r.status === 404) {
  refused = { call: 'workflow_dispatch', status: r.status, message: r.message };
  console.log(`  workflow_dispatch refused (${r.status} ${r.message}); trying repository_dispatch`);
  r = await post(`/repos/${REPO}/dispatches`, { event_type: 'sanity-publish' });
  via = 'repository_dispatch sanity-publish';
}
if (r.status < 200 || r.status >= 300) {
  console.error(`FAIL could not start a deploy: ${r.status} ${r.message}`);
  process.exit(1);
}
console.log(`Deploy started via ${via} at ${after}`);
const li = argv.indexOf('--label');
if (li >= 0 && argv[li + 1]) {
  const dir = path.resolve(SITE, '..', 'qa', today(), `${argv[li + 1]}-deploy`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'trigger.json'), JSON.stringify({ via, after, refused, status: r.status }, null, 2));
}

if (argv.includes('--verify')) {
  const rest = argv.filter((a) => a !== '--verify');
  const v = spawnSync(process.execPath, [path.join(SITE, 'scripts/qa/deploy.mjs'), '--after', after, ...rest], { cwd: SITE, stdio: 'inherit' });
  process.exitCode = v.status ?? 1;
} else {
  console.log(`Verify with: npm run qa:deploy -- --after ${after} --routes /notes/`);
}
