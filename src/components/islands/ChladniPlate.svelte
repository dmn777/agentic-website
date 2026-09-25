<script lang="ts">
  // Plate VII: Chladni figures. Sand on a vibrating square plate gathers on the nodal lines.
  // Physics in src/lib/chladni/plate.ts (tested); nodal lines for the "theory" overlay come
  // from the gallery's marching squares. Sound (WebAudio) is opt-in and off by default.
  import { onMount } from 'svelte';
  import { rngFrom } from '../../lib/random';
  import { MODES, modeShape, scatter, shake, pitch, type Mode } from '../../lib/chladni/plate';
  import { marchingSquares } from '../../lib/art/geometry';
  import { usable } from '../../lib/measure';
  import { tokenColor, onThemeChange, prefersReducedMotion, currentTheme } from '../../scripts/theme';

  const GRAINS = 12000, TICKS = 380;
  let modeIdx = $state(2);
  let theory = $state(false);
  let toneOn = $state(false);
  let running = $state(false);
  let shaken = $state(false); // false until the first shake (and in the server render)
  let tick = $state(0);
  let seed = 1;
  let canvas: HTMLCanvasElement;
  let wRaw = $state(520);
  const size = $derived(Math.min(560, usable(wRaw - 16, 520)));
  const mode = $derived<Mode>(MODES[modeIdx]);
  const hz = $derived(Math.round(pitch(mode)));

  let grains = scatter(GRAINS, rngFrom(`chladni/${seed}`));
  let rng = rngFrom(`chladni/shake/${seed}`);
  let raf = 0, visible = true, reduced = false;
  // Colours come from the theme tokens on mount; nothing is drawn before that.
  let ink = '', paper = '', accent = '', rule = '';

  // ── Sound: a sine tone at an illustrative pitch, only while the plate is shaking ─────
  let ac: AudioContext | null = null, osc: OscillatorNode | null = null, gain: GainNode | null = null;
  function toneStart() {
    if (!toneOn) return;
    ac ??= new AudioContext();
    if (!osc) {
      osc = ac.createOscillator(); gain = ac.createGain();
      osc.type = 'sine'; gain.gain.value = 0;
      osc.connect(gain).connect(ac.destination); osc.start();
    }
    osc.frequency.setTargetAtTime(hz, ac.currentTime, 0.05);
    gain!.gain.setTargetAtTime(0.06, ac.currentTime, 0.08);
  }
  function toneStop() { if (ac && gain) gain.gain.setTargetAtTime(0, ac.currentTime, 0.12); }

  function draw() {
    if (!canvas || !ink) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2), px = size;
    if (canvas.width !== Math.round(px * dpr)) { canvas.width = Math.round(px * dpr); canvas.height = Math.round(px * dpr); }
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // A dark metal plate with pale sand, as in Chladni's own demonstrations (both themes).
    ctx.fillStyle = ink; ctx.fillRect(0, 0, px, px);
    ctx.fillStyle = paper;
    const s = Math.max(1.2, px / 380);
    for (let i = 0; i < grains.length; i += 2) ctx.fillRect(grains[i] * px - s / 2, grains[i + 1] * px - s / 2, s, s);
    if (theory) {
      const z = modeShape(mode), N = 140;
      const grid = Array.from({ length: N + 1 }, (_, j) => Array.from({ length: N + 1 }, (_, i) => z(i / N, j / N)));
      ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.globalAlpha = 0.85;
      ctx.beginPath();
      for (const [[x1, y1], [x2, y2]] of marchingSquares(grid, 0)) { ctx.moveTo((x1 / N) * px, (y1 / N) * px); ctx.lineTo((x2 / N) * px, (y2 / N) * px); }
      ctx.stroke(); ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = rule; ctx.lineWidth = 1; ctx.strokeRect(0.5, 0.5, px - 1, px - 1);
  }

  function loop() {
    if (!visible || document.hidden) { raf = 0; return; }
    const z = modeShape(mode);
    for (let k = 0; k < 4 && tick < TICKS; k++, tick++) shake(grains, z, rng);
    draw();
    if (tick < TICKS) raf = requestAnimationFrame(loop);
    else { running = false; raf = 0; toneStop(); }
  }
  function start() {
    cancelAnimationFrame(raf);
    tick = 0; running = true; shaken = true; toneStart();
    if (reduced) { const z = modeShape(mode); for (; tick < TICKS; tick++) shake(grains, z, rng); running = false; draw(); toneStop(); return; }
    raf = requestAnimationFrame(loop);
  }
  function shakeFresh() {
    seed += 1;
    grains = scatter(GRAINS, rngFrom(`chladni/${seed}`));
    rng = rngFrom(`chladni/shake/${seed}`);
    start();
  }
  function pickMode(i: number) { modeIdx = i; start(); }
  function toggleTone() {
    toneOn = !toneOn;
    if (toneOn && running) toneStart(); else toneStop();
  }

  $effect(() => { void theory; void size; draw(); });

  onMount(() => {
    reduced = prefersReducedMotion();
    // The plate is dark and the sand pale in BOTH themes: pick the dark and light tokens by theme.
    const read = () => {
      const dark = currentTheme() === 'dark';
      ink = tokenColor(dark ? '--paper-sunk' : '--ink');      // the plate
      paper = tokenColor(dark ? '--ink' : '--paper-raised');  // the sand
      accent = tokenColor('--accent'); rule = tokenColor('--rule-strong'); draw();
    };
    read();
    const off = onThemeChange(read);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && running && !raf) raf = requestAnimationFrame(loop); }, { threshold: 0.05 });
    io.observe(canvas);
    start();
    const onVis = () => { if (!document.hidden && running && !raf) raf = requestAnimationFrame(loop); };
    document.addEventListener('visibilitychange', onVis);
    // Cleanup lives here, not in onDestroy: Svelte also runs onDestroy during server
    // rendering, where requestAnimationFrame and AudioContext don't exist.
    return () => { off(); io.disconnect(); document.removeEventListener('visibilitychange', onVis); cancelAnimationFrame(raf); osc?.stop(); ac?.close(); };
  });

  const settledShare = $derived.by(() => {
    void tick;
    const z = modeShape(mode);
    let k = 0;
    for (let i = 0; i < grains.length; i += 2) if (Math.abs(z(grains[i], grains[i + 1])) < 0.12) k++;
    return k / (grains.length / 2);
  });
</script>

<div class="chladni">
  <div class="controls">
    <fieldset class="seg controls__wide">
      <legend class="label">Mode (n · m)</legend>
      <div class="seg__row">
        {#each MODES as m, i}
          <label class="seg__opt"><input type="radio" name="mode" checked={modeIdx === i} onchange={() => pickMode(i)} />{m.n} · {m.m}</label>
        {/each}
      </div>
    </fieldset>
    <div class="btn-row">
      <button type="button" class="btn btn--primary btn--sm" onclick={shakeFresh}>Shake the plate</button>
      <button type="button" class="btn btn--secondary btn--sm" onclick={toggleTone} aria-pressed={toneOn}>{toneOn ? 'Tone: on' : 'Tone: off'}</button>
      <label class="check"><input type="checkbox" bind:checked={theory} /> Show the theory</label>
    </div>
  </div>

  <figure class="fig plate-fig">
    <div class="fig__plot" bind:clientWidth={wRaw} data-qa-canvas>
      <div role="img" aria-label={`A square plate covered in sand, vibrating in mode ${mode.n}·${mode.m}. The sand gathers on the lines where the plate does not move.`}>
        <canvas bind:this={canvas} style={`width:${size}px;height:${size}px`} aria-hidden="true"></canvas>
      </div>
    </div>
    <figcaption class="fig__cap"><span class="fig__label">Fig. 1 · Sand on a square plate, mode {mode.n} · {mode.m}</span> <span class="fig__note">Pale grains: sand on a dark plate. {theory ? 'Vermilion: the nodal lines the formula predicts.' : 'Turn on the theory to see the predicted nodal lines.'} Where two nodal lines cross, the sand spreads into a wider patch: almost nothing moves there.</span></figcaption>
  </figure>

  <dl class="readout" aria-live="polite">
    <div><dt>Mode</dt><dd>n = {mode.n}, m = {mode.m}</dd></div>
    <div><dt>Tone (illustrative)</dt><dd>{hz} Hz <span class="muted">{toneOn ? 'sounding while it shakes' : 'muted'}</span></dd></div>
    <div><dt>Sand on a nodal line</dt><dd>{shaken ? `${Math.round(settledShare * 100)}%` : '—'} <span class="muted">{!shaken ? 'not yet shaken' : running ? 'plate ringing' : 'plate at rest'}</span></dd></div>
  </dl>
</div>

<style>
  .chladni { display: grid; gap: var(--space-m); }
  .check { display: inline-flex; align-items: center; gap: 0.5rem; font-size: var(--step--1); cursor: pointer; min-height: 2.75rem; margin-left: var(--space-2xs); }
  .plate-fig { justify-self: start; max-width: calc(560px + 18px); width: 100%; }
  canvas { display: block; }
</style>
