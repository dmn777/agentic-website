<script lang="ts">
  import { usable } from '../../lib/measure';
  // Plate I: the sampling distribution of the mean (central limit theorem).
  // All maths lives in src/lib/stats (tested); this file is only state and drawing.
  import { onDestroy } from 'svelte';
  import { rngFrom } from '../../lib/random';
  import { POPULATIONS, getPopulation, type Population } from '../../lib/stats/populations';
  import { drawSample, standardError } from '../../lib/stats/clt';
  import { mean, sd, histogram, normalPdf } from '../../lib/stats/describe';
  import { linearScale, niceTicks } from '../../lib/scale';

  const rng = rngFrom('plate-1/sampling');
  let popId = $state<Population['id']>('skewed');
  let n = $state(10);
  let means = $state<number[]>([]);
  let last = $state<number[]>([]);
  let running = $state(false);
  let wRaw = $state(720);
  const w = $derived(usable(wRaw, 720)); // see lib/measure.ts
  let timer: ReturnType<typeof setInterval> | undefined;

  const pop = $derived(getPopulation(popId));
  const view = $derived<[number, number]>(popId === 'skewed' ? [0, 12] : pop.domain);
  const se = $derived(standardError(pop.sd, n));
  const BINS = 48;
  const hist = $derived(histogram(means, view[0], view[1], BINS));
  const binW = $derived((view[1] - view[0]) / BINS);

  function draw(k: number) {
    const add: number[] = [];
    let s: number[] = last;
    for (let i = 0; i < k; i++) { s = drawSample(pop, n, rng); add.push(mean(s)); }
    last = s;
    means = means.length + add.length > 20000 ? [...means.slice(add.length), ...add] : [...means, ...add];
  }
  function clear() { stop(); means = []; last = []; }
  function stop() { running = false; clearInterval(timer); }
  function toggleRun() {
    if (running) return stop();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { draw(1000); return; }
    running = true;
    timer = setInterval(() => { draw(8); if (means.length >= 5000) stop(); }, 60);
  }
  onDestroy(stop);

  // Start with something on the chart (deterministic, so screenshots are stable).
  draw(300);

  function reset() { clear(); draw(300); }

  // Geometry
  const pad = { l: 44, r: 16, t: 14, b: 34 };
  const hA = 150, hB = 230;
  const x = $derived(linearScale(view, [pad.l, Math.max(pad.l + 100, w - pad.r)]));
  const xt = $derived(niceTicks(view[0], view[1], w < 480 ? 4 : 6));
  const pdfMax = $derived(Math.max(...Array.from({ length: 200 }, (_, i) => pop.pdf(view[0] + ((i + 0.5) / 200) * (view[1] - view[0])))));
  const yA = $derived(linearScale([0, pdfMax * 1.08], [hA - pad.b, pad.t]));
  const curveA = $derived(
    Array.from({ length: 201 }, (_, i) => {
      const v = view[0] + (i / 200) * (view[1] - view[0]);
      return `${i ? 'L' : 'M'}${x(v).toFixed(1)} ${yA(pop.pdf(v)).toFixed(1)}`;
    }).join(' '),
  );
  const areaA = $derived(`${curveA} L${x(view[1]).toFixed(1)} ${yA(0)} L${x(view[0]).toFixed(1)} ${yA(0)} Z`);
  const lastMean = $derived(last.length ? mean(last) : NaN);

  const predictedPeak = $derived(means.length * binW * normalPdf(pop.mean, pop.mean, se));
  const countMax = $derived(Math.max(1, ...hist.counts, predictedPeak));
  const yB = $derived(linearScale([0, countMax * 1.1], [hB - pad.b, pad.t]));
  const yBt = $derived(niceTicks(0, countMax * 1.1, 4).filter((t) => Number.isInteger(t)));
  const normalCurve = $derived(
    means.length
      ? Array.from({ length: 241 }, (_, i) => {
          const v = view[0] + (i / 240) * (view[1] - view[0]);
          return `${i ? 'L' : 'M'}${x(v).toFixed(1)} ${yB(means.length * binW * normalPdf(v, pop.mean, se)).toFixed(1)}`;
        }).join(' ')
      : '',
  );
  const fmt = (v: number, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : '–');
  const spread = $derived(means.length > 1 ? sd(means) : NaN);
</script>

<div class="explorable" bind:clientWidth={wRaw}>
  <div class="controls" role="group" aria-label="Sampling controls">
    <fieldset class="control seg">
      <legend class="label">Population</legend>
      <div class="seg__row">
        {#each POPULATIONS as p}
          <label class="seg__opt" class:is-on={popId === p.id}>
            <input type="radio" name="population" value={p.id} checked={popId === p.id} onchange={() => { popId = p.id; reset(); }} />
            {p.label}
          </label>
        {/each}
      </div>
    </fieldset>
    <label class="control">
      <span class="control__head"><span class="label">Sample size n</span><span class="control__value">{n}</span></span>
      <input type="range" min="1" max="100" step="1" bind:value={n} oninput={reset} style={`--fill:${((n - 1) / 99) * 100}%`} aria-describedby="n-help" />
      <span id="n-help" class="visually-hidden">Changing the sample size starts the collection of means over.</span>
    </label>
    <div class="buttons">
      <button type="button" class="b" onclick={() => draw(1)}>Draw 1 sample</button>
      <button type="button" class="b" onclick={() => draw(100)}>Draw 100</button>
      <button type="button" class="b b--ink" onclick={toggleRun} aria-pressed={running}>{running ? 'Pause' : 'Run'}</button>
      <button type="button" class="b b--quiet" onclick={clear}>Clear</button>
    </div>
  </div>

  <figure class="panel">
    <figcaption class="panel__cap"><span class="label">Fig. 1 · The population</span> <span class="panel__note">{pop.blurb} <span class="key key--rug"></span> latest sample <span class="key key--xbar">▼</span> its mean x̄</span></figcaption>
    <svg width={w} height={hA} viewBox={`0 0 ${w} ${hA}`} role="img" aria-label={`Population shape: ${pop.label}. Mean ${fmt(pop.mean)}, standard deviation ${fmt(pop.sd)}.${last.length ? ` Latest sample of ${n} has mean ${fmt(lastMean)}.` : ''}`}>
      <defs>
        <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" class="hatch" />
        </pattern>
      </defs>
      <path d={areaA} fill="url(#hatch)" />
      <path d={curveA} class="curve" />
      <line x1={x(pop.mean)} x2={x(pop.mean)} y1={pad.t} y2={yA(0)} class="mu" />
      <text x={x(pop.mean) + 5} y={pad.t + 10} class="t t--mu">μ = {fmt(pop.mean)}</text>
      {#each last as v}
        <line x1={x(Math.min(v, view[1]))} x2={x(Math.min(v, view[1]))} y1={yA(0) - 9} y2={yA(0)} class="rug" />
      {/each}
      {#if last.length}
        <path d={`M${x(lastMean)} ${yA(0) - 12} l-5 -8 h10 z`} class="xbar" />
        <text x={x(lastMean)} y={yA(0) - 24} class="t t--xbar" text-anchor="middle">x̄</text>
      {/if}
      <line x1={pad.l} x2={x(view[1])} y1={yA(0)} y2={yA(0)} class="axis" />
      {#each xt as t}
        <line x1={x(t)} x2={x(t)} y1={yA(0)} y2={yA(0) + 4} class="axis" />
        <text x={x(t)} y={yA(0) + 17} class="t" text-anchor="middle">{t}</text>
      {/each}
    </svg>
  </figure>

  <figure class="panel">
    <figcaption class="panel__cap"><span class="label">Fig. 2 · Means of {means.length.toLocaleString('en')} samples of size {n}</span> <span class="panel__note"><span class="key key--bars"></span> observed <span class="key key--curve"></span> predicted by the CLT</span></figcaption>
    <svg width={w} height={hB} viewBox={`0 0 ${w} ${hB}`} role="img" aria-label={`Histogram of ${means.length} sample means. Their spread is ${fmt(spread)}; the central limit theorem predicts ${fmt(se)}.`}>
      {#each yBt as t}
        <line x1={pad.l} x2={x(view[1])} y1={yB(t)} y2={yB(t)} class="grid" />
        <text x={pad.l - 8} y={yB(t) + 4} class="t" text-anchor="end">{t}</text>
      {/each}
      {#each hist.counts as c, i}
        {#if c > 0}
          <rect x={x(hist.edges[i]) + 0.5} y={yB(c)} width={Math.max(0.5, x(hist.edges[i + 1]) - x(hist.edges[i]) - 1)} height={yB(0) - yB(c)} class="bar" />
        {/if}
      {/each}
      {#if normalCurve}<path d={normalCurve} class="normal" />{/if}
      <line x1={pad.l} x2={x(view[1])} y1={yB(0)} y2={yB(0)} class="axis" />
      {#each xt as t}
        <line x1={x(t)} x2={x(t)} y1={yB(0)} y2={yB(0) + 4} class="axis" />
        <text x={x(t)} y={yB(0) + 17} class="t" text-anchor="middle">{t}</text>
      {/each}
    </svg>
    <dl class="readout" aria-live="polite">
      <div><dt>Mean of the means</dt><dd>{fmt(means.length ? mean(means) : NaN)} <span class="muted">μ = {fmt(pop.mean)}</span></dd></div>
      <div><dt>Spread of the means</dt><dd>{fmt(spread)} <span class="muted">σ/√n = {fmt(pop.sd)}/√{n} = {fmt(se)}</span></dd></div>
    </dl>
  </figure>
</div>

<style>
  .explorable { display: grid; gap: var(--space-m); }
  .controls {
    display: grid; grid-template-columns: minmax(0, auto) minmax(12rem, 1fr); gap: var(--space-m) var(--space-l);
    align-items: end; padding: var(--space-m); background: var(--paper-raised); border: var(--hair) solid var(--rule);
  }
  .buttons { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: var(--space-2xs); }
  .seg { border: 0; padding: 0; display: grid; gap: 0.4rem; }
  .seg__row { display: flex; flex-wrap: wrap; }
  .seg__opt {
    position: relative; cursor: pointer; font-family: var(--font-mono); font-size: var(--step--1);
    padding: 0.55rem 0.9rem; border: var(--hair) solid var(--rule-strong); margin-right: -1px; min-height: 2.75rem;
    display: inline-flex; align-items: center; background: var(--paper);
  }
  .seg__opt input { position: absolute; opacity: 0; inset: 0; margin: 0; cursor: pointer; width: 100%; height: 100%; border: 0; }
  .seg__opt.is-on { background: var(--ink); color: var(--paper); border-color: var(--ink); z-index: 1; }
  .seg__opt:has(input:focus-visible) { outline: 2px solid var(--focus); outline-offset: 2px; z-index: 2; }
  .b {
    font-family: var(--font-mono); font-size: var(--step--1); letter-spacing: 0.03em;
    min-height: 2.75rem; padding: 0.5rem 0.95rem; cursor: pointer;
    background: var(--paper); color: var(--ink); border: var(--stroke) solid var(--ink); border-radius: var(--radius);
    box-shadow: 3px 3px 0 -1px color-mix(in srgb, var(--accent) 35%, transparent);
    transition: transform var(--dur-ui) var(--ease-out), box-shadow var(--dur-ui);
  }
  .b:hover { background: var(--paper-sunk); }
  .b:active { transform: translate(2px, 2px); box-shadow: none; }
  .b--ink { background: var(--ink); color: var(--paper); min-width: 6rem; }
  .b--ink:hover { background: var(--ink); }
  .b--quiet { border-color: transparent; box-shadow: none; text-decoration: underline; text-decoration-color: var(--accent); text-underline-offset: 0.3em; background: transparent; }
  .panel { display: grid; gap: var(--space-2xs); }
  .panel svg { display: block; overflow: visible; }
  .panel__cap { display: flex; flex-wrap: wrap; gap: 0.25rem 1rem; align-items: baseline; justify-content: space-between; }
  .panel__cap .label { color: var(--accent-ink); }
  .panel__note { font-size: var(--step--1); color: var(--ink-2); font-style: italic; display: inline-flex; align-items: center; gap: 0.35rem; flex-wrap: wrap; }
  .key { display: inline-block; width: 1.4em; height: 0.7em; }
  .key--bars { background: var(--ink); opacity: 0.8; }
  .key--curve { height: 0; border-top: 2.5px solid var(--accent); margin-left: 0.6em; }
  .key--rug { width: 0.7em; height: 0.8em; margin-left: 0.6em; background: repeating-linear-gradient(to right, var(--teal) 0 1.5px, transparent 1.5px 4px); }
  .key--xbar { width: auto; height: auto; color: var(--accent); font-style: normal; font-size: 0.8em; margin-left: 0.6em; }
  .hatch { stroke: var(--ink); stroke-width: 1; opacity: 0.35; }
  .curve { fill: none; stroke: var(--ink); stroke-width: 1.6; }
  .mu { stroke: var(--ink-3); stroke-dasharray: 3 4; }
  .rug { stroke: var(--teal); stroke-width: 1.5; }
  .xbar { fill: var(--accent); }
  .axis { stroke: var(--rule-strong); }
  .grid { stroke: var(--rule); stroke-dasharray: 2 4; }
  .bar { fill: var(--ink); opacity: 0.78; }
  .normal { fill: none; stroke: var(--accent); stroke-width: 2.5; }
  .t { font-family: var(--font-mono); font-size: 11px; fill: var(--ink-3); }
  .t--mu { fill: var(--ink-2); }
  .t--xbar { fill: var(--accent-ink); font-size: 13px; font-weight: 600; }
  .readout { display: grid; grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr)); gap: var(--space-2xs) var(--space-l); margin-top: var(--space-2xs); }
  .readout dt { font-family: var(--font-mono); font-size: var(--step--2); letter-spacing: var(--tracking-caps); text-transform: uppercase; color: var(--ink-3); }
  .readout dd { font-family: var(--font-mono); font-size: var(--step-0); font-variant-numeric: tabular-nums; }
  .readout .muted { font-size: var(--step--1); margin-left: 0.4rem; }
  @media (max-width: 40rem) {
    .controls { grid-template-columns: minmax(0, 1fr); padding: var(--space-s); }
    .seg__opt { padding-inline: 0.7rem; }
  }
</style>
