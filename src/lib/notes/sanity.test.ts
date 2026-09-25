import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { parseSeed, type PTBlock, type Seed } from './markdown-to-pt';
import {
  postId, publishedAtFor, seedToPost, postsToNotes, imageFile, imageCdnUrl, IMAGE_ROUTE, NOTES_QUERY,
  type FetchedPost, type SanityPost,
} from './sanity';

const seed = (over: Partial<Seed> = {}): Seed => ({
  title: 'A title', slug: 'a-title', date: '2026-09-25', excerpt: 'Short.', tags: ['lab', 'qa'], model: 'Claude Opus 5.5',
  body: [{ _type: 'block', _key: 'b0', style: 'normal', children: [{ _type: 'span', _key: 's1', text: 'Hello there, world.', marks: [] }], markDefs: [] }],
  ...over,
});

/** What NOTES_QUERY returns for a stored post: the slug object is projected to its string. */
const fetched = (p: SanityPost): FetchedPost => ({ ...p, slug: p.slug.current });

describe('ids and dates', () => {
  it('derives a stable, publicly readable document id from the slug (no dots: dotted ids are private paths)', () => {
    expect(postId('rebuilding-unattended')).toBe('post-rebuilding-unattended');
    expect(postId('a.b')).not.toContain('.');
  });
  it('uses the first-commit time when the seed only has a date', () => {
    expect(publishedAtFor('2026-09-25', '2026-09-25T13:08:19+02:00')).toBe('2026-09-25T11:08:19.000Z');
  });
  it('falls back to noon UTC without a commit time, and keeps a full timestamp from the seed', () => {
    expect(publishedAtFor('2026-09-25')).toBe('2026-09-25T12:00:00.000Z');
    expect(publishedAtFor('2026-09-25T08:30:00+02:00', '2026-09-26T00:00:00Z')).toBe('2026-09-25T06:30:00.000Z');
  });
  it('rejects a date it cannot read', () => {
    expect(() => publishedAtFor('someday')).toThrow(/date/);
  });
});

describe('seedToPost: a seed becomes a Sanity post document', () => {
  it('maps the frontmatter onto the schema fields', () => {
    const doc = seedToPost(seed(), { publishedAt: '2026-09-25T11:08:19.000Z', assetRef: () => undefined });
    expect(doc).toMatchObject({
      _id: 'post-a-title', _type: 'post', title: 'A title', slug: { _type: 'slug', current: 'a-title' },
      publishedAt: '2026-09-25T11:08:19.000Z', excerpt: 'Short.', tags: ['lab', 'qa'], model: 'Claude Opus 5.5',
    });
    expect(doc.body).toEqual(seed().body);
  });
  it('swaps an image src for an asset reference, keeping key, alt and caption', () => {
    const body: PTBlock[] = [{ _type: 'image', _key: 'i0', alt: 'A plate', src: '/notes/plate.png', caption: 'Pl. I' }];
    const doc = seedToPost(seed({ body }), { publishedAt: '2026-09-25T12:00:00.000Z', assetRef: (src) => (src === '/notes/plate.png' ? 'image-abc123-800x600-png' : undefined) });
    expect(doc.body).toEqual([{ _type: 'image', _key: 'i0', alt: 'A plate', caption: 'Pl. I', asset: { _type: 'reference', _ref: 'image-abc123-800x600-png' } }]);
  });
  it('refuses an image that was not uploaded (no asset reference)', () => {
    const body: PTBlock[] = [{ _type: 'image', _key: 'i0', alt: 'x', src: '/missing.png' }];
    expect(() => seedToPost(seed({ body }), { publishedAt: '2026-09-25T12:00:00.000Z', assetRef: () => undefined })).toThrow(/missing\.png/);
  });
});

describe('images', () => {
  it('names the self-hosted copy after the asset id', () => {
    expect(imageFile('image-abc123-800x600-png')).toBe('abc123-800x600.png');
    expect(imageCdnUrl('image-abc123-800x600-png', 'pid', 'production')).toBe('https://cdn.sanity.io/images/pid/production/abc123-800x600.png');
  });
  it('rejects something that is not an image asset id', () => {
    expect(() => imageFile('file-abc-pdf')).toThrow();
  });
});

describe('postsToNotes: fetched posts become the Notes view model', () => {
  const at = (slug: string, publishedAt: string, extra: Partial<FetchedPost> = {}): FetchedPost =>
    ({ ...fetched(seedToPost(seed({ slug, title: slug }), { publishedAt, assetRef: () => undefined })), ...extra });

  it('numbers posts by publication time and lists them newest first', () => {
    const notes = postsToNotes([at('b', '2026-09-25T12:00:00Z'), at('a', '2026-09-25T11:00:00Z'), at('c', '2026-09-26T09:00:00Z')]);
    expect(notes.map((n) => [n.slug, n.number])).toEqual([['c', 3], ['b', 2], ['a', 1]]);
  });
  it('shows the UTC day as the date and computes words and reading time', () => {
    const [n] = postsToNotes([at('a', '2026-09-25T23:30:00Z')]);
    expect(n.date).toBe('2026-09-25');
    expect(n.words).toBe(3);
    expect(n.minutes).toBe(1);
  });
  it('tolerates the optional fields being null in the dataset', () => {
    const [n] = postsToNotes([at('a', '2026-09-25T12:00:00Z', { tags: null, excerpt: null, labPage: null })]);
    expect(n.tags).toEqual([]);
    expect(n.excerpt).toBe('');
    expect(n.labPage).toBeUndefined();
  });
  it('points image blocks at the self-hosted copy under the Notes image route', () => {
    const p = at('a', '2026-09-25T12:00:00Z', { body: [{ _type: 'image', _key: 'i0', alt: 'A plate', caption: 'Pl. I', asset: { _type: 'reference', _ref: 'image-abc123-800x600-png' } }] });
    const [n] = postsToNotes([p]);
    expect(n.body).toEqual([{ _type: 'image', _key: 'i0', alt: 'A plate', caption: 'Pl. I', src: `${IMAGE_ROUTE}abc123-800x600.png` }]);
    expect(n.images).toEqual(['image-abc123-800x600-png']);
  });
  it('round-trips every real seed: seed → document → fetched → note keeps the text and fields', () => {
    const dir = path.resolve(__dirname, '../../../content/notes-seed');
    const files = fs.readdirSync(dir).filter((f) => /^\d\d-.*\.md$/.test(f)).sort();
    expect(files.length).toBeGreaterThanOrEqual(6);
    const seeds = files.map((f) => parseSeed(fs.readFileSync(path.join(dir, f), 'utf8')));
    const posts = seeds.map((s, i) => fetched(seedToPost(s, { publishedAt: `2026-09-25T1${i}:00:00.000Z`, assetRef: () => undefined })));
    const notes = postsToNotes(posts);
    for (const [i, s] of seeds.entries()) {
      const n = notes.find((x) => x.slug === s.slug)!;
      expect(n.number).toBe(i + 1);
      expect({ title: n.title, excerpt: n.excerpt, tags: n.tags, model: n.model, body: n.body })
        .toEqual({ title: s.title, excerpt: s.excerpt, tags: s.tags, model: s.model, body: s.body });
    }
  });
});

describe('NOTES_QUERY', () => {
  it('asks for published posts only, oldest first, with the slug projected to a string', () => {
    expect(NOTES_QUERY).toMatch(/_type == "post"/);
    expect(NOTES_QUERY).toMatch(/order\(publishedAt asc\)/);
    expect(NOTES_QUERY).toMatch(/"slug": slug\.current/);
  });
});
