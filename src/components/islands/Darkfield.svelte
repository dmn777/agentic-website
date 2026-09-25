<script lang="ts">
  // Plate VIII: Darkfield, the Lab's game (docs/GAME_DESIGN.md). Rules live in
  // src/lib/game/sim.ts (pure, seeded, tested); this island owns the clock, the input, the
  // sound and the screens. With ?test=1 the real-time loop is off and window.__game drives
  // it (contract: GAME_DESIGN.md §Test hook; harness: scripts/qa/game.mjs).
  import { onMount } from 'svelte';
  import { createGame, start, step, togglePause, snapshot, DT, type Game, type Input } from '../../lib/game/sim';
  import { createRenderer, type Renderer } from '../../lib/game/render';
  import { createSound, type Sound } from '../../lib/game/audio';
  import { usable } from '../../lib/measure';
  import { prefersReducedMotion } from '../../scripts/theme';

  const BEST_KEY = 'darkfield.best';
  const SLIDE = 1000;
  let wRaw = $state(640);
  const size = $derived(Math.min(680, usable(wRaw, 640, 240)));

  let canvas: HTMLCanvasElement;
  let root: HTMLDivElement;
  let game: Game | null = null;
  // The title screen's attract mode: a field of its own, drifting behind the card, with the
  // pen hidden. It never touches the real game, and it stands still under reduced motion.
  let demo: Game | null = null;
  let renderer: Renderer | null = null;
  let sound: Sound | null = null;
  let mode = $state<'title' | 'play' | 'paused' | 'over'>('title');
  let score = $state(0);
  let best = $state(0);
  let ink = $state(100);
  let overReason = $state<'ink' | 'contact' | null>(null);
  let newBest = $state(false);
  let muted = $state(true);
  let summary = $state({ loops: 0, captured: 0, bestLoop: { points: 0, n: 0 }, t: 0 });
  let testMode = false;

  // Input: keys (or the thumb buttons), or a pointer aim. The last method used wins.
  const keys = { left: false, right: false };
  let aim: { x: number; y: number } | null = null;
  const currentInput = (): Input => ({ left: keys.left, right: keys.right, aim });

  function readBest(): number {
    try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; }
  }
  function saveBest(v: number) {
    try { localStorage.setItem(BEST_KEY, String(v)); } catch { /* storage blocked: keep it for this visit */ }
  }

  function sync() {
    if (!game) return;
    mode = game.mode; score = game.score; ink = game.ink; overReason = game.overReason; best = game.best;
    if (game.mode === 'over') summary = { loops: game.stats.loops, captured: game.stats.captured, bestLoop: { ...game.stats.bestLoop }, t: game.t };
    sound?.scratch(game.mode === 'play');
  }

  function tick(now: number) {
    if (!game || !renderer) return;
    const before = game.score;
    step(game, currentInput());
    if (Math.floor(game.score / SLIDE) > Math.floor(before / SLIDE)) renderer.milestone(Math.floor(game.score / SLIDE) + 1, now);
    if (game.mode === 'play' && game.ink < 20 && game.tick % 40 === 0) sound?.tick();
    if (!game.events.length) return;
    renderer.events(game.events, now);
    for (const e of game.events) {
      if (e.type === 'loop' && e.caught.length) sound?.chime(e.caught.length);
      else if (e.type === 'snap') sound?.snap();
      else if (e.type === 'over') { newBest = e.best; if (e.best) saveBest(game.best); sound?.over(); }
    }
  }

  function begin() {
    if (!game) return;
    newBest = false;
    start(game);
    renderer?.reset();
    sync();
    root?.focus({ preventScroll: true });
  }
  // Keys are heard on the whole island, but a card button that unmounts drops focus to
  // <body>. So whatever leaves a run in play hands focus back to the field.
  const refocus = () => { if (game?.mode === 'play') root?.focus({ preventScroll: true }); };
  function pause() { if (game) { togglePause(game); sync(); refocus(); } }
  function toggleSound() { muted = !muted; sound?.setMuted(muted); refocus(); }

  function onKey(e: KeyboardEvent, down: boolean) {
    if (!game) return;
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') { keys.left = down; aim = null; if (game.mode === 'play') e.preventDefault(); }
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') { keys.right = down; aim = null; if (game.mode === 'play') e.preventDefault(); }
    else if (!down) return;
    else if ((k === ' ' || k === 'Enter') && (game.mode === 'title' || game.mode === 'over') && e.target === root) { e.preventDefault(); begin(); }
    else if ((k === 'p' || k === 'P' || k === 'Escape') && (game.mode === 'play' || game.mode === 'paused')) { e.preventDefault(); pause(); }
    else if (k === 'm' || k === 'M') toggleSound();
    else if (k === ' ' && game.mode === 'play') e.preventDefault();
  }

  function pointerAim(e: PointerEvent) {
    if (!renderer || (e.pointerType !== 'mouse' && e.buttons === 0)) return;
    const rect = canvas.getBoundingClientRect();
    aim = renderer.toWorld(e.clientX - rect.left, e.clientY - rect.top);
  }
  function pointerEnd(e: PointerEvent) { if (e.pointerType !== 'mouse' || e.type === 'pointerleave') aim = null; }

  // Thumb buttons: press and hold to turn, like the keys.
  function thumb(dir: 'left' | 'right', down: boolean, e?: PointerEvent) {
    keys[dir] = down; aim = null;
    if (down && e) (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }

  onMount(() => {
    testMode = new URLSearchParams(location.search).get('test') === '1';
    renderer = createRenderer(canvas, { reducedMotion: () => prefersReducedMotion() });
    renderer.resize(size, Math.min(2, window.devicePixelRatio || 1));
    sound = createSound();
    game = createGame(testMode ? 'test' : String(Date.now()), { best: readBest() });
    demo = createGame('attract');
    start(demo);
    Object.assign(demo, { ink: Infinity, noHazards: true });
    sync();
    const paint = (now: number) => {
      if (game!.mode === 'title') renderer!.draw(demo!, now, { hidePen: true });
      else renderer!.draw(game!, now);
    };

    let raf = 0, last = performance.now(), acc = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      acc = Math.min(acc + (now - last) / 1000, 0.25); // never spiral after a stall
      last = now;
      while (acc >= DT) {
        if (game!.mode === 'title' && !prefersReducedMotion()) step(demo!, { left: false, right: false, aim: null });
        tick(now);
        acc -= DT;
      }
      paint(now);
      if (game!.mode !== mode || game!.score !== score || Math.abs(game!.ink - ink) > 0.5) sync();
    };

    if (testMode) {
      const w = window as unknown as { __game: unknown };
      const state = () => ({ ...snapshot(game!), canvas: { width: canvas.width, height: canvas.height }, muted });
      w.__game = {
        getState: state,
        step: (n = 1) => { for (let i = 0; i < n; i++) tick(performance.now()); paint(performance.now()); sync(); return state(); },
        input: (action: string, down = true) => {
          if (action === 'left' || action === 'right') { keys[action] = down; aim = null; }
          else if (down && action === 'start') begin();
          else if (down && action === 'pause') pause();
          else if (down && action === 'mute') toggleSound();
          paint(performance.now());
          return state();
        },
        aim: (x: number | null, y?: number) => { aim = x === null ? null : { x, y: y ?? 0 }; },
        seed: (s: string) => { game = createGame(String(s), { best: game?.best ?? 0 }); renderer!.reset(); sync(); paint(performance.now()); return state(); },
        // Test switches for the harness: a bottomless ink well, and contaminants on, frozen or off.
        cheat: (o: { ink?: number; hazards?: 'on' | 'frozen' | 'off' } = {}) => {
          if (o.ink !== undefined) game!.ink = o.ink;
          if (o.hazards) { game!.frozenHazards = o.hazards === 'frozen'; game!.noHazards = o.hazards === 'off'; if (o.hazards === 'off') game!.hazards = []; }
          return state();
        },
      };
      paint(performance.now());
    } else {
      raf = requestAnimationFrame(frame);
    }

    const hide = () => { if (game?.mode === 'play') pause(); };
    const onVis = () => { if (document.hidden) hide(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', hide);
    return () => {
      cancelAnimationFrame(raf);
      sound?.dispose();
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', hide);
    };
  });

  $effect(() => {
    const s = size;
    if (renderer && game && demo) {
      renderer.resize(s, Math.min(2, window.devicePixelRatio || 1));
      if (game.mode === 'title') renderer.draw(demo, performance.now(), { hidePen: true });
      else renderer.draw(game, performance.now());
    }
  });

  const inkLow = $derived(mode === 'play' && ink < 20);
  const slide = $derived(Math.floor(score / SLIDE) + 1);
  const minutes = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
</script>

<!-- Keys bubble here from the field and from every button in the island (the harness
     caught steering dying after a click on Pause or Sound). -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="darkfield" bind:clientWidth={wRaw} onkeydown={(e) => onKey(e, true)} onkeyup={(e) => onKey(e, false)}>
  <div class="hud">
    <dl class="hud__stats">
      <div><dt>Score</dt><dd data-score>{score}</dd></div>
      <div class="hud__slide"><dt>Slide</dt><dd>{slide}</dd></div>
      <div><dt>Best</dt><dd>{best}</dd></div>
      <div class="hud__ink" class:low={inkLow}>
        <dt>Ink</dt>
        <dd><span class="gauge" role="meter" aria-label="Ink" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(Math.min(100, ink))}><span style:width="{Math.max(0, Math.min(100, ink))}%"></span></span></dd>
      </div>
    </dl>
    <div class="hud__buttons">
      <button class="btn btn--secondary btn--sm" type="button" data-action="sound" aria-pressed={!muted} onclick={toggleSound} title="Sound (M)">
        Sound: {muted ? 'off' : 'on'}
      </button>
      <button class="btn btn--secondary btn--sm" type="button" data-action="pause" onclick={pause} disabled={mode !== 'play' && mode !== 'paused'} title="Pause (P)">{mode === 'paused' ? 'Resume' : 'Pause'}</button>
    </div>
  </div>

  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div
    class="stage"
    style:width="{size}px"
    style:height="{size}px"
    tabindex="0"
    role="application"
    aria-label="Darkfield game. Arrow keys or A and D steer; P pauses; M turns the sound on or off."
    bind:this={root}
  >
    <canvas
      bind:this={canvas}
      data-qa-canvas
      onpointermove={pointerAim}
      onpointerdown={(e) => { pointerAim(e); if (e.pointerType !== 'mouse') canvas.setPointerCapture(e.pointerId); }}
      onpointerup={pointerEnd}
      onpointercancel={pointerEnd}
      onpointerleave={pointerEnd}
    ></canvas>

    {#if mode !== 'title' && mode !== 'play'}<div class="scrim" aria-hidden="true"></div>{/if}
    {#if mode === 'title'}
      <div class="card card--title" data-screen="title">
        <ol class="card__rules card__rules--full">
          <li>Your pen never stops. Steer it with <kbd aria-label="left arrow">◀</kbd> <kbd aria-label="right arrow">▶</kbd>, or point where it should go.</li>
          <li>Close your line into a loop around diatoms to catch them. Catch several at once and they multiply.</li>
          <li>Catching refills your ink. Keep your pen and your line clear of the amber contaminants.</li>
        </ol>
        <p class="card__rules--short">Loop your ink around diatoms to catch them, and keep clear of the amber ones. Hold a finger where the pen should go, or use ◀ ▶.</p>
        <button class="btn btn--primary" type="button" data-action="start" onclick={begin}>Start</button>
      </div>
    {:else if mode === 'paused'}
      <div class="card card--small" data-screen="paused">
        <h2 class="card__title">Paused</h2>
        <button class="btn btn--primary" type="button" data-action="resume" onclick={pause}>Resume</button>
      </div>
    {:else if mode === 'over'}
      <div class="card" data-screen="over" aria-live="polite">
        <p class="label card__kicker">{overReason === 'ink' ? 'Out of ink' : 'Contaminated'}</p>
        <h2 class="card__title card__score">{score}<span class="label card__unit">points</span></h2>
        <p class="card__best">{newBest ? 'A new personal best.' : `Your best: ${best}.`}</p>
        <dl class="card__stats">
          <div><dt>Time</dt><dd>{minutes(summary.t)}</dd></div>
          <div><dt>Caught</dt><dd>{summary.captured}</dd></div>
          <div><dt>Best loop</dt><dd>{summary.bestLoop.points ? `${summary.bestLoop.points} (×${summary.bestLoop.n})` : '–'}</dd></div>
        </dl>
        <button class="btn btn--primary" type="button" data-action="start" onclick={begin}>Play again</button>
      </div>
    {/if}
  </div>

  <div class="thumbs" aria-label="Steering buttons">
    <button class="thumb" type="button" data-touch="left" aria-label="Steer left"
      onpointerdown={(e) => thumb('left', true, e)} onpointerup={() => thumb('left', false)}
      onpointercancel={() => thumb('left', false)} onlostpointercapture={() => thumb('left', false)}
      oncontextmenu={(e) => e.preventDefault()}>◀</button>
    <button class="thumb" type="button" data-touch="right" aria-label="Steer right"
      onpointerdown={(e) => thumb('right', true, e)} onpointerup={() => thumb('right', false)}
      onpointercancel={() => thumb('right', false)} onlostpointercapture={() => thumb('right', false)}
      oncontextmenu={(e) => e.preventDefault()}>▶</button>
  </div>
</div>

<style>
  .darkfield { display: grid; justify-items: center; gap: var(--space-2xs); width: 100%; }
  .hud {
    display: flex; align-items: end; justify-content: space-between; gap: var(--space-s);
    width: 100%; max-width: 680px; flex-wrap: wrap;
  }
  .hud__stats { display: flex; gap: var(--space-m); margin: 0; font-family: var(--font-mono); }
  .hud__stats dt, .card__stats dt { font-size: var(--step--2); letter-spacing: var(--tracking-caps); text-transform: uppercase; color: var(--ink-3); }
  .hud__stats dd { margin: 0; font-size: var(--step-0); font-variant-numeric: tabular-nums; min-width: 3ch; }
  .hud__buttons { display: flex; gap: var(--space-2xs); }
  .hud__buttons .btn { white-space: nowrap; }
  .gauge { display: block; width: 7rem; height: 0.6rem; margin-top: 0.35rem; border: var(--hair) solid var(--rule-strong); background: var(--paper-sunk); }
  .gauge span { display: block; height: 100%; background: var(--accent); }
  .hud__ink.low dt { color: var(--accent-ink); }
  .hud__ink.low .gauge { border-color: var(--accent-ink); }
  @media (prefers-reduced-motion: no-preference) {
    .hud__ink.low .gauge { animation: low 0.6s ease-in-out infinite alternate; }
  }
  @keyframes low { to { opacity: 0.35; } }
  .stage { position: relative; outline-offset: 4px; border-radius: 50%; touch-action: none; }
  .stage:focus-visible { outline: 2px solid var(--focus); }
  canvas { display: block; border-radius: 50%; touch-action: none; cursor: crosshair; }
  .scrim { position: absolute; inset: 0; border-radius: 50%; background: rgba(4, 7, 11, 0.45); pointer-events: none; }
  .card {
    position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
    width: min(78%, 26rem); padding: var(--space-m);
    background: var(--paper-raised); color: var(--ink);
    border: var(--hair) solid var(--rule-strong);
    display: grid; gap: var(--space-2xs); justify-items: start;
  }
  .card--small { width: auto; min-width: 12rem; }
  .card__kicker { color: var(--accent-ink); margin: 0; }
  .card__title { font-family: var(--font-display); font-size: var(--step-3); line-height: 1; margin: 0 0 var(--space-3xs); }
  .card__score { font-size: var(--step-4); display: grid; gap: 0.2em; }
  .card__unit { color: var(--ink-3); }
  .card__rules--short { display: none; margin: 0 0 var(--space-xs); }
  .card__rules { margin: 0 0 var(--space-xs); padding-left: 1.2em; font-size: var(--step--1); display: grid; gap: 0.35em; }
  .card__best { margin: 0; font-size: var(--step--1); color: var(--ink-2); }
  .card__stats { display: flex; gap: var(--space-s); margin: 0 0 var(--space-xs); font-family: var(--font-mono); flex-wrap: wrap; }
  .card__stats dd { margin: 0; font-size: var(--step--1); font-variant-numeric: tabular-nums; }
  kbd { font-family: var(--font-text); font-size: 0.85em; line-height: 1; border: var(--hair) solid var(--rule-strong); border-bottom-width: 2px; padding: 0.1em 0.35em; }
  .thumbs { display: none; width: 100%; max-width: 680px; justify-content: space-between; gap: var(--space-s); }
  .thumb {
    width: 4.5rem; height: 3.25rem; font-size: 1.25rem; line-height: 1;
    background: var(--paper-raised); color: var(--ink); border: var(--hair) solid var(--rule-strong);
    border-bottom: 3px solid var(--accent); touch-action: none; user-select: none; -webkit-user-select: none;
  }
  .thumb:active { background: var(--paper-sunk); }
  .thumb:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
  /* Touch and narrow screens: the thumb buttons sit under the field, with Sound and Pause
     between them, so the HUD above stays on one line. */
  @media (pointer: coarse), (max-width: 40rem) {
    .darkfield {
      grid-template-columns: auto minmax(0, 1fr) auto;
      grid-template-areas: "stats stats stats" "stage stage stage" "left mid right";
      row-gap: var(--space-2xs);
    }
    .hud, .thumbs { display: contents; }
    .hud__stats { grid-area: stats; justify-self: start; }
    .stage { grid-area: stage; }
    .hud__buttons { grid-area: mid; justify-self: center; align-self: center; }
    [data-touch="left"] { grid-area: left; }
    [data-touch="right"] { grid-area: right; }
  }
  /* Phones: the cards must fit inside the disc, so the title card trades its list for two
     sentences (the full rules are in §2 just below), and body text stays at 16 px. */
  @media (max-width: 40rem) {
    .card { padding: var(--space-s); gap: var(--space-3xs); }
    .card__rules--full { display: none; }
    .card__rules--short { display: block; font-size: var(--step-0); line-height: 1.35; }
    .card__best { font-size: var(--step-0); }
    .card__score { font-size: var(--step-3); display: flex; align-items: baseline; gap: 0.5rem; }
    .card__stats { gap: var(--space-2xs) var(--space-s); margin-bottom: var(--space-3xs); }
  }
  @media (max-width: 30rem) {
    .hud__stats { gap: var(--space-s); }
    .hud__slide { display: none; }
    .gauge { width: 4.5rem; }
  }
</style>
