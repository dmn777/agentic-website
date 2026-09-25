// Markdown → Portable Text for the Notes section (T14). One converter serves both the
// local build (seeds in content/notes-seed/ rendered directly) and the import into Sanity
// (T16), so the two can't drift. Output follows the post schema in SANITY.md: text blocks
// with h2/h3/blockquote styles and bullet/number lists; strong/em/code decorators; link
// annotations; and the custom blocks image, codeBlock and callout. Keys are derived from
// positions, so the same Markdown always yields the same document (stable upserts).
import { fromMarkdown } from 'mdast-util-from-markdown';
import type { Root, RootContent, PhrasingContent, List, ListItem } from 'mdast';

export interface PTSpan { _type: 'span'; _key: string; text: string; marks: string[] }
export interface PTLinkDef { _type: 'link'; _key: string; href: string }
export interface PTTextBlock {
  _type: 'block'; _key: string; style: 'normal' | 'h2' | 'h3' | 'blockquote';
  children: PTSpan[]; markDefs: PTLinkDef[]; listItem?: 'bullet' | 'number'; level?: number;
}
export interface PTImage { _type: 'image'; _key: string; alt: string; src: string; caption?: string }
export interface PTCode { _type: 'codeBlock'; _key: string; language: string; code: string; filename?: string }
export interface PTCallout { _type: 'callout'; _key: string; tone: 'note' | 'warn' | 'tip'; body: string }
export type PTBlock = PTTextBlock | PTImage | PTCode | PTCallout;

const TONE: Record<string, PTCallout['tone']> = { NOTE: 'note', IMPORTANT: 'note', TIP: 'tip', WARNING: 'warn', CAUTION: 'warn' };

export function markdownToPortableText(md: string): PTBlock[] {
  const root = fromMarkdown(md) as Root;
  const out: PTBlock[] = [];
  const key = (() => { let n = 0; return (p: string) => `${p}${(n++).toString(36)}`; })();

  const spans = (nodes: PhrasingContent[], marks: string[], defs: PTLinkDef[], acc: PTSpan[] = []): PTSpan[] => {
    for (const n of nodes) {
      if (n.type === 'text') acc.push({ _type: 'span', _key: key('s'), text: n.value, marks: [...marks] });
      else if (n.type === 'strong') spans(n.children, [...marks, 'strong'], defs, acc);
      else if (n.type === 'emphasis') spans(n.children, [...marks, 'em'], defs, acc);
      else if (n.type === 'inlineCode') acc.push({ _type: 'span', _key: key('s'), text: n.value, marks: [...marks, 'code'] });
      else if (n.type === 'link') {
        const d: PTLinkDef = { _type: 'link', _key: key('l'), href: n.url };
        defs.push(d);
        spans(n.children, [...marks, d._key], defs, acc);
      } else if (n.type === 'break') acc.push({ _type: 'span', _key: key('s'), text: '\n', marks: [...marks] });
      else if ('children' in n) spans((n as { children: PhrasingContent[] }).children, marks, defs, acc);
      else if ('value' in n) acc.push({ _type: 'span', _key: key('s'), text: String((n as { value: string }).value), marks: [...marks] });
    }
    return acc;
  };
  const textBlock = (children: PhrasingContent[], style: PTTextBlock['style'], extra: Partial<PTTextBlock> = {}): PTTextBlock => {
    const markDefs: PTLinkDef[] = [];
    const b: PTTextBlock = { _type: 'block', _key: key('b'), style, children: [], markDefs, ...extra };
    b.children = spans(children, [], markDefs);
    return b;
  };
  const plain = (nodes: RootContent[]): string =>
    nodes.map((n) => ('value' in n ? String((n as { value: string }).value) : 'children' in n ? plain((n as { children: RootContent[] }).children) : '')).join('');

  const list = (l: List, level: number) => {
    for (const item of l.children as ListItem[]) {
      for (const c of item.children) {
        if (c.type === 'paragraph') out.push(textBlock(c.children, 'normal', { listItem: l.ordered ? 'number' : 'bullet', level }));
        else if (c.type === 'list') list(c, level + 1);
      }
    }
  };

  for (const n of root.children) {
    switch (n.type) {
      case 'paragraph': {
        const only = n.children.length === 1 ? n.children[0] : null;
        if (only?.type === 'image') out.push({ _type: 'image', _key: key('i'), alt: only.alt ?? '', src: only.url, ...(only.title ? { caption: only.title } : {}) });
        else out.push(textBlock(n.children, 'normal'));
        break;
      }
      case 'heading': out.push(textBlock(n.children, n.depth >= 3 ? 'h3' : 'h2')); break;
      case 'blockquote': {
        const first = n.children[0];
        const head = first?.type === 'paragraph' ? plain(first.children as RootContent[]) : '';
        const alert = head.match(/^\[!(NOTE|TIP|WARNING|CAUTION|IMPORTANT)\]\s*\n?([\s\S]*)$/);
        if (alert) {
          const rest = [alert[2], ...n.children.slice(1).map((c) => plain([c]))].map((x) => x.trim()).filter(Boolean);
          out.push({ _type: 'callout', _key: key('c'), tone: TONE[alert[1]], body: rest.join('\n\n') });
        } else for (const c of n.children) if (c.type === 'paragraph') out.push(textBlock(c.children, 'blockquote'));
        break;
      }
      case 'list': list(n, 1); break;
      case 'code': {
        const filename = n.meta?.match(/filename=(\S+)/)?.[1];
        out.push({ _type: 'codeBlock', _key: key('k'), language: n.lang ?? 'text', code: n.value, ...(filename ? { filename } : {}) });
        break;
      }
      case 'thematicBreak': break;
      default: if ('children' in n) out.push(textBlock((n as { children: PhrasingContent[] }).children, 'normal'));
    }
  }
  return out;
}

/** Plain text of a document: blocks joined by blank lines (for excerpts and word counts). */
export function toPlainText(blocks: PTBlock[]): string {
  return blocks.map((b) => (b._type === 'block' ? b.children.map((c) => c.text).join('') : b._type === 'codeBlock' ? b.code : b._type === 'callout' ? b.body : b.caption ?? b.alt)).join('\n\n');
}

export interface Seed { title: string; slug: string; date: string; excerpt: string; tags: string[]; model: string; body: PTBlock[]; labPage?: string }

/** The same form the Studio schema accepts for `labPage`. */
const LAB_ROUTE = /^\/lab\/[a-z0-9-]+\/$/;

/** A seed file: YAML-ish frontmatter (scalars and [a, b] lists) plus a Markdown body. */
export function parseSeed(src: string): Seed {
  const m = src.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error('seed: missing frontmatter');
  const fm: Record<string, string | string[]> = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (!kv) continue;
    const v = kv[2].trim();
    fm[kv[1]] = v.startsWith('[') ? v.slice(1, -1).split(',').map((x) => x.trim()).filter(Boolean) : v.replace(/^["']|["']$/g, '');
  }
  for (const k of ['title', 'slug', 'date', 'excerpt', 'model']) if (!fm[k]) throw new Error(`seed: missing ${k}`);
  if (fm.labPage && !LAB_ROUTE.test(String(fm.labPage))) throw new Error(`seed: labPage must look like /lab/name/, not ${fm.labPage}`);
  return {
    title: String(fm.title), slug: String(fm.slug), date: String(fm.date), excerpt: String(fm.excerpt),
    tags: Array.isArray(fm.tags) ? fm.tags : [], model: String(fm.model), body: markdownToPortableText(m[2]),
    ...(fm.labPage ? { labPage: String(fm.labPage) } : {}),
  };
}
