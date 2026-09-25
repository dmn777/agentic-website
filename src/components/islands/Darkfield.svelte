<script lang="ts">
  // Plate VIII: Darkfield, the Lab's game (docs/GAME_DESIGN.md). Rules live in
  // src/lib/game/sim.ts (pure, seeded, tested); this island owns the clock, the input and
  // the screens. With ?test=1 the real-time loop is off and window.__game drives it.
  import { onMount } from 'svelte';
  import { createGame, start, step, togglePause, snapshot, DT, type Game, type Input } from '../../lib/game/sim';
  import { createRenderer, type Renderer } from '../../lib/game/render';
  import { usable } from '../../lib/measure';
  import { prefersReducedMotion } from '../../scripts/theme';

  const BEST_KEY = 'darkfield.best';
  let wRaw = $state(640);
  const size = $derived(Math.min(680, usable(wRaw, 640, 240)));

  let canvas: HTMLCanvasElement;
  let root: HTMLDivElement;
  let game: Game | null = null;
  let renderer: Renderer | null = null;
  let mode = $state<'title' | 'play' | 'paused' | 'over'>('title');
  let score = $state(0);
  let best = $state(0);
  let ink = $state(100);
  let overReason = $state<'ink' | 'contact' | null>(null);
  let newBest = $state(false);
  let testMode = false;

  // Input: keys, or a pointer aim. The last method used wins.
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
  }

  function tick(now: number) {
    if (!game || !renderer) return;
    step(game, currentInput());
    if (game.events.length) {
      renderer.events(game.events, now);
      for (const e of game.events) if (e.type === 'over') { newBest = e.best; if (e.best) saveBest(game.best); }
    }
  }

  function begin() {
    if (!game) return;
    newBest = false;
    start(game);
    sync();
    root?.focus({ preventScroll: true });
  }
  function pause() { if (game) { togglePause(game); sync(); } }

  function onKey(e: KeyboardEvent, down: boolean) {
    if (!game) return;
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') { keys.left = down; aim = null; if (game.mode === 'play') e.preventDefault(); }
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') { keys.right = down; aim = null; if (game.mode === 'play') e.preventDefault(); }
    else if (!down) return;
    else if ((k === ' ' || k === 'Enter') && (game.mode === 'title' || game.mode === 'over')) { e.preventDefault(); begin(); }
    else if ((k === 'p' || k === 'P' || k === 'Escape') && (game.mode === 'play' || game.mode === 'paused')) { e.preventDefault(); pause(); }
    else if (k === ' ' && game.mode === 'play') e.preventDefault();
  }

  function pointerAim(e: PointerEvent) {
    if (!renderer || (e.pointerType !== 'mouse' && e.buttons === 0)) return;
    const rect = canvas.getBoundingClientRect();
    aim = renderer.toWorld(e.clientX - rect.left, e.clientY - rect.top);
  }
  function pointerEnd(e: PointerEvent) { if (e.pointerType !== 'mouse' || e.type === 'pointerleave') aim = null; }

  onMount(() => {
    testMode = new URLSearchParams(location.search).get('test') === '1';
    const reduced = () => prefersReducedMotion();
    renderer = createRenderer(canvas, { reducedMotion: reduced });
    renderer.resize(size, Math.min(2, window.devicePixelRatio || 1));
    game = createGame(testMode ? 'test' : String(Date.now()), { best: readBest() });
    sync();

    let raf = 0, last = performance.now(), acc = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      acc = Math.min(acc + (now - last) / 1000, 0.25); // never spiral after a stall
      last = now;
      while (acc >= DT) { tick(now); acc -= DT; }
      renderer!.draw(game!, now);
      if (game!.mode !== mode || game!.score !== score || Math.abs(game!.ink - ink) > 0.5) sync();
    };

    if (testMode) {
      const w = window as unknown as { __game: unknown };
      w.__game = {
        getState: () => ({ ...snapshot(game!), canvas: { width: canvas.width, height: canvas.height } }),
        step: (n = 1) => { for (let i = 0; i < n; i++) tick(performance.now()); renderer!.draw(game!, performance.now()); sync(); return snapshot(game!); },
        input: (action: string, down = true) => {
          if (action === 'left' || action === 'right') { keys[action] = down; aim = null; }
          else if (down && action === 'start') begin();
          else if (down && action === 'pause') pause();
          renderer!.draw(game!, performance.now());
          return snapshot(game!);
        },
        aim: (x: number | null, y?: number) => { aim = x === null ? null : { x, y: y ?? 0 }; },
        seed: (s: string) => { game = createGame(String(s), { best: game?.best ?? 0 }); sync(); renderer!.draw(game, performance.now()); return snapshot(game); },
      };
      renderer.draw(game, performance.now());
    } else {
      raf = requestAnimationFrame(frame);
    }

    const hide = () => { if (game?.mode === 'play') pause(); };
    const onVis = () => { if (document.hidden) hide(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', hide);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', hide);
    };
  });

  $effect(() => {
    const s = size;
    if (renderer && game) { renderer.resize(s, Math.min(2, window.devicePixelRatio || 1)); renderer.draw(game, performance.now()); }
  });

  const inkLow = $derived(ink < 20);
</script>

<div class="darkfield" bind:clientWidth={wRaw}>
  <div class="hud" aria-live="off">
    <dl class="hud__stats">
      <div><dt>Score</dt><dd data-score>{score}</dd></div>
      <div><dt>Best</dt><dd>{best}</dd></div>
      <div class="hud__ink" class:low={inkLow}>
        <dt>Ink</dt>
        <dd><span class="gauge" role="meter" aria-label="Ink" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(ink)}><span style:width="{Math.max(0, ink)}%"></span></span></dd>
      </div>
    </dl>
    <button class="btn btn--secondary btn--sm" type="button" onclick={pause} disabled={mode !== 'play' && mode !== 'paused'}>{mode === 'paused' ? 'Resume' : 'Pause'}</button>
  </div>

  <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
  <div
    class="stage"
    style:width="{size}px"
    style:height="{size}px"
    tabindex="0"
    role="application"
    aria-label="Darkfield game. Arrow keys or A and D steer; P pauses."
    bind:this={root}
    onkeydown={(e) => onKey(e, true)}
    onkeyup={(e) => onKey(e, false)}
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

    {#if mode === 'title'}
      <div class="card" data-screen="title">
        <p class="label card__kicker">Pl. VIII · A game</p>
        <h2 class="card__title">Darkfield</h2>
        <ol class="card__rules">
          <li>Your pen never stops. Steer it with <kbd>←</kbd> <kbd>→</kbd>, or point where it should go.</li>
          <li>Close your line into a loop around diatoms to catch them. Catch several at once and they multiply.</li>
          <li>Catching refills your ink. Keep your pen and your line clear of the amber contaminants.</li>
        </ol>
        <button class="btn btn--primary" type="button" onclick={begin}>Start</button>
      </div>
    {:else if mode === 'paused'}
      <div class="card" data-screen="paused">
        <h2 class="card__title">Paused</h2>
        <button class="btn btn--primary" type="button" onclick={pause}>Resume</button>
      </div>
    {:else if mode === 'over'}
      <div class="card" data-screen="over" aria-live="polite">
        <p class="label card__kicker">{overReason === 'ink' ? 'Out of ink' : 'Contaminated'}</p>
        <h2 class="card__title">{score} <span class="card__unit">points</span></h2>
        <p class="card__best">{newBest ? 'A new personal best.' : `Your best: ${best}.`}</p>
        <button class="btn btn--primary" type="button" onclick={begin}>Play again</button>
      </div>
    {/if}
  </div>
</div>

<style>
  .darkfield { display: grid; justify-items: center; gap: var(--space-2xs); width: 100%; }
  .hud {
    display: flex; align-items: end; justify-content: space-between; gap: var(--space-s);
    width: 100%; max-width: 680px;
  }
  .hud__stats { display: flex; gap: var(--space-m); margin: 0; font-family: var(--font-mono); }
  .hud__stats dt { font-size: var(--step--2); letter-spacing: var(--tracking-caps); text-transform: uppercase; color: var(--ink-3); }
  .hud__stats dd { margin: 0; font-size: var(--step-0); font-variant-numeric: tabular-nums; min-width: 3ch; }
  .gauge { display: block; width: 7rem; height: 0.6rem; margin-top: 0.35rem; border: var(--hair) solid var(--rule-strong); background: var(--paper-sunk); }
  .gauge span { display: block; height: 100%; background: var(--accent); }
  .hud__ink.low .gauge span { background: var(--accent-ink); }
  .stage { position: relative; outline-offset: 4px; border-radius: 50%; touch-action: none; }
  .stage:focus-visible { outline: 2px solid var(--focus); }
  canvas { display: block; border-radius: 50%; touch-action: none; cursor: crosshair; }
  .card {
    position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
    width: min(88%, 26rem); padding: var(--space-m);
    background: var(--paper-raised); color: var(--ink);
    border: var(--hair) solid var(--rule-strong);
    display: grid; gap: var(--space-2xs); justify-items: start;
  }
  .card__kicker { color: var(--accent-ink); margin: 0; }
  .card__title { font-family: var(--font-display); font-size: var(--step-3); line-height: 1; margin: 0 0 var(--space-3xs); }
  .card__unit { font-size: var(--step-0); font-family: var(--font-mono); color: var(--ink-3); }
  .card__rules { margin: 0 0 var(--space-xs); padding-left: 1.2em; font-size: var(--step--1); display: grid; gap: 0.35em; }
  .card__best { margin: 0 0 var(--space-xs); font-size: var(--step--1); color: var(--ink-2); }
  kbd { font-family: var(--font-mono); font-size: 0.8em; border: var(--hair) solid var(--rule-strong); padding: 0 0.3em; }
  @media (max-width: 30rem) {
    .card { padding: var(--space-s); }
    .card__rules { font-size: var(--step--2); }
    .hud__stats { gap: var(--space-s); }
    .gauge { width: 4.5rem; }
  }
</style>
