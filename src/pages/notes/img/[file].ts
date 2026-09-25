// Self-hosted copies of the images used in Notes posts. At build time each Sanity image
// asset is fetched once and written into dist/, so readers never load from Sanity's CDN
// (no runtime CDNs; see PROGRESS.md §Decisions).
import type { APIRoute, GetStaticPaths } from 'astro';
import { allNotes } from '../../../lib/notes';
import { imageCdnUrl, imageFile } from '../../../lib/notes/sanity';
import { sanityConfig } from '../../../lib/notes/sanity.config';

export const getStaticPaths = (async () => {
  const refs = new Set((await allNotes()).flatMap((n) => n.images));
  return [...refs].map((ref) => ({ params: { file: imageFile(ref) }, props: { ref } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const url = imageCdnUrl(props.ref as string, sanityConfig.projectId, sanityConfig.dataset);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Notes image ${url}: HTTP ${res.status}`);
  return new Response(await res.arrayBuffer(), { headers: { 'Content-Type': res.headers.get('content-type') ?? 'application/octet-stream' } });
};
