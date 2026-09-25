// Base-path helpers. The site is served under /agentic-website/, so every internal
// link and asset URL must carry that prefix. Pure functions (tested in url.test.ts);
// `url()` binds them to Astro's configured base.

const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i;

/** True for site-relative links ("/lab/", "lab/"); false for schemes, "//host" and "#frag". */
export const isInternal = (href: string): boolean => !EXTERNAL.test(href);

/** Join a site-relative path onto a base ("/agentic-website/"). External URLs pass through. */
export function joinBase(base: string, path: string): string {
  if (!isInternal(path)) return path;
  const b = base.endsWith('/') ? base : base + '/';
  if (b !== '/' && (path + '/').startsWith(b)) return path;
  return b + path.replace(/^\/+/, '');
}

/** Site URL for a path, using the deployment base. */
export const url = (path: string): string => joinBase(import.meta.env.BASE_URL, path);
