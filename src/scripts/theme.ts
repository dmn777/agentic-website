// Theme state. The inline script in Base.astro applies a stored choice before first paint;
// this module powers the toggle and lets canvas code follow theme changes.

export type Theme = 'light' | 'dark';
const KEY = 'theme';
const media = () => window.matchMedia('(prefers-color-scheme: dark)');

export function currentTheme(): Theme {
  const t = document.documentElement.dataset.theme;
  if (t === 'light' || t === 'dark') return t;
  return media().matches ? 'dark' : 'light';
}

export function setTheme(t: Theme): void {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem(KEY, t); } catch { /* storage may be blocked; the choice lasts for this page */ }
  document.dispatchEvent(new CustomEvent('themechange', { detail: t }));
}

/** Calls cb whenever the effective theme changes (toggle or OS setting). Returns an unsubscribe. */
export function onThemeChange(cb: (t: Theme) => void): () => void {
  const onToggle = () => cb(currentTheme());
  const onMedia = () => { if (!document.documentElement.dataset.theme) cb(currentTheme()); };
  document.addEventListener('themechange', onToggle);
  media().addEventListener('change', onMedia);
  return () => { document.removeEventListener('themechange', onToggle); media().removeEventListener('change', onMedia); };
}

/** Resolve a colour token (e.g. '--ink') to an rgb() string for canvas drawing. */
export function tokenColor(name: string, el: Element = document.body): string {
  const probe = document.createElement('span');
  probe.style.color = `var(${name})`;
  probe.style.display = 'none';
  el.appendChild(probe);
  const c = getComputedStyle(probe).color;
  probe.remove();
  return c;
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
