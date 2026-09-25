import { describe, expect, it } from 'vitest';
import { markdownToPortableText, parseSeed, toPlainText, type PTBlock, type PTTextBlock } from './markdown-to-pt';

const text = (b: PTBlock) => (b as PTTextBlock).children.map((c) => c.text).join('');

describe('markdownToPortableText: text blocks', () => {
  it('turns paragraphs into normal blocks with spans', () => {
    const pt = markdownToPortableText('Hello world.\n\nSecond paragraph.');
    expect(pt).toHaveLength(2);
    expect(pt[0]).toMatchObject({ _type: 'block', style: 'normal' });
    expect(text(pt[0])).toBe('Hello world.');
  });
  it('maps strong, emphasis and inline code to decorators, including nesting', () => {
    const [b] = markdownToPortableText('A **bold** and *soft* and `code` and ***both***.') as PTTextBlock[];
    const marked = Object.fromEntries(b.children.filter((c) => c.marks.length).map((c) => [c.text, [...c.marks].sort()]));
    expect(marked).toEqual({ bold: ['strong'], soft: ['em'], code: ['code'], both: ['em', 'strong'] });
    expect(text(b)).toBe('A bold and soft and code and both.');
  });
  it('turns links into link annotations with markDefs', () => {
    const [b] = markdownToPortableText('See [the source](https://github.com/x) and [the lab](/lab/).') as PTTextBlock[];
    expect(b.markDefs).toHaveLength(2);
    expect(b.markDefs.map((d) => d.href)).toEqual(['https://github.com/x', '/lab/']);
    const linked = b.children.filter((c) => c.marks.some((m) => b.markDefs.some((d) => d._key === m)));
    expect(linked.map((c) => c.text)).toEqual(['the source', 'the lab']);
  });
  it('maps ## and ### to h2 and h3, and demotes # to h2 (the title is the post’s h1)', () => {
    const pt = markdownToPortableText('# Top\n\n## Two\n\n### Three');
    expect(pt.map((b) => (b as PTTextBlock).style)).toEqual(['h2', 'h2', 'h3']);
  });
  it('maps plain blockquotes to the blockquote style', () => {
    const [b] = markdownToPortableText('> A quoted line.') as PTTextBlock[];
    expect(b.style).toBe('blockquote');
    expect(text(b)).toBe('A quoted line.');
  });
  it('turns bullet and numbered lists into list items with levels', () => {
    const pt = markdownToPortableText('- one\n- two\n  - nested\n\n1. first\n2. second') as PTTextBlock[];
    expect(pt.map((b) => [b.listItem, b.level, text(b)])).toEqual([
      ['bullet', 1, 'one'], ['bullet', 1, 'two'], ['bullet', 2, 'nested'], ['number', 1, 'first'], ['number', 1, 'second'],
    ]);
  });
});

describe('markdownToPortableText: custom blocks', () => {
  it('turns fenced code into codeBlock with language and optional filename', () => {
    const pt = markdownToPortableText('```ts filename=src/x.ts\nconst a = 1;\n```\n\n```\nplain\n```');
    expect(pt[0]).toEqual(expect.objectContaining({ _type: 'codeBlock', language: 'ts', filename: 'src/x.ts', code: 'const a = 1;' }));
    expect(pt[1]).toEqual(expect.objectContaining({ _type: 'codeBlock', language: 'text', code: 'plain' }));
  });
  it('turns GitHub-style alerts into callouts (note, warning → warn, tip)', () => {
    const pt = markdownToPortableText('> [!NOTE]\n> Seeds are import-only.\n\n> [!WARNING]\n> Careful.\n\n> [!TIP]\n> Try it.');
    expect(pt.map((b) => [b._type, (b as any).tone, (b as any).body])).toEqual([
      ['callout', 'note', 'Seeds are import-only.'], ['callout', 'warn', 'Careful.'], ['callout', 'tip', 'Try it.'],
    ]);
  });
  it('turns a standalone image into an image block with alt and caption', () => {
    const [img] = markdownToPortableText('![A plotted specimen](/img/a.png "Fig. 1 · The specimen")');
    expect(img).toEqual(expect.objectContaining({ _type: 'image', alt: 'A plotted specimen', src: '/img/a.png', caption: 'Fig. 1 · The specimen' }));
  });
});

describe('keys', () => {
  it('are unique within a document and stable across runs', () => {
    const md = 'A [link](/x) **b**.\n\n- one\n- two\n\n```js\nx\n```';
    const a = markdownToPortableText(md), b = markdownToPortableText(md);
    expect(a).toEqual(b);
    const keys = a.flatMap((blk: any) => [blk._key, ...(blk.children ?? []).map((c: any) => c._key), ...(blk.markDefs ?? []).map((d: any) => d._key)]);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('toPlainText', () => {
  it('joins block text with blank lines, for excerpts and word counts', () => {
    const pt = markdownToPortableText('One **two**.\n\n## Three\n\n```\ncode\n```');
    expect(toPlainText(pt)).toBe('One two.\n\nThree\n\ncode');
  });
});

describe('parseSeed', () => {
  it('reads the frontmatter fields and converts the body', () => {
    const seed = parseSeed(`---\ntitle: A post\nslug: a-post\ndate: 2026-09-25\nexcerpt: Short.\ntags: [lab, qa]\nmodel: Claude Opus 5.5\n---\n\nHello **there**.\n`);
    expect(seed).toMatchObject({ title: 'A post', slug: 'a-post', date: '2026-09-25', excerpt: 'Short.', tags: ['lab', 'qa'], model: 'Claude Opus 5.5' });
    expect(text(seed.body[0])).toBe('Hello there.');
  });
  it('rejects a seed with missing required fields', () => {
    expect(() => parseSeed('---\ntitle: x\n---\nbody')).toThrow(/slug/);
  });
  it('reads an optional labPage (the plate a post is about), and checks its form', () => {
    const fm = (extra: string) => `---\ntitle: A\nslug: a\ndate: 2026-09-25\nexcerpt: E.\nmodel: M\n${extra}---\nBody.\n`;
    expect(parseSeed(fm('labPage: /lab/chladni/\n')).labPage).toBe('/lab/chladni/');
    expect(parseSeed(fm('')).labPage).toBeUndefined();
    expect(() => parseSeed(fm('labPage: /notes/x/\n'))).toThrow(/labPage/);
  });
});

describe('the real seed posts', () => {
  it('all parse, with no raw Markdown left in the text', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const dir = path.resolve(__dirname, '../../../content/notes-seed');
    const files = fs.readdirSync(dir).filter((f: string) => /^\d\d-.*\.md$/.test(f));
    expect(files.length).toBeGreaterThanOrEqual(5);
    for (const f of files) {
      const seed = parseSeed(fs.readFileSync(path.join(dir, f), 'utf8'));
      expect(seed.body.length, f).toBeGreaterThan(5);
      const plainText = toPlainText(seed.body);
      expect(plainText, f).not.toMatch(/\*\*|__|\]\(|^#+ /m);
      const words = plainText.split(/\s+/).filter(Boolean).length;
      expect(words, f).toBeGreaterThan(400);
      expect(words, f).toBeLessThan(950);
    }
  });
});
