// @ts-check
import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import svelte from '@astrojs/svelte';
import { plateLight, plateDark } from './src/styles/shiki-themes.ts';

// The site is served from https://dmn777.github.io/agentic-website/
// so every internal URL needs the "/agentic-website" prefix.
const BASE = '/agentic-website';

// Tiny rehype plugin: lets authors write root-relative links in Markdown
// (e.g. [How it works](/how-it-works/)) and prefixes them with BASE at build time.
function rehypeBaseLinks() {
  /** @param {any} tree */
  return (tree) => {
    /** @param {unknown} url */
    const fix = (url) =>
      typeof url === 'string' && url.startsWith('/') && !url.startsWith('//') &&
      url !== BASE && !url.startsWith(BASE + '/')
        ? BASE + url
        : url;
    /** @param {any} node */
    const walk = (node) => {
      if (node.type === 'element') {
        if (node.tagName === 'a') node.properties.href = fix(node.properties.href);
        if (node.tagName === 'img') node.properties.src = fix(node.properties.src);
      }
      (node.children || []).forEach(walk);
    };
    walk(tree);
  };
}

export default defineConfig({
  site: 'https://dmn777.github.io',
  base: BASE,
  trailingSlash: 'always',
  integrations: [svelte()],
  markdown: {
    // Astro 7's default Markdown processor (Sätteri) has no rehype plugin API,
    // so we use the unified processor for our link-rewriting plugin.
    processor: unified({ rehypePlugins: [rehypeBaseLinks] }),
    // Custom Plates themes (contrast-tested); both emitted as CSS variables.
    shikiConfig: { themes: { light: plateLight, dark: plateDark }, defaultColor: false },
  },
});
