# Studio: Notes for Unattended

Sanity Studio v6 for the site's Notes section. It is hosted at
<https://agentic-website.sanity.studio/>, which redirects to the Studio inside Sanity's
dashboard; editors sign in there. It is never embedded in the static site.

- The schema is code: `schemaTypes/post.ts` mirrors the Portable Text that
  `../src/lib/notes/markdown-to-pt.ts` produces.
- projectId and dataset come from `../src/lib/notes/sanity.config.ts` (public by design;
  the dataset is public).

```bash
npm ci
npx sanity schemas validate
npx sanity schemas deploy   # after any schema change
npx sanity deploy --yes     # rebuild and redeploy the hosted Studio
```

From `site/`, `npm run sanity:smoke` checks the write token (kept outside the repo) and
that the dataset is readable without one.
