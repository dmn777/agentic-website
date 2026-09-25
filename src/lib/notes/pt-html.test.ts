import { describe, expect, it } from 'vitest';
import type { PTBlock, PTSpan, PTTextBlock } from './markdown-to-pt';
import { markdownToPortableText } from './markdown-to-pt';
import { ptToHtml } from './pt-html';

// The feed's copy of a post (sweep 3, M1): it used to be plain paragraphs, which lost the
// headings, lists, code, emphasis and every link. Readers get HTML, with absolute URLs.
const opts = { origin: 'https://dmn777.github.io', base: '/agentic-website/', page: 'https://dmn777.github.io/agentic-website/notes/a/' };
const span = (text: string, marks: string[] = []): PTSpan => ({ _type: 'span', _key: 'k', text, marks });
const block = (children: PTSpan[], extra: Partial<PTTextBlock> = {}): PTTextBlock =>
  ({ _type: 'block', _key: 'b', style: 'normal', children, markDefs: [], ...extra });
const html = (md: string) => ptToHtml(markdownToPortableText(md), opts);

describe('ptToHtml: text blocks', () => {
  it('renders paragraphs and headings', () => {
    expect(html('## What got built\n\nEight plates.\n\n### Detail')).toBe('<h2>What got built</h2><p>Eight plates.</p><h3>Detail</h3>');
  });
  it('renders strong, em and inline code, nested as they were written', () => {
    expect(html('A **bold** and *soft* `npm test`, and **both *at once***.'))
      .toBe('<p>A <strong>bold</strong> and <em>soft</em> <code>npm test</code>, and <strong>both </strong><strong><em>at once</em></strong>.</p>');
  });
  it('renders a blockquote', () => {
    expect(html('> Quoted.')).toBe('<blockquote><p>Quoted.</p></blockquote>');
  });
  it('escapes text so markup in a post stays text', () => {
    expect(ptToHtml([block([span('a < b & "c"')])], opts)).toBe('<p>a &lt; b &amp; &quot;c&quot;</p>');
  });
  it('turns a hard line break into <br>', () => {
    expect(ptToHtml([block([span('one'), span('\n'), span('two')])], opts)).toBe('<p>one<br>two</p>');
  });
});

describe('ptToHtml: lists', () => {
  it('groups consecutive items into one list per kind', () => {
    expect(html('- a\n- b\n\n1. one\n2. two')).toBe('<ul><li>a</li><li>b</li></ul><ol><li>one</li><li>two</li></ol>');
  });
  it('nests a deeper level inside the item before it', () => {
    expect(html('- a\n  - a1\n  - a2\n- b')).toBe('<ul><li>a<ul><li>a1</li><li>a2</li></ul></li><li>b</li></ul>');
  });
  it('closes a list before the next paragraph', () => {
    expect(html('- a\n\nAfter.')).toBe('<ul><li>a</li></ul><p>After.</p>');
  });
});

describe('ptToHtml: links and URLs', () => {
  it('makes internal links absolute under the base', () => {
    expect(html('See [the Cowork version](/v1/).')).toBe('<p>See <a href="https://dmn777.github.io/agentic-website/v1/">the Cowork version</a>.</p>');
  });
  it('leaves external links alone and escapes their attributes', () => {
    expect(html('[Sanity](https://www.sanity.io/?a=1&b=2)')).toBe('<p><a href="https://www.sanity.io/?a=1&amp;b=2">Sanity</a></p>');
  });
  it('resolves a fragment against the post itself', () => {
    expect(html('[below](#faq)')).toBe('<p><a href="https://dmn777.github.io/agentic-website/notes/a/#faq">below</a></p>');
  });
  it('keeps marks inside a link', () => {
    expect(html('[**bold** link](/lab/)')).toBe('<p><a href="https://dmn777.github.io/agentic-website/lab/"><strong>bold</strong> link</a></p>');
  });
});

describe('ptToHtml: custom blocks', () => {
  it('keeps a code block verbatim, line breaks included', () => {
    const b: PTBlock = { _type: 'codeBlock', _key: 'c', language: 'bash', code: 'npm ci\nnpm run build && echo "<ok>"' };
    expect(ptToHtml([b], opts)).toBe('<pre><code class="language-bash">npm ci\nnpm run build &amp;&amp; echo &quot;&lt;ok&gt;&quot;</code></pre>');
  });
  it('names a code block\'s file above it', () => {
    const b: PTBlock = { _type: 'codeBlock', _key: 'c', language: 'ts', code: 'x', filename: 'src/a.ts' };
    expect(ptToHtml([b], opts)).toBe('<p><code>src/a.ts</code></p><pre><code class="language-ts">x</code></pre>');
  });
  it('renders a callout as a labelled blockquote, one paragraph per paragraph', () => {
    const b: PTBlock = { _type: 'callout', _key: 'c', tone: 'warn', body: 'First.\n\nSecond.' };
    expect(ptToHtml([b], opts)).toBe('<blockquote><p><strong>Caution.</strong> First.</p><p>Second.</p></blockquote>');
  });
  it('renders an image with an absolute src, its alt text and caption', () => {
    const b: PTBlock = { _type: 'image', _key: 'i', alt: 'A plate', src: '/notes/img/abc.png', caption: 'Pl. I' };
    expect(ptToHtml([b], opts)).toBe('<figure><img src="https://dmn777.github.io/agentic-website/notes/img/abc.png" alt="A plate"><figcaption>Pl. I</figcaption></figure>');
  });
});
