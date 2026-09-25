// Portable Text → HTML for the RSS feed (sweep 3, M1). The pages render bodies with
// astro-portabletext and the site's components; a feed reader gets plain, self-contained
// HTML instead, with absolute URLs, covering the same blocks: headings, paragraphs,
// blockquotes, lists, strong/em/code, links, code blocks, callouts and images.
// Pure; tested in pt-html.test.ts. `.ts` imports so Node scripts can load it too.
import type { PTBlock, PTSpan, PTTextBlock } from './markdown-to-pt.ts';
import { isInternal, joinBase } from '../url.ts';

export interface HtmlOptions {
  /** Scheme and host, e.g. "https://dmn777.github.io". */
  origin: string;
  /** The site base, e.g. "/agentic-website/". */
  base: string;
  /** The post's own absolute URL, for "#fragment" links. */
  page: string;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const DECORATOR: Record<string, string> = { strong: 'strong', em: 'em', code: 'code' };
const CALLOUT = { note: 'Note', warn: 'Caution', tip: 'Tip' } as const;

function href(h: string, o: HtmlOptions): string {
  if (h.startsWith('#')) return o.page + h;
  return isInternal(h) ? o.origin + joinBase(o.base, h) : h;
}

function spanHtml(s: PTSpan): string {
  if (s.text === '\n') return '<br>';
  let out = esc(s.text).replace(/\n/g, '<br>');
  for (const m of [...s.marks].reverse()) if (DECORATOR[m]) out = `<${DECORATOR[m]}>${out}</${DECORATOR[m]}>`;
  return out;
}

/** Inline content: adjacent spans under the same link become one <a>. */
function inline(b: PTTextBlock, o: HtmlOptions): string {
  const linkOf = (s: PTSpan) => s.marks.find((m) => b.markDefs.some((d) => d._key === m));
  let out = '';
  for (let i = 0; i < b.children.length; ) {
    const key = linkOf(b.children[i]);
    let j = i + 1;
    while (key && j < b.children.length && linkOf(b.children[j]) === key) j++;
    const inner = b.children.slice(i, j).map(spanHtml).join('');
    const def = key && b.markDefs.find((d) => d._key === key);
    out += def ? `<a href="${esc(href(def.href, o))}">${inner}</a>` : inner;
    i = j;
  }
  return out;
}

const tag = (t: PTTextBlock) => (t.listItem === 'number' ? 'ol' : 'ul');

export function ptToHtml(blocks: PTBlock[], o: HtmlOptions): string {
  let out = '';
  // Open lists, innermost last: the tag and whether its current <li> is still open.
  const open: { tag: string; li: boolean }[] = [];
  const closeTo = (depth: number) => {
    while (open.length > depth) {
      const l = open.pop()!;
      out += (l.li ? '</li>' : '') + `</${l.tag}>`;
    }
  };
  for (const b of blocks) {
    if (b._type === 'block' && b.listItem) {
      const level = Math.max(1, b.level ?? 1);
      closeTo(level);
      if (open.length === level && open[level - 1].tag !== tag(b)) closeTo(level - 1);
      while (open.length < level) {
        out += `<${tag(b)}>`;
        open.push({ tag: tag(b), li: false });
      }
      const cur = open[level - 1];
      if (cur.li) out += '</li>';
      out += `<li>${inline(b, o)}`;
      cur.li = true;
      continue;
    }
    closeTo(0);
    if (b._type === 'block') {
      const t = b.style === 'h2' || b.style === 'h3' ? b.style : 'p';
      out += b.style === 'blockquote' ? `<blockquote><p>${inline(b, o)}</p></blockquote>` : `<${t}>${inline(b, o)}</${t}>`;
    } else if (b._type === 'codeBlock') {
      if (b.filename) out += `<p><code>${esc(b.filename)}</code></p>`;
      out += `<pre><code class="language-${esc(b.language)}">${esc(b.code)}</code></pre>`;
    } else if (b._type === 'callout') {
      const [first, ...rest] = b.body.split(/\n\n+/);
      out += `<blockquote><p><strong>${CALLOUT[b.tone]}.</strong> ${esc(first)}</p>${rest.map((p) => `<p>${esc(p)}</p>`).join('')}</blockquote>`;
    } else if (b._type === 'image') {
      out += `<figure><img src="${esc(href(b.src, o))}" alt="${esc(b.alt)}">${b.caption ? `<figcaption>${esc(b.caption)}</figcaption>` : ''}</figure>`;
    }
  }
  closeTo(0);
  return out;
}
