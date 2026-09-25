// A tiny static server that mimics GitHub Pages for dist/:
// - the site lives under BASE (/agentic-website/); everything else is 404
// - "dir/" serves dir/index.html; "dir" (no slash) 301-redirects to "dir/"
// - a missing file serves dist/404.html with status 404
// Used by qa:shots and the link crawl so QA sees the same URL semantics as production.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const BASE = '/agentic-website';
const here = path.dirname(fileURLToPath(import.meta.url));
export const DIST = path.resolve(here, '../../dist');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif',
  '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.webmanifest': 'application/manifest+json',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.pdf': 'application/pdf',
};

function send404(res) {
  const p = path.join(DIST, '404.html');
  res.statusCode = 404;
  if (fs.existsSync(p)) { res.setHeader('content-type', TYPES['.html']); fs.createReadStream(p).pipe(res); }
  else res.end('404');
}

export function createServer(dist = DIST) {
  return http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    let p = decodeURIComponent(u.pathname);
    if (p === BASE) { res.statusCode = 301; res.setHeader('location', BASE + '/'); return res.end(); }
    if (!p.startsWith(BASE + '/')) return send404(res);
    const rel = p.slice(BASE.length);
    let file = path.join(dist, rel);
    if (!file.startsWith(dist)) return send404(res);
    let st = fs.existsSync(file) ? fs.statSync(file) : null;
    if (st?.isDirectory()) {
      if (!p.endsWith('/')) { res.statusCode = 301; res.setHeader('location', p + '/' + u.search); return res.end(); }
      file = path.join(file, 'index.html');
      st = fs.existsSync(file) ? fs.statSync(file) : null;
    } else if (!st && fs.existsSync(file + '.html')) {
      file += '.html'; st = fs.statSync(file);
    }
    if (!st?.isFile()) return send404(res);
    res.setHeader('content-type', TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream');
    res.setHeader('cache-control', 'no-store');
    fs.createReadStream(file).pipe(res);
  });
}

/** Start on a free port; resolves to { origin, url(base-relative path), close() }. */
export async function start(dist = DIST) {
  if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error(`No build in ${dist}; run npm run build first`);
  const server = createServer(dist);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  return {
    origin,
    url: (route) => origin + BASE + route,
    close: () => new Promise((r) => server.close(r)),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 4321);
  createServer().listen(port, '127.0.0.1', () => console.log(`Serving dist/ at http://127.0.0.1:${port}${BASE}/`));
}
