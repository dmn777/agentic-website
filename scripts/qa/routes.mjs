// Route discovery over dist/: every index.html becomes a route ("/lab/art/"),
// plus top-level *.html files ("/404.html"). Redirect stubs (meta refresh) are
// tagged so screenshotters can skip them; the frozen /v1/ snapshot is excluded
// unless asked for.
import fs from 'node:fs';
import path from 'node:path';
import { DIST } from './serve.mjs';

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

/** @returns {{route:string, file:string, redirect:boolean, motion:boolean, canvas:boolean}[]} */
export function discoverRoutes({ dist = DIST, includeV1 = false } = {}) {
  return walk(dist)
    .map((file) => {
      const rel = '/' + path.relative(dist, file).split(path.sep).join('/');
      const route = rel.endsWith('/index.html') ? rel.slice(0, -'index.html'.length) : rel;
      const html = fs.readFileSync(file, 'utf8');
      return {
        route,
        file,
        redirect: /<meta[^>]+http-equiv=["']?refresh/i.test(html),
        motion: html.includes('data-qa-motion'),
        canvas: html.includes('data-qa-canvas'),
      };
    })
    .filter((r) => includeV1 || !r.route.startsWith('/v1/'))
    .sort((a, b) => a.route.localeCompare(b.route));
}

/** "/lab/art/" -> "lab-art", "/" -> "home", "/404.html" -> "404" */
export const slugOf = (route) =>
  route === '/' ? 'home' : route.replace(/\.html$/, '').replace(/^\/|\/$/g, '').replace(/\//g, '-');

/** Local date as YYYY-MM-DD (qa/ folders are named by the working day, not UTC). */
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Minimal --flag value / --flag=value / --bool parser. */
export function parseArgs(argv = process.argv.slice(2)) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const [k, v] = a.slice(2).split('=');
    if (v !== undefined) out[k] = v;
    else if (argv[i + 1] && !argv[i + 1].startsWith('--')) out[k] = argv[++i];
    else out[k] = true;
  }
  return out;
}
