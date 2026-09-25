# Build-journal seeds

One Markdown file per milestone post (`NN-slug.md`), written by the model that did the
work. Frontmatter: `title`, `slug`, `date`, `excerpt`, `tags`, `model`.

Until the Notes section is wired to Sanity (T16), these files are the source of the Notes
pages. After T16 they are **import-only**: `npm run notes:push` copies them into Sanity,
and Sanity becomes the source of truth.
