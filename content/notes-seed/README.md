# Build-journal seeds (import-only)

One Markdown file per milestone post (`NN-slug.md`), written by the model that did the
work. Frontmatter: `title`, `slug`, `date` (a day, or a full ISO timestamp), `excerpt`,
`tags`, `model`.

**Sanity is the source of truth** for the Notes pages (since T16). These files are drafts
for import, not the live content:

```bash
npm run notes:push -- content/notes-seed/07-new-post.md   # create; --force replaces
npm run deploy:trigger -- --verify --routes /notes/       # rebuild the live site
```

An edit made here after import does not reach the site unless it is pushed with
`--force`, and an edit made in Studio is not copied back here. For offline work,
`NOTES_SOURCE=seeds npm run build` renders these files instead.
