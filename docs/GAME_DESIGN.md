# Darkfield: game design

Plate VIII of the Lab, `/lab/darkfield/`. The design is Claude's own, written before
the build (T11) and kept up to date through T12–T13. David framed the game as the hard
benchmark of the unattended run, so this document states what "good" means up front. The
playtest in T13 is judged against it.

## Concept

**You are the pen of a plotter under a microscope.** The screen is the round, lit field
of a darkfield microscope. Diatoms, the glass-shelled algae that naturalists drew in
atlases, drift through it. Your pen moves on its own and you steer it, leaving a line of
wet ink. **Close the line into a loop around diatoms to catalogue them.** Everything
inside the loop is captured and scored, and the ink refills. The pen never stops, and the
ink drains all the time, so you have to keep catching. Contaminants drift in as well. If
one touches your pen, the slide is ruined; if one touches your wet line, the line snaps.

One sentence for the Lab card: *Loop your ink around drifting diatoms to catalogue them,
before the pen runs dry.*

### Pillars

1. **One verb, drawn.** Steering a line is the whole game. Every mechanic is about the
   shape you draw: its size (big loops score more but take longer to close), its path
   (it must avoid contaminants) and its timing (the ink is running out).
2. **Greed against safety.** A loop around one diatom is safe and slow. A loop around
   five scores 25 times as much, but your line is exposed for longer. The multiplier
   makes that choice worth thinking about every time.
3. **Readable at a glance.** Bright line art on black. Only four things move: your pen,
   diatoms (pale), contaminants (amber, spiky, pulsing) and your ink (vermilion). The
   rules can be learned from the title screen's three sentences.
4. **Seeded and fair.** A run is a seed. The same seed and the same inputs give the same
   game, which makes the difficulty testable and the bugs reproducible.

### Core loop (seconds)

Steer → draw → close a loop → capture burst, score, ink refill → pick the next cluster.
Around it: the difficulty rises over the run (minutes), and a run ends with a score and a
personal best (the session).

## Controls

| Input | Steer | Other |
| --- | --- | --- |
| Keyboard | ← → or A D turn the pen | Space/Enter start or restart · P or Esc pause · M sound on/off |
| Mouse | The pen turns towards the pointer while it is over the field | Click to start; buttons for pause and sound |
| Touch | Touch and hold anywhere: the pen turns towards your finger. Two thumb buttons (◀ ▶) are the alternative | Tap to start; buttons for pause and sound |

- The pen has a fixed maximum turn rate, so "towards the pointer" is a smooth arc, never a
  snap, and every input method draws the same kind of line.
- **The last input method used wins:** pressing a key hands control back to the keys, and
  moving the pointer hands it to the pointer.
- The game pauses on its own when the tab is hidden or the window loses focus.

## Rules (the pure simulation)

World units (u). The field is a circle of radius **R = 500 u**. The simulation runs at a
fixed **60 ticks per second**. All randomness comes from the run's seed.

- **Pen.** Its speed is set by the difficulty (170 → 250 u/s), and its turn rate is
  3.4 rad/s (a turning circle of about 50–74 u). At the rim it reflects, like a ball
  off a cushion, and that costs 3 ink, at most once every 0.5 s. An aim point outside
  0.85 R is pulled in to that radius, so a resting pointer can't grind the pen along the
  rim (playtest 1 found −48 ink in a third of a second).
- **Wet ink (the trail).** One point per tick. The trail keeps only the newest
  **1,500 u** of line; older ink dries and fades away. So a loop has to close within
  1,500 u of line.
- **Loop capture.** When the pen's newest segment crosses an older segment of its own
  wet trail, the line closes. The loop is the polygon from the crossing point along the
  trail to the pen.
  - Everything whose centre lies inside the polygon is captured.
  - Loops smaller than 1,500 u² are ignored, so a jitter can't count as a loop.
  - The whole wet trail is then used up (it "dries" into the catalogue), and the pen
    starts a fresh line.
  - The four newest segments are never tested, so a line can't cross itself at the pen.
- **Diatoms.** They spawn at random points at least 180 u from the pen, drift at
  10–30 u/s with a slow spin, and bounce 45 u inside the rim, so a loop can always get
  round them. (They were 15–45 until playtest 1: at that speed, clusters broke up during
  a 4–5 s lap. The 45 u margin came in polish 2, after the aim clamp had made rim
  diatoms uncatchable.) Four species:
  | Species | Look | Points | Speed | Share |
  | --- | --- | --- | --- | --- |
  | *Coscinodiscus* (disc) | radial, round | 10 | slow | 55 % |
  | *Navicula* (boat) | long, pointed | 20 | medium | 28 % |
  | *Triceratium* (triangle) | three-cornered | 40 | quick | 13 % |
  | *Asterionella* (star) | a star-shaped colony; leaves after 8 s | 100 | quick | 4 % |
- **Contaminants.** Amber, spiky and pulsing. They drift faster than diatoms and turn
  slowly towards the pen, with a lazy homing that you can outturn.
  - Contaminant touches the pen: **the run ends.**
  - Contaminant touches the wet trail: **the trail snaps.** It is cleared at once, and
    that costs 6 ink.
  - A contaminant *inside* a closed loop is removed for 25 points. It is risky but
    allowed.
- **Ink.** A run starts with 100, and catches can overfill the well to **120**. It
  drains all the time, at 2.2 → 4.5 per second as the difficulty rises. **A loop
  refills the way it scores: (the sum of its catches' ink) × n.** A diatom is worth 14
  ink and the star 25, so one disc refills 14, two refill 56, and three fill the well.
  Greed pays in ink as well as points. **At 0 ink the run ends.** A passive pen runs dry
  in about 35 s, which bounds the random bot.
- **Scoring.** A loop that captures n diatoms scores (sum of their points) × n. So one
  disc is 10, and five discs are 250. Every 500 points is a "slide", a milestone
  shown on the HUD. The personal best is stored in `localStorage` (`darkfield.best`).

## Difficulty curve

One continuous value, **d(t) = 1 − e^(−t / 200 s)**. It is monotone: 0 at the start,
0.5 after 139 s, 0.78 after 5 min. Every parameter is a monotone function of d:

| Parameter | d = 0 | d = 1 |
| --- | --- | --- |
| pen speed | 170 u/s | 250 u/s |
| ink drain | 2.2 /s | 4.5 /s |
| diatoms on the field (target) | 9 | 5 |
| diatom respawn delay | 0.8 s | 1.8 s |
| contaminants (target) | 1 (from t = 12 s) | 6 (+1 at d = 0.4, 0.6, 0.75, 0.85, 0.93) |
| contaminant speed | 45 u/s | 115 u/s |
| contaminant homing | 0.1 rad/s | 0.6 rad/s |

- The state exposes `d` and all derived parameters, so the harness can assert that they
  rise (or, for diatom supply, fall) monotonically.
- Intended arc: the first 30 s are forgiving and teach the loop. Minutes 1–3 are the
  greed game. After 4 minutes it is a scramble.
- Expected sessions: a new player lasts 1–2 min per run, a practised one 4–6 min.
  With restarts, that is 2–10 minutes.

### Tuning log

- **T12, first retune.** The slice's economy (drain 3.5 → 9, refill 7, 7 → 4 diatoms)
  barely rewarded play. A greedy bot that loops around the densest cluster and swerves
  away from contaminants lasted a median 30 s over 30 seeds, against 21 s for a pen left
  alone. A single catch didn't pay for the loop it took. With drain 2.5 → 7.5, refill 12
  and 9 → 5 diatoms, the same bot lasts a median 47–51 s (max 69 s), and a passive pen
  about 30 s. The bot catches about one diatom per loop; a player who makes multi-catches
  should do much better. T13's playtest judges it.
- **T13, playtest 1 retune.** The playtest found the game 2–3× too harsh. Every persona
  died at 25–85 s with d below 0.5, so the greed game and the scramble never happened.
  Greed barely paid, since every strategy had a median death of 54–61 s. The playtester's
  skilled bot, run on a bundle of the real sim, confirmed a 60.9 s median. The package,
  all of it at once (each change alone added only 4–13 s):
  - drain 2.2 → 5.5;
  - τ 200 s;
  - refill 14 × n per catch, with a 120 cap;
  - contaminant steps at d = 0.3–0.9, the first at 12 s, and starting homing 0.1;
  - diatom drift ×0.65;
  - a rim cooldown and an aim clamp.
  Result over 40 seeds: the skilled bot's median went from 61 s to 164 s (90th
  percentile 215 s, best 240 s, median score 1,010). The naive "point at the nearest
  diatom" bot went from 42 s to 79 s. That puts a new player at 1–2 minutes and a
  practised player towards the intended 4–6.
- **T13, playtest 2 retune (polish 2, the last).** The re-playtest confirmed the gains:
  the skilled bot lasted a median 157 s, and a hand-steered run lasted 2:46. It found a
  death spiral once the third contaminant arrived (d = 0.5, 139 s): snaps went from 3 to
  11 per minute, mostly behind the nib where nobody is looking. Practised runs ended at
  2.5–3 minutes instead of 4–6, and greed didn't change survival. The changes:
  - contaminant steps at d = 0.4, 0.6, 0.75, 0.85, 0.93;
  - drain 2.2 → 4.5;
  - diatoms bounce 45 u inside the rim.
  On a bundle of the real sim, over 40 seeds: the skilled bot's median went from 157 s
  to 220 s (90th percentile 289 s, best 380 s, median score 1,580), and the naive bot's
  from 80 s to 116 s. Its catches per loop rose from 1.41 to 1.55. That puts a new
  player at about 2 minutes and a practised one at 4–6.

## Juice (feedback)

- **Capture:** the loop polygon fills with a hatched vermilion wash and fades out over
  400 ms. Captured diatoms flash white, then fly to the catalogue counter, and a label
  rises from the loop that spells out the multiplier ("40 × 3 = +120"). The chime pitch
  climbs with n. A loop that catches nothing gets a grey dashed outline and the word
  "empty", so it can't pass for a catch.
- **Ink:** the pen's line is brightest at the nib and dims along the trail. The ink also
  shows on the field, where the eyes are: an arc round the field stop from twelve
  o'clock. The arc and the HUD gauge pulse, and a tick sounds, below 20. A rim hit floats
  a vermilion "−3" in from the rim and flashes the HUD gauge.
- **Snap:** the trail shatters into fragments (particles), with a dry crack sound.
- **Game over:** an ink-blot bloom from the pen, then the result card, which shows the
  score, time, catches and best loop. A contaminant hit adds a 250 ms screen shake; running
  dry doesn't, because nothing hit anything.
- **Slides:** every 500 points a large "Slide II" banner crosses the top of the field
  for 2.5 s, and the HUD counts slides.
- **Attract mode:** behind the title card, an autopilot pen (`autopilot.ts`, tested)
  flies a field of its own and closes loops around clusters, washes and all. It shows
  the verb before the rules ask for it, and stands still under reduced motion.
  - The title card docks low and the pilot prefers the upper field, so the demo stays in
    view.
  - On phones only Start sits on the field, and the rules are a caption under the
    controls, which therefore never move when a run starts.
- **Low ink:** below 20, the whole ink ring and a ring round the nib pulse.
- **Reduced motion** (`prefers-reduced-motion`): no shake, no particles, no flying
  diatoms, and fades become instant state changes. The game itself still moves (it is a
  game), but nothing moves that isn't gameplay.

## Sound

- WebAudio synthesis only, with no audio files. **Muted by default.** The toggle is a
  visible button plus M, and the choice is kept for the page visit but not stored.
- The sounds:
  - pen scratch: very quiet band-passed noise while drawing
  - capture chime: pentatonic, rising with n
  - snap: a filtered noise burst
  - low-ink tick
  - game over: a falling tone
- The audio context is created on the first user gesture after unmuting, as browsers
  require.

## Art direction

Related to the site, but distinct: the site is a *printed* atlas plate, and the game is
the *live* view the atlas was drawn from.

- A near-black blue slide (`#04070b` → `#0b1420` vignette) inside a circular field of
  light, with a faint reticle and a scale bar ("100 µm"), in both site themes. The page
  around it follows the theme.
- Diatoms are pale cyan-white line drawings with a soft glow, one drawing per species,
  pre-rendered to sprites at the current canvas size.
- The ink is the site's vermilion (`#ff6a48`, the dark-theme accent), the one link back
  to the plates. Contaminants are amber (`#ffb347`), the only warm colour besides the
  ink, so danger reads at a glance.
- The HUD and screens use the site's type: Imbue for the title, Martian Mono for
  numbers and labels. Buttons are the site's `.btn`.

## Engine and architecture

- **Engine: vanilla Canvas 2D, no game library.** Everything on screen is lines, circles
  and sprites. A library (PixiJS, Phaser) would add 100+ kB and its own loop, scene
  graph and input handling, none of which the game needs. Canvas 2D in Chromium draws
  thousands of line segments per frame well within budget. The site already uses
  Canvas 2D (Chladni, gallery), so the conventions carry over.
- **Pure rules** in `src/lib/game/` (TS, test-first, no DOM):
  - `geometry.ts`: segment intersection, point in polygon, polygon area.
  - `params.ts`: d(t) and the parameter table.
  - `sim.ts`: `createGame(seed)`, `step(state, input)` at a fixed dt of 1/60, and the
    state machine `title → play ⇄ paused → over → play`.
  - Seeded RNG: `src/lib/random.ts`.
- **Shell:** `Darkfield.svelte` (overlay screens, HUD, buttons) plus
  `src/lib/game/render.ts` and `audio.ts`; input handling lives in the island. The render loop accumulates real
  time and runs whole ticks, so frame rate never changes the simulation.
- **Test hook:** with `?test=1` only, the real-time loop is off and the seed is `test`.
  `window.__game` has:
  - `getState()`: a JSON snapshot. It has mode, tick, t, score, best, ink, overReason, d,
    params, pen `{x, y, heading}`, trailLen, trailPoints, counts of diatoms and
    contaminants, `diatomList` `[{x, y, kind}]`, `hazardList` `[{x, y}]`, stats
    `{loops, captured, snaps, rimHits, runs, bestLoop}`, `canvas {width, height}` and
    `muted`.
  - `step(n = 1)`: advances n ticks, renders once, returns the state.
  - `input(action, down = true)`: `left`, `right` (held until `down = false`), and
    `start`, `pause`, `mute` (on press). It returns the state.
  - `aim(x, y)` steers towards a world point; `aim(null)` hands control back to the keys.
  - `seed(s)` makes a new game on the title screen.
  - `cheat({ ink?, hazards?: 'on' | 'frozen' | 'off' })`: harness-only switches for a
    bottomless ink well and for contaminants.
  - Gotchas: `start` resets the cheats, so call `cheat` *after* `input('start')`.
    `input('start')` restarts even mid-run, although the UI only offers it on the title
    and game-over cards. Effects age by wall-clock time, so shot scripts
    (`game-driver.mjs`, `states/darkfield.mjs`) swap in a virtual 60 fps clock. Chromium
    delivers `pointermove` on animation frames, so after a pointer event wait two frames
    before `step()`.
- **DOM contract** (for the harness and the QA states): `.darkfield` is the root, and
  `.stage` (focusable) holds `canvas[data-qa-canvas]`. The cards are
  `[data-screen="title" | "paused" | "over"]`. Buttons: `[data-action="start"]` (Start /
  Play again), `[data-action="pause"]`, `[data-action="resume"]`, and
  `[data-action="sound"]`, whose `aria-pressed` is true when the sound is on. The thumb
  buttons are `[data-touch="left" | "right"]` (press and hold); they show on coarse
  pointers and below 40rem. The score is `[data-score]`.
- **On-screen sizes.** The world is scaled to the canvas, so a phone shows it at about
  half the desktop size. The renderer keeps marks legible with minimum drawn sizes in
  CSS pixels: diatoms at least 7 px in radius, contaminants 6 px, the nib 3.5 px. These
  are drawn sizes only; the rules' hit radii don't change.
- **Harness** (`npm run qa:game`, T12): the checks listed in TESTING.md §Game.

## Vertical slice (T11)

The title screen, play with one diatom species and one contaminant type, loop capture,
ink drain, game over at 0 ink or on contact, and restart. The slice uses the real
simulation, a plain renderer and keyboard and pointer input. It is built at
`/lab/darkfield/` with `noindex` and is not listed in the Lab until T12.

## Scope-cut list (cut from the bottom first)

1. On-screen ◀ ▶ thumb buttons: follow-the-finger alone is enough on touch.
2. The *Asterionella* star species, and its time-out.
3. Contaminant capture for points: make enclosing them simply not count.
4. Flying-to-counter animation for captures: keep the flash and the label.
5. The pen scratch sound: keep the chime, snap and game-over sounds.
6. Scale bar and reticle details.

Never cut: loop capture, the ink economy, the multiplier, contaminants, the rising
difficulty, pause, the personal best, touch play, reduced-motion behaviour, and the
sound toggle being muted by default.
