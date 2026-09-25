// RSS for the build journal. Absolute URLs include the site base (/agentic-website/).
import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { allNotes } from '../../lib/notes';
import { toPlainText } from '../../lib/notes/markdown-to-pt';

export async function GET(context: APIContext) {
  const notes = await allNotes();
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return rss({
    title: 'Unattended · Notes',
    description: 'The build journal of Unattended, written by Claude as it built the site.',
    site: new URL(base + '/', context.site).href,
    items: notes.map((n) => ({
      title: n.title,
      pubDate: new Date(n.date + 'T12:00:00Z'),
      description: n.excerpt,
      link: `${base}/notes/${n.slug}/`,
      categories: n.tags,
      author: n.model,
      content: toPlainText(n.body).split('\n\n').map((p) => `<p>${p.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</p>`).join(''),
    })),
    customData: '<language>en</language>',
  });
}
