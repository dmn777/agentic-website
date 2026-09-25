# Design: "Plates"

The design system of **Unattended**, the v2 of this site. It was chosen and built by Claude
with no human design input (the brief was "pick one distinctive direction and commit to
it"). This file records the direction, the reasons for it, and the tokens. Every new page
follows it. `/styleguide/` (unlisted) shows all of it working, and it is the page the
screenshot suite and the reviewer subagents look at.

## The direction in one paragraph

A **19th-century scientific atlas, printed by a pen plotter**. Each Lab page is a numbered
*plate* (Pl. I, Pl. II…) with a notebook margin for labels. The signature image is a
**plotted specimen**: a seeded line drawing that a program generates and that draws itself
stroke by stroke, the way a plotter lays down ink. Type pairs a condensed Didone (the
atlas) with a monospace (the instrument). The palette is blue-black ink on warm paper,
with one vermilion pen for emphasis. In dark mode the same plate is printed on a night-blue
sheet, closer to a cyanotype.

## Why this, for this site

- **The site is a lab notebook kept by a machine.** It holds stats explorables, generative
  art, a game and a build journal, and every item in it was made by a program that nobody
  supervised. An atlas of plates fits that: each page is a specimen, presented with some
  ceremony, numbered and captioned.
- **A pen plotter is the honest picture of the process.** An agent works the way a
  plotter draws: one stroke at a time, in order, with no hand guiding it. The motif can be
  *generated* (the brief says visuals come from code), and it is *seeded* like everything
  else in the lab, so it is reproducible, testable and unique to each page.
- **It avoids the generic AI-site look.** No gradient blobs, no glassmorphism, no purple,
  no Inter. It is typographic, warm, a little eccentric, and legible.
- **It carries a course site well later.** Plates, figures, captions and margin notes are
  the vocabulary of teaching material (see `WORKFLOW.md`).

## Name

**Unattended**, with the tagline "A lab built by Claude, with no one watching". This run had
no human review checkpoints, and the name says so plainly. The footer is a
technical-drawing **title block** whose *Checked by* field reads "— (unattended)". The URL
base stays `/agentic-website/`.

## Typography

| Role | Face | Notes |
| --- | --- | --- |
| Display (h1–h3, brand) | **Imbue** (variable: opsz, wght) | A condensed Didone with high contrast. It sits tall and narrow like atlas plate titles, and it fits long headlines on phones. Weights 450–520. |
| Text | **Newsreader** (variable: opsz, wght, italic) | A text face designed for reading on screens. Optical sizing is on; old-style figures in running text. |
| Instrument / labels | **Martian Mono** (variable: wdth, wght) | Plate numbers, "Fig." labels, nav, meta, code. Uppercase and tracked (`.label`). |

- All three are self-hosted through Fontsource (`@fontsource-variable/*`, OFL-1.1) and
  imported in `layouts/Base.astro`. No font CDN.
- Scale: a fluid modular scale from `--step--2` to `--step-5` (360 → 1440 px). Body text is
  ≥ 17 px on mobile (`--step-0` min 1.075 rem).
- Tabular lining numerals in mono and in data. Old-style numerals in prose.

## Colour tokens

`src/styles/tokens.css` is the single source of truth. Each colour is **one**
`light-dark(<paper>, <night plate>)` declaration. The theme toggle only flips
`color-scheme` on `<html>`, so the whole look can be swapped by editing this one file.
`tokens.test.ts` enforces the contrast contract: text tokens ≥ 4.5:1 on every surface, and
pens, frames and focus ≥ 3:1, in both themes.

| Token | Light | Dark | Contrast on paper (L / D) | Role |
| --- | --- | --- | --- | --- |
| `--paper` | `#f2ede3` | `#0e151d` | n/a | page ground: warm plate paper / night plate |
| `--paper-raised` | `#f8f5ee` | `#141e28` | n/a | cards, panels, inputs, code |
| `--paper-sunk` | `#e7e0d1` | `#0a1016` | n/a | wells, tracks, code headers |
| `--ink` | `#191d28` | `#ece6d9` | 14.4 / 14.8 | body text, plot strokes |
| `--ink-2` | `#414654` | `#c3c5c9` | 8.1 / 10.6 | secondary text, ledes |
| `--ink-3` | `#5a5f6b` | `#9aa1aa` | 5.5 / 7.0 | captions, labels, meta |
| `--accent` | `#e0442b` | `#ff6a48` | 3.6 / 6.5 | the vermilion pen (graphics, underlines) |
| `--accent-ink` | `#a82e18` | `#ff8f74` | 5.9 / 8.2 | vermilion as text |
| `--teal` / `--teal-ink` | `#1d7a80` / `#17656a` | `#52c0c6` / `#7fd3d7` | 4.3 / 8.5, 5.8 / 10.7 | second pen (data series) |
| `--ochre` / `--ochre-ink` | `#a8741a` / `#7f5610` | `#e0b155` / `#e8c27a` | 3.5 / 9.3, 5.6 / 10.9 | third pen (data series) |
| `--rule` | `#cbc2b0` | `#2a3846` | 1.5 / 1.5 | hairlines, grids (decorative only) |
| `--rule-strong` | `#6f6a60` | `#6f7c8a` | 4.6 / 4.3 | frames, axes, crop marks |
| `--focus` | `#1f56c9` | `#8fb3ff` | 5.6 / 8.8 | keyboard focus ring (a blue pen, used nowhere else) |

- **Usage rules.**
  - Vermilion is the *one* accent: underlines, the plate number, the misregistered shadow
    and a few strokes per specimen. It never fills large areas.
  - Links are ink-coloured text with a vermilion underline.
  - Data visualisations use ink, then teal, then ochre, then vermilion for the highlighted
    series.
- **Paper grain.** A tiled `feTurbulence` noise image is part of the `body` background and
  is blended into `--paper` (multiply on paper, screen at night). It is never an overlay,
  so it can't sit on top of content or canvases.
- **Code.** The two custom Shiki themes in `src/styles/shiki-themes.ts` ("plate-light",
  "plate-dark") are used by both Markdown fences and `<CodeBlock>`. Stock themes failed AA
  on the plate paper (mostly the comments), and the old site's code blocks were unreadable
  in light mode, so these themes are unit-tested: every token colour is ≥ 4.5:1 on
  `--code-bg`.

## The signature motif: plotted specimens

`src/lib/plot/specimen.ts` (pure, seeded, tested) turns a seed string into single-weight
strokes, and `<Plot seed=… />` renders them as static SVG at build time. There are five
species:

| Species | What it draws |
| --- | --- |
| `flow` | fibres combed through a noisy blob, like a seed pod |
| `contour` | topographic rings around a drifting centre |
| `radial` | bent spines from a core: urchin, dandelion, burst |
| `ridge` | a ridgeline plot with hidden-line removal |
| `orbit` | a damped harmonograph, cut into strokes |

- A seed is usually the page's route (`lab/stats`), so each plate has its own specimen,
  the same on every build. `species` can be forced.
- The ink pen draws most strokes and the vermilion pen draws 1–4.
- **Pen width stays constant on screen.** `--plot-px` (1.1) is multiplied by
  `--plot-scale`, which `scripts/page.ts` keeps current with a ResizeObserver.
  `vector-effect: non-scaling-stroke` is deliberately *not* used: in Chromium it breaks the
  `pathLength`-normalised dash animation for any plot drawn larger than its viewBox (found
  in QA, see `WORKFLOW.md`).
- **Drawing.** `<Plot draw>` starts once the plot scrolls into view (IntersectionObserver
  → `data-in`). Each stroke animates `stroke-dashoffset` 1 → 0, one after another. The
  total time is set by the `duration` prop, and the stagger is derived from it. Without
  JS, plots are simply shown finished. LabCards re-plot on hover and focus.

## Layout

- **Page frame.** `.wrap` has a max of 88 rem with fluid gutters (16 px on phones).
- **Header.** The brand is a registration mark plus "Unattended". The nav is in mono
  uppercase, with the current page marked by a vermilion bar. The header rule is a
  **ruler**: a hairline with ticks every 8 px and every 80 px.
- **Plate grid** (`.plate-grid`). An 11 rem notebook margin holds labels ("Pl. III",
  "§2 · Type", "Fig. 4"), beside the main column. Below 52 rem it collapses to one column,
  with the label above.
- **Cards.** Cut square, with **crop marks** at the corners (`.crop`, one pseudo-element
  and eight gradients). On hover, the marks turn vermilion and a faint misregistered shadow
  appears.
- **Footer.** A technical-drawing title block: Title | Drawn by / Sheet | Checked by | Date
  | Rev / See also (source, the Cowork version at `/v1/`, and the Studio once T15 is done).
- **Rhythm.** `.stack` is a grid whose gap is `--flow`. `--flow` is registered as a
  non-inheriting `@property`, so nested stacks don't inherit their parent's gap. Its
  `initial-value` must be in px: Chromium silently drops an `@property` rule whose initial
  value is in `rem`.

## Numbering

- **Roman numerals:** plates (Pl. I, Pl. II…) and a page's own numbered statements, such as
  the rules on Home. This is the atlas convention.
- **§ numbers:** in the notebook margin, for the sections of a long page (§1 · What).
- **Arabic numerals:** ordinary ordered lists inside prose, and "Fig. n" labels.

## Components (`src/components/`)

| Component | Use |
| --- | --- |
| `Plot` | a seeded specimen (`seed`, `species?`, `detail`, `draw`, `duration`, `label`) |
| `Card`, `LabCard` | plate cards; `LabCard` takes a `LabEntry` from `src/data/lab.ts` (the single Lab metadata source) |
| `Button` | `primary` (ink, with a vermilion second impression), `secondary` (outline), `quiet` (underlined text); `<a>` if `href` |
| `Tag` | `#tag` pills, tones `ink`, `accent`, `teal` |
| `Callout` | `note` (teal), `warn` (vermilion), `tip` (ochre); a marginal note on raised paper |
| `Figure` | numbered "Fig. n" label and an italic caption; framed by default |
| `Prose` | wrapper for long text; `.prose` styles live in `global.css` so Markdown HTML picks them up |
| `CodeBlock` | Shiki with the plate themes, plus an optional filename bar |
| `ThemeToggle`, `RegMark`, `SiteHeader`, `TitleBlock` | layout chrome |
| `islands/PlotPlayground.svelte` | the Svelte 5 island on the styleguide; proves the generator runs identically on the client |

**Form controls** (`global.css`) are part of the system, and explorables must use them
instead of browser defaults:

- Range sliders have a hairline track that fills in ink, and a paper thumb with a
  vermilion offset.
- Selects are square, with a drawn chevron.
- Checkboxes and radios are square- or round-cut, with a vermilion mark.
- `.control` is the "LABEL ……… value" row.

## Charts and explorables

Established by the three statistics plates, and to be followed by later ones:

- **Hand-built SVG** with the helpers in `src/lib/scale.ts` (`linearScale`, `logScale`,
  `niceTicks`); no charting library. All maths lives in tested TS modules, and the Svelte
  island only holds state and draws.
- **Measure, don't scale.** Charts use `bind:clientWidth` and draw at real pixel width,
  so 11 px mono tick labels stay legible at 390 px. A viewBox scaled down would shrink the
  text. Guard the width against the `0` that Svelte reports for one frame during
  hydration (`wRaw || default`): a negative `<rect>` width is a console error, and the
  gate fails on it.
- **Colour roles.**
  - Ink bars or dots: observed data.
  - Vermilion: the model or prediction (fitted line, CLT curve, "has the condition").
  - Teal: the sample or residuals (rug ticks, residual lines, false positives).
  - `--rule-strong` outlines: the neutral majority.
  - Densities get a 45° hatch in ink at 35 % opacity, as a plotter would fill them.
- **Encodings are stated in the caption.** For example: "Filled: tested positive.
  Outlined: tested negative." Every mark in a figure is explained in its caption or
  legend.
- **Controls panel.** Controls sit in a raised panel above the figure, use the shared form
  controls, and give every button a text label. Readouts sit below in mono with tabular
  numerals, as `<dl>` with `aria-live="polite"`.
- **Determinism.** Every random element is seeded (`plate-N/...`), so the first view and
  every QA screenshot are reproducible.

## Motion: "plotted, not tweened"

1. Things arrive the way a plotter makes them: stroke after stroke, in order, at pen speed
   (`--ease-pen`, `--dur-stroke` 700 ms, `--stagger`). Nothing bounces or flies in.
2. Interface feedback is quick (`--dur-ui` 160 ms) and small. The misregistered shadow
   shifts by a pixel or two, and a pressed button closes the gap with its shadow.
3. One orchestrated moment per page at most. On Home, that is the hero specimen drawing
   itself.
4. **Reduced motion.** Every animation and transition is cut to 1 ms, so each drawing
   appears finished. Canvas/JS animations must check `prefersReducedMotion()`
   (`scripts/theme.ts`) and render a still frame.

## Theming mechanics

- An inline script in `<head>` adds `html.js` and applies a stored choice
  (`localStorage.theme` = `light` | `dark`) before first paint. With no stored choice, the
  page follows `prefers-color-scheme` through `color-scheme: light dark`, and that works
  without JS too.
- The toggle (`[data-theme-toggle]`) sets `data-theme`, stores it, and dispatches a
  `themechange` event.
- Canvas and SVG code reads colours with `tokenColor('--ink')` and re-renders on
  `onThemeChange(cb)` (`src/scripts/theme.ts`).
- Values that aren't colours (the grain blend mode) switch through
  `[data-theme='dark']` plus a `prefers-color-scheme` media query, since `light-dark()`
  only accepts colours.

## Rules for new pages

- Use `Base.astro` and the tokens. No raw hex values outside `tokens.css`,
  `shiki-themes.ts` and generated art.
- Give each Lab page a plate number (from `src/data/lab.ts`), a margin label column, and at
  least one specimen or figure.
- Label figures "Fig. n", keep captions in italic Newsreader, and keep numbers in mono.
- Mark animated pages with `data-qa-motion` (`<Plot draw>` does this automatically), and
  mark canvases that must not be blank with `data-qa-canvas`.
- Check both themes and 390 px width. `npm run qa:shots` enforces most of this.

## Page records

Topic choices for pages whose subject Claude picks are recorded here as they are made.

- **Scrollytelling story (T8):** *not yet chosen.*
- **Wildcard page (T10):** *not yet chosen.*
