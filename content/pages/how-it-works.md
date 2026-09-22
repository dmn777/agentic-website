---
title: How this website works
description: The technical side — how content is authored, how it becomes a static website, and where every piece lives.
navTitle: How it works
order: 3
updated: 2026-09-22
---

This is a **static website**: a folder of plain HTML, CSS and image files, generated once per change and then served as-is. There is no server-side code and no database, which is why it can be hosted for free.

## 1 · Content is written in Markdown

Every page you read is a plain-text Markdown file. The block between the `---` lines at the top is *frontmatter*: structured information about the page, such as its title and its position in the menu. Below it is the text itself.

```markdown
---
title: How this website works
description: The technical side — how content is authored…
navTitle: How it works
order: 3
---

This is a **static website**: a folder of plain HTML…
```

Links between pages are written like `[Authors](/authors/)`. Adding a new page means adding a new file — nothing else.

## 2 · The project folder

```text
Website/
├── content/            ← everything a reader sees (Markdown)
│   ├── pages/          ← one file per top-level page
│   └── authors/        ← one file per author
├── src/                ← how the site is built (rarely touched)
│   ├── content.config.ts   rules for what a page/author file must contain
│   ├── layouts/        ← the frame around every page: header, menu, footer
│   ├── pages/          ← which URLs exist and which content they show
│   └── styles/         ← colours, fonts, spacing
├── public/             ← files copied unchanged (e.g. the icon)
├── .github/workflows/  ← instructions for GitHub to build and publish
└── astro.config.mjs    ← site address and build settings
```

The split is deliberate: **editing the site** happens in `content/`, **changing how the site works** happens in `src/`.

## 3 · From Markdown to website: Astro

The files are turned into a website by [Astro](https://astro.build), a *static site generator*. On every build it

1. reads all Markdown files in `content/` and checks their frontmatter against the rules in `content.config.ts` — a missing title stops the build with a clear error instead of producing a broken page;
2. converts the Markdown into HTML and places it inside the shared layout;
3. creates one page per file (plus the menu, which is generated from the `order` values);
4. writes the finished site into a `dist/` folder.

A small addition of our own rewrites links like `/authors/` to `/agentic-website/authors/`, because the site does not live at the root of its domain.

## 4 · Publishing: GitHub and GitHub Pages

| What | Where | Why |
|---|---|---|
| Source files | Project folder on David's laptop | Where the agent edits; David can open everything |
| Version history | Git, pushed to a public GitHub repository | Every change is recorded and can be undone |
| Build | GitHub Actions (GitHub's free build machines) | Runs Astro on every push to the `main` branch |
| Hosting | GitHub Pages | Serves the finished files for free, with HTTPS |

So publishing a change is: *edit Markdown → commit → push*. GitHub does the rest in about a minute.

## 5 · Where the agent runs

Claude Cowork runs the agent in Anthropic's cloud, but it can reach the project folder through a **shell on David's own laptop** (an isolated Linux environment that sees only the folders David connected). Edits, git and test builds happen there; web research and screenshots of the live site happen in the cloud. The only credential is a GitHub access token that can touch this one repository and nothing else; it lives in a git-ignored file and is never published.
