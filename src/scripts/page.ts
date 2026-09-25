// Page-level behaviour shared by every page: plotter drawings start when they scroll into
// view, range inputs show their filled track, and the theme toggle works.
import { currentTheme, setTheme, onThemeChange } from './theme';

// Plots: draw when visible.
const io = new IntersectionObserver(
  (entries) => {
    for (const e of entries) if (e.isIntersecting) { e.target.setAttribute('data-in', ''); io.unobserve(e.target); }
  },
  { rootMargin: '0px 0px -8% 0px' },
);
document.querySelectorAll('.plot[data-draw]').forEach((el) => io.observe(el));

// Plots: constant pen width on screen. --plot-scale = viewBox units per CSS pixel.
const ro = new ResizeObserver((entries) => {
  for (const e of entries) {
    const svg = e.target as SVGSVGElement;
    const vb = svg.viewBox.baseVal;
    if (vb?.width && e.contentRect.width) svg.style.setProperty('--plot-scale', String(vb.width / e.contentRect.width));
  }
});
const watchPlots = (root: ParentNode) => root.querySelectorAll('svg.plot').forEach((el) => ro.observe(el));
watchPlots(document);
// Islands render plots after hydration; pick those up too.
new MutationObserver((muts) => {
  for (const m of muts) m.addedNodes.forEach((n) => {
    if (n instanceof SVGSVGElement && n.classList.contains('plot')) ro.observe(n);
    else if (n instanceof Element) watchPlots(n);
  });
}).observe(document.body, { childList: true, subtree: true });

// Range inputs: the track fill follows the value (islands can set --fill themselves).
const fill = (el: HTMLInputElement) => {
  const min = Number(el.min || 0), max = Number(el.max || 100);
  el.style.setProperty('--fill', `${((Number(el.value) - min) / (max - min)) * 100}%`);
};
document.querySelectorAll<HTMLInputElement>('input[type=range]').forEach(fill);
document.addEventListener('input', (e) => { const t = e.target; if (t instanceof HTMLInputElement && t.type === 'range') fill(t); });

// Theme toggle.
const toggles = document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]');
const sync = () => toggles.forEach((b) => {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  b.setAttribute('aria-label', `Switch to ${next} theme`);
  b.dataset.current = currentTheme();
});
toggles.forEach((b) => b.addEventListener('click', () => setTheme(currentTheme() === 'dark' ? 'light' : 'dark')));
onThemeChange(sync);
sync();
