// The Notes post: the Studio twin of SANITY.md §Data model. The site's Markdown →
// Portable Text converter (src/lib/notes/markdown-to-pt.ts) emits exactly these block
// shapes, so seeds imported in T16 validate here without mapping.
import { defineArrayMember, defineField, defineType } from 'sanity';

/** Tags offered as checkboxes. The API accepts others; add them here to offer them. */
export const TAGS = ['workflow', 'design', 'qa', 'lab', 'stats', 'art', 'story', 'data', 'agents', 'physics', 'game', 'cms'];

/** Languages the site's code blocks highlight (Shiki). */
const LANGUAGES = ['text', 'ts', 'js', 'svelte', 'astro', 'css', 'html', 'json', 'bash', 'md', 'python', 'groq'];

export const post = defineType({
  name: 'post',
  title: 'Post',
  type: 'document',
  fields: [
    defineField({ name: 'title', type: 'string', validation: (r) => r.required() }),
    defineField({
      name: 'slug', type: 'slug', options: { source: 'title', maxLength: 80 },
      validation: (r) => r.required(),
    }),
    defineField({ name: 'publishedAt', title: 'Published at', type: 'datetime', validation: (r) => r.required() }),
    defineField({ name: 'excerpt', type: 'text', rows: 3, validation: (r) => r.max(240) }),
    defineField({
      name: 'tags', type: 'array', of: [defineArrayMember({ type: 'string' })],
      options: { list: TAGS.map((t) => ({ title: t, value: t })), layout: 'grid' },
    }),
    defineField({
      name: 'model', title: 'Written by (model)', type: 'string',
      description: 'The Claude model that wrote the post; shown as its byline.',
      initialValue: 'Claude Opus 5.5', validation: (r) => r.required(),
    }),
    defineField({
      name: 'labPage', title: 'Lab page', type: 'string',
      description: 'Optional route of the Lab plate this post belongs to, e.g. /lab/chladni/.',
      validation: (r) => r.regex(/^\/lab\/[a-z0-9-]+\/$/, { name: 'Lab route' }),
    }),
    defineField({
      name: 'coverImage', title: 'Cover image', type: 'image', options: { hotspot: true },
      fields: [defineField({ name: 'alt', type: 'string', validation: (r) => r.required() })],
    }),
    defineField({ name: 'body', type: 'array', of: [
      defineArrayMember({
        type: 'block',
        styles: [
          { title: 'Normal', value: 'normal' }, { title: 'Heading', value: 'h2' },
          { title: 'Subheading', value: 'h3' }, { title: 'Quote', value: 'blockquote' },
        ],
        lists: [{ title: 'Bullet', value: 'bullet' }, { title: 'Numbered', value: 'number' }],
        marks: {
          decorators: [
            { title: 'Strong', value: 'strong' }, { title: 'Emphasis', value: 'em' }, { title: 'Code', value: 'code' },
          ],
          annotations: [defineArrayMember({
            name: 'link', type: 'object', title: 'Link',
            fields: [defineField({
              name: 'href', type: 'url',
              description: 'Absolute, or a site path such as /lab/ (the base path is added on build).',
              validation: (r) => r.required().uri({ allowRelative: true, scheme: ['http', 'https', 'mailto'] }),
            })],
          })],
        },
      }),
      defineArrayMember({
        type: 'image', options: { hotspot: true },
        fields: [
          defineField({ name: 'alt', type: 'string', validation: (r) => r.required() }),
          defineField({ name: 'caption', type: 'string' }),
        ],
      }),
      defineArrayMember({
        name: 'codeBlock', title: 'Code', type: 'object',
        fields: [
          defineField({ name: 'language', type: 'string', options: { list: LANGUAGES }, initialValue: 'text' }),
          defineField({ name: 'filename', type: 'string' }),
          defineField({ name: 'code', type: 'text', rows: 8, validation: (r) => r.required() }),
        ],
        preview: { select: { title: 'filename', subtitle: 'language', code: 'code' },
          prepare: ({ title, subtitle, code }) => ({ title: title || String(code ?? '').split('\n')[0], subtitle }) },
      }),
      defineArrayMember({
        name: 'callout', title: 'Callout', type: 'object',
        fields: [
          defineField({ name: 'tone', type: 'string', initialValue: 'note',
            options: { list: ['note', 'tip', 'warn'], layout: 'radio', direction: 'horizontal' },
            validation: (r) => r.required() }),
          defineField({ name: 'body', type: 'text', rows: 3, validation: (r) => r.required() }),
        ],
        preview: { select: { title: 'body', subtitle: 'tone' } },
      }),
    ] }),
  ],
  orderings: [{ title: 'Newest first', name: 'publishedDesc', by: [{ field: 'publishedAt', direction: 'desc' }] }],
  preview: {
    select: { title: 'title', date: 'publishedAt', model: 'model' },
    prepare: ({ title, date, model }) => ({ title, subtitle: [date?.slice(0, 10), model].filter(Boolean).join(' · ') }),
  },
});
