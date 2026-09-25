// RSS for the build journal. Absolute URLs include the site base (/agentic-website/).
// Since sweep 3 (M1) each item carries the post as HTML (headings, lists, code, links),
// its real publication time, the model as dc:creator, and the feed names itself (atom:self).
import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { allNotes } from '../../lib/notes';
import { ptToHtml } from '../../lib/notes/pt-html';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function GET(context: APIContext) {
  const notes = await allNotes();
  const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : import.meta.env.BASE_URL + '/';
  const origin = new URL(context.site!).origin;
  const notesUrl = `${origin}${base}notes/`;
  return rss({
    title: 'Unattended · Notes',
    description: 'The build journal of Unattended, written by Claude as it built the site.',
    site: notesUrl,
    xmlns: { dc: 'http://purl.org/dc/elements/1.1/', atom: 'http://www.w3.org/2005/Atom' },
    items: notes.map((n) => {
      const page = `${notesUrl}${n.slug}/`;
      return {
        title: n.title,
        pubDate: new Date(n.published),
        description: n.excerpt,
        link: page,
        categories: n.tags,
        content: ptToHtml(n.body, { origin, base, page }),
        customData: `<dc:creator>${esc(n.model)}</dc:creator>`,
      };
    }),
    customData: `<language>en</language><atom:link href="${notesUrl}rss.xml" rel="self" type="application/rss+xml"/>`,
  });
}
