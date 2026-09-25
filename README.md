# Unattended

A lab of interactive pages, designed, built, tested and shipped by Claude (Claude Opus 5.5
in Claude Code) with no human review along the way. The human wrote the brief in one
planning session and looked at the finished site. Every page, drawing, line of copy and
test is model-made.

Live: https://dmn777.github.io/agentic-website/

The first version of this site, built in Claude Cowork with a human in the loop, is
frozen unchanged at [`/v1/`](https://dmn777.github.io/agentic-website/v1/). Its old URLs
redirect there.

## What's on the site

- **The Lab** (`/lab/`): eight numbered plates.
  - I–III *Statistics, seen*: sampling and the CLT, Bayes and base rates, least squares
    (a series with a hub at `/lab/stats/`).
  - IV a gallery of generative drawings, V a scrollytelling story about the Keeling
    curve, VI a replay of a real Claude Code session, VII a Chladni-plate simulation,
    VIII *Darkfield*, a game.
- **Notes** (`/notes/`): the build journal, one post per milestone, managed in
  [Sanity](https://www.sanity.io/) and baked into the static pages at build time. Tag
  pages and an RSS feed (`/notes/rss.xml`).
- **About**, a 404, and an unlisted `/styleguide/` used as QA infrastructure.

No analytics, cookies or runtime CDNs. Fonts are self-hosted. `localStorage` holds only
the theme choice and the game's best score.

## Stack

Astro 7 (static output) with Svelte 5 islands (`client:visible`). The logic lives in
plain TypeScript modules under `src/lib/`, so the islands stay thin and the rules are
unit-tested. Every visual is drawn by code (SVG or canvas). GitHub Actions builds the
site and deploys it to GitHub Pages under the base path `/agentic-website/`.

## Layout

```
src/
  pages/         routes: index, about, 404, lab/…, notes/…, styleguide, [...legacy] (redirect stubs)
  layouts/       Base.astro (head, header, footer), LabPage.astro (plate header, pager, Continue block)
  components/    design-system components; islands/ (Svelte); notes/ (Portable Text renderers)
  data/          lab.ts (every plate: the one source for Home, /lab/, pagers and meta copy),
                 site.ts (name, nav, legacy redirects), tags.ts (the journal's tag registry)
  lib/           pure logic with tests: stats, art, plot, chladni, game, keeling, notes, url…
  styles/        tokens.css (all colours, type and spacing as custom properties), global.css
content/notes-seed/   Markdown drafts of the journal posts, for import into Sanity only
studio/               Sanity Studio v6 (schemas in code), hosted at agentic-website.sanity.studio
scripts/qa/           the QA suite (below); states/ holds per-page interaction scripts
scripts/sanity/       client, smoke test, push, field sync, Studio screenshots
public/v1/            the frozen Cowork site (don't edit)
DESIGN.md             design direction, tokens and page records
docs/GAME_DESIGN.md   Darkfield's design document and tuning log
FRICTION_LOG.md       where things got stuck, in both phases
```

## Commands

Node 24 (the scripts import TypeScript directly). Run everything from this folder.

```bash
npm ci
npm run dev                 # local dev server
npm run check               # astro check + svelte-check
npm test                    # Vitest (stats, generators, game rules, contrast, notes mapping…)
npm run build               # static site into dist/
```

The QA suite runs against `dist/`, served by a small server with GitHub Pages semantics:

| Command | What it checks |
|---|---|
| `npm run qa:shots [-- --routes /lab/art/ --label X]` | Playwright screenshots of every page in light/dark × desktop/390 px, plus interaction states. Fails on console errors, failed requests, horizontal overflow at 390 px, blank canvases and drawings that never start. |
| `npm run qa:sheet -- --from <shots>` | Contact sheets for cross-page review, and a wiring check that every Lab card links to a page with a matching title. |
| `npm run qa:links` | Every internal `href`/`src`/`srcset`/CSS `url()` resolves, fragments exist, no orphan pages, and every journal post and its plate link to each other. |
| `npm run qa:redirects [-- --live]` | Old Cowork URLs land on their `/v1/` twins, with and without JS. |
| `npm run qa:claims` | Meta descriptions and ledes neither promise unbuilt sections nor leave out a live kind of plate. |
| `npm run qa:game` | Darkfield's harness: state machine, deterministic scripted bot, random bots, difficulty curve, touch at 390 px, frame time. |
| `npm run qa:deploy [-- --label X]` | After a push: waits for the Actions run, then fetches the live pages and checks their `build-sha` against the commit. |

`node scripts/qa/game-driver.mjs --plan plan.json --out <dir>` plays scripted Darkfield
sessions and saves screenshots (see its header).

## Notes and Sanity

- Project `iqqgfhxj`, dataset `production`, on the Free plan. The dataset is **public**,
  so the build reads it without a token. The config is in
  `src/lib/notes/sanity.config.ts` (public by design), and the Studio shares it.
- **Sanity is the source of truth** for the posts. The files in `content/notes-seed/` are
  drafts for import. `NOTES_SOURCE=seeds npm run build` renders them offline instead.
- Writes need a token, kept **outside** the repo (`../_secrets/sanity_token.txt`) and
  read by `scripts/sanity/client.mjs`. A 403 from Sanity stops every script with an
  explanation instead of a workaround.

```bash
npm run sanity:smoke                                   # token works, dataset is publicly readable
npm run notes:push -- content/notes-seed/09-x.md       # create a post (--force replaces)
npm run notes:sync -- --dry-run                        # patch only labPage/tags from the seeds
npm run deploy:trigger -- --verify --routes /notes/    # rebuild the live site and check it
npm run studio:shots                                   # screenshots of a local, signed-in Studio
```

- **Publishing is a rebuild.** After a Studio edit, run the "Deploy to GitHub Pages"
  workflow in Actions (or `deploy:trigger`). The workflow also listens for a
  `repository_dispatch` event called `sanity-publish`, which is what a Sanity webhook
  would send. That webhook isn't set up yet: it needs its own narrow token.
- The Studio: `cd studio && npm ci`, then `npx sanity schemas deploy` after a schema
  change and `npx sanity deploy --yes` to redeploy it (see `studio/README.md`).

## Deploy

Every push to `main` builds and deploys through `.github/workflows/deploy.yml`
(`withastro/action` → `actions/deploy-pages`). The same workflow runs on
`workflow_dispatch` and on `repository_dispatch: sanity-publish`. In CI the layout
stamps each page with `<meta name="build-sha">` and `<meta name="build-run">`, so a
deploy can be proven to be this commit and this run.
