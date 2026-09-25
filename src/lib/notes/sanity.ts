// Sanity ⇄ Notes mapping (T16). Pure functions, shared by the build (Sanity → view model)
// and the import script `npm run notes:push` (seed → Sanity document), so the two can't
// drift. Relative imports carry `.ts` so Node can run this file directly.
import type { PTBlock, PTImage, Seed } from './markdown-to-pt.ts';
import { finishNotes, type Note } from './note.ts';

/** Stable document id per slug. No dots: ids with a dot are private paths in Sanity. */
export const postId = (slug: string) => `post-${slug.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

/**
 * publishedAt for a seed. A full timestamp in the seed wins; a bare date takes the time
 * the seed was first committed (when the post actually went out), else noon UTC.
 */
export function publishedAtFor(date: string, firstCommit?: string): string {
  const iso = /T/.test(date) ? date : firstCommit ?? `${date}T12:00:00Z`;
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) throw new Error(`publishedAt: cannot read the date "${date}"`);
  return t.toISOString();
}

export interface SanityImageBlock {
  _type: 'image'; _key: string; alt: string; caption?: string;
  asset: { _type: 'reference'; _ref: string };
}
export type SanityBlock = Exclude<PTBlock, PTImage> | SanityImageBlock;

export interface SanityPost {
  _id: string; _type: 'post'; title: string; slug: { _type: 'slug'; current: string };
  publishedAt: string; excerpt: string; tags: string[]; model: string; labPage?: string;
  body: SanityBlock[];
}

/** A seed as a post document. `assetRef` maps an image src to its uploaded asset id. */
export function seedToPost(seed: Seed, o: { publishedAt: string; assetRef: (src: string) => string | undefined; labPage?: string }): SanityPost {
  const body = seed.body.map((b): SanityBlock => {
    if (b._type !== 'image') return b;
    const ref = o.assetRef(b.src);
    if (!ref) throw new Error(`seedToPost: image ${b.src} has no uploaded asset`);
    const { src: _src, ...rest } = b;
    return { ...rest, asset: { _type: 'reference', _ref: ref } };
  });
  return {
    _id: postId(seed.slug), _type: 'post', title: seed.title, slug: { _type: 'slug', current: seed.slug },
    publishedAt: o.publishedAt, excerpt: seed.excerpt, tags: seed.tags, model: seed.model,
    ...(o.labPage ? { labPage: o.labPage } : {}), body,
  };
}

/** Published posts, oldest first. Anonymous reads of a public dataset see published documents only. */
export const NOTES_QUERY = `*[_type == "post" && defined(slug.current) && defined(publishedAt)] | order(publishedAt asc) {
  _id, title, "slug": slug.current, publishedAt, excerpt, tags, model, labPage, body
}`;

/** One post as NOTES_QUERY returns it. Optional fields may be null. */
export interface FetchedPost {
  _id: string; title: string; slug: string; publishedAt: string; model: string;
  excerpt?: string | null; tags?: string[] | null; labPage?: string | null;
  body: SanityBlock[];
}

/** Where the build writes its copies of Sanity images (no runtime CDN). */
export const IMAGE_ROUTE = '/notes/img/';

/** 'image-<hash>-<w>x<h>-<ext>' → '<hash>-<w>x<h>.<ext>' (the CDN file name). */
export function imageFile(ref: string): string {
  const m = ref.match(/^image-([a-zA-Z0-9]+-\d+x\d+)-([a-z0-9]+)$/);
  if (!m) throw new Error(`not an image asset id: ${ref}`);
  return `${m[1]}.${m[2]}`;
}
export const imageCdnUrl = (ref: string, projectId: string, dataset: string) =>
  `https://cdn.sanity.io/images/${projectId}/${dataset}/${imageFile(ref)}`;

/** Fetched posts (any order) → the view model, newest first, numbered by publication time. */
export function postsToNotes(posts: FetchedPost[]): Note[] {
  const sorted = [...posts].sort((a, b) => Date.parse(a.publishedAt) - Date.parse(b.publishedAt) || a.slug.localeCompare(b.slug));
  return finishNotes(sorted.map((p) => {
    const images: string[] = [];
    const body = p.body.map((b): PTBlock => {
      if (b._type !== 'image') return b;
      images.push(b.asset._ref);
      const { asset, ...rest } = b;
      return { ...rest, src: IMAGE_ROUTE + imageFile(asset._ref) };
    });
    return {
      slug: p.slug, title: p.title, date: new Date(p.publishedAt).toISOString().slice(0, 10), published: new Date(p.publishedAt).toISOString(),
      excerpt: p.excerpt ?? '', tags: p.tags ?? [], model: p.model,
      ...(p.labPage ? { labPage: p.labPage } : {}), images, body,
    };
  }));
}
