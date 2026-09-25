<script lang="ts">
  import { usable } from '../../lib/measure';
  // Plate II: Bayes' rule as natural frequencies. 1000 squares, one per person.
  import { naturalFrequencies, BAYES_PRESETS, type BayesPreset } from '../../lib/stats/bayes';

  let preset = $state<BayesPreset>(BAYES_PRESETS[0]);
  let prior = $state(BAYES_PRESETS[0].prior);
  let sens = $state(BAYES_PRESETS[0].sensitivity);
  let spec = $state(BAYES_PRESETS[0].specificity);
  let wRaw = $state(720);
  const w = $derived(usable(wRaw, 720)); // see lib/measure.ts

  // Prior slider on a log scale from 0.1 % to 50 %.
  const LO = Math.log10(0.001), HI = Math.log10(0.5);
  const toPrior = (t: number) => Math.pow(10, LO + (t / 1000) * (HI - LO));
  const fromPrior = (p: number) => Math.round(((Math.log10(p) - LO) / (HI - LO)) * 1000);
  let priorT = $state(fromPrior(BAYES_PRESETS[0].prior));

  function choose(p: BayesPreset) {
    preset = p; prior = p.prior; sens = p.sensitivity; spec = p.specificity; priorT = fromPrior(p.prior);
  }
  const f = $derived(naturalFrequencies({ prior, sensitivity: sens, specificity: spec }, 1000));
  const positives = $derived(f.truePos + f.falsePos);
  // Agreement with the count: "1 has the disease", "9 have the disease".
  const has = (k: number) => (k === 1 ? preset.conditionOne : preset.condition);
  const tests = (k: number) => (k === 1 ? preset.testOne : preset.test);
  const neg = (k: number) => (k === 1 ? "doesn't" : "don't");
  const be = (k: number) => (k === 1 ? 'is' : 'are');

  const pct = (v: number) => {
    if (!Number.isFinite(v)) return '–';
    const p = v * 100;
    return (p >= 10 ? p.toFixed(0) : p >= 1 ? p.toFixed(1) : p.toFixed(2).replace(/0$/, '')) + '%';
  };
  const slide = (v: number, lo: number, hi: number) => `--fill:${((v - lo) / (hi - lo)) * 100}%`;

  // Grid: people in reading order: true positives, false negatives, false positives, true negatives.
  const cols = $derived(w < 560 ? 25 : 50);
  // bind:clientWidth reports 0 for a moment during hydration; never draw a negative square.
  const cell = $derived(Math.max(4, Math.min(16, Math.floor((Math.min(w, 760) - (cols - 1) * 2) / cols))));
  const kinds = $derived(
    Array.from({ length: 1000 }, (_, i) =>
      i < f.truePos ? 'tp' : i < f.truePos + f.falseNeg ? 'fn' : i < f.truePos + f.falseNeg + f.falsePos ? 'fp' : 'tn'),
  );
  const gridW = $derived(cols * cell + (cols - 1) * 2);
  const gridH = $derived(Math.ceil(1000 / cols) * (cell + 2) - 2);
</script>

<div class="explorable" bind:clientWidth={wRaw}>
  <div class="presets" role="group" aria-label="Scenarios">
    <span class="label">Scenario</span>
    {#each BAYES_PRESETS as p}
      <button type="button" class="chip" class:is-on={preset.id === p.id && prior === p.prior && sens === p.sensitivity && spec === p.specificity} onclick={() => choose(p)}>{p.label}</button>
    {/each}
  </div>

  <div class="controls">
    <label class="control">
      <span class="control__head"><span class="label">How common it is</span><span class="control__value">{pct(prior)}</span></span>
      <input type="range" min="0" max="1000" step="1" bind:value={priorT} oninput={() => (prior = toPrior(priorT))} style={slide(priorT, 0, 1000)} aria-valuetext={`${pct(prior)} of people ${preset.condition}`} />
    </label>
    <label class="control">
      <span class="control__head"><span class="label">Sensitivity</span><span class="control__value">{pct(sens)}</span></span>
      <input type="range" min="0.5" max="0.999" step="0.001" bind:value={sens} style={slide(sens, 0.5, 0.999)} aria-valuetext={`${pct(sens)} of those who ${preset.condition} ${preset.test}`} />
    </label>
    <label class="control">
      <span class="control__head"><span class="label">Specificity</span><span class="control__value">{pct(spec)}</span></span>
      <input type="range" min="0.5" max="0.999" step="0.001" bind:value={spec} style={slide(spec, 0.5, 0.999)} aria-valuetext={`${pct(spec)} of those who don't correctly avoid a positive`} />
    </label>
  </div>

  <figure class="panel">
    <figcaption class="panel__cap"><span class="label">Fig. 1 · 1000 {preset.unit}, one square each</span> <span class="panel__note">Filled: tested positive. Outlined: tested negative. Vermilion: {preset.conditionOne}.</span></figcaption>
    <svg width={gridW} height={gridH} viewBox={`0 0 ${gridW} ${gridH}`} role="img"
      aria-label={`Of 1000 ${preset.unit}, ${f.truePos + f.falseNeg} ${has(f.truePos + f.falseNeg)}: ${f.truePos} of them ${tests(f.truePos)} and ${f.falseNeg} ${neg(f.falseNeg).replace("n't", ' not')}. Of the other ${f.falsePos + f.trueNeg}, ${f.falsePos} ${tests(f.falsePos)} anyway.`}>
      {#each kinds as k, i}
        <rect x={(i % cols) * (cell + 2) + 0.5} y={Math.floor(i / cols) * (cell + 2) + 0.5} width={cell - 1} height={cell - 1} class={`p p--${k}`} />
      {/each}
    </svg>
    <ul class="legend">
      <li><span class="sw p--tp"></span><b>{f.truePos}</b> {has(f.truePos)} and {tests(f.truePos)}</li>
      <li><span class="sw p--fn"></span><b>{f.falseNeg}</b> {has(f.falseNeg)} but {be(f.falseNeg)} missed</li>
      <li><span class="sw p--fp"></span><b>{f.falsePos}</b> {neg(f.falsePos)}, but {tests(f.falsePos)} anyway</li>
      <li><span class="sw p--tn"></span><b>{f.trueNeg}</b> {neg(f.trueNeg)}, and {be(f.trueNeg)} cleared</li>
    </ul>
  </figure>

  <figure class="panel answer">
    <figcaption class="panel__cap"><span class="label">Fig. 2 · Only the positives</span></figcaption>
    <div class="bar" role="img" aria-label={`${positives} positives: ${f.truePos} true, ${f.falsePos} false.`}>
      {#if positives > 0}
        <span class="bar__tp" style={`flex-grow:${f.truePos}`}></span>
        <span class="bar__fp" style={`flex-grow:${f.falsePos}`}></span>
      {/if}
    </div>
    {#if positives > 0}
      <div class="bar__labels" aria-hidden="true">
        <span class="bar__l--tp">{f.truePos} true</span>
        <span class="bar__l--fp">{f.falsePos} false</span>
      </div>
    {/if}
    <p class="verdict" aria-live="polite">
      {#if positives > 0}
        Of the <b>{positives}</b> {positives === 1 ? preset.unitOne : preset.unit} {preset.who} {tests(positives)}, <b class="accent">{f.truePos}</b> actually {has(f.truePos)}:
        <span class="big">{pct(f.ppvCounts)}</span>
        <span class="muted exact">(exactly {pct(f.posterior)} before rounding to whole people)</span>
      {:else}
        Nobody {preset.test}, so a positive result tells us nothing here.
      {/if}
    </p>
    <p class="note">{preset.note}</p>
  </figure>
</div>

<style>
  .explorable { display: grid; gap: var(--space-m); }
  .presets { display: flex; flex-wrap: wrap; gap: var(--space-2xs); align-items: center; }
  .presets .label { margin-right: var(--space-2xs); }
  .chip {
    font-family: var(--font-mono); font-size: var(--step--1); min-height: 2.75rem; padding: 0.4rem 0.9rem;
    border: var(--hair) solid var(--rule-strong); border-radius: 999px; background: var(--paper); color: var(--ink); cursor: pointer;
  }
  .chip:hover { border-color: var(--ink); }
  .chip.is-on { background: var(--ink); color: var(--paper); border-color: var(--ink); }
  .controls {
    display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-m) var(--space-l);
    padding: var(--space-m); background: var(--paper-raised); border: var(--hair) solid var(--rule);
  }
  .panel { display: grid; gap: var(--space-xs); }
  .panel__cap { display: flex; flex-wrap: wrap; gap: 0.25rem 1rem; align-items: baseline; justify-content: space-between; }
  .panel__cap .label { color: var(--accent-ink); }
  .panel__note { font-size: var(--step--1); color: var(--ink-2); font-style: italic; }
  .panel svg { display: block; max-width: 100%; height: auto; }
  .p { transition: fill var(--dur-ui); }
  .p--tp { fill: var(--accent); }
  .p--fn { fill: none; stroke: var(--accent); stroke-width: 2.2; }
  .p--fp { fill: var(--teal); }
  /* Encoding: filled = tested positive, outlined = tested negative; vermilion = has it.
     Outlines use --rule-strong so the cleared majority stays visible in both themes. */
  .p--tn { fill: none; stroke: var(--rule-strong); stroke-width: 1; }
  .legend { list-style: none; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr)); gap: 0.35rem var(--space-m); font-size: var(--step--1); }
  .legend li { display: flex; align-items: center; gap: 0.5rem; }
  .legend b { font-family: var(--font-mono); font-weight: 600; min-width: 2.6em; text-align: right; font-variant-numeric: tabular-nums; }
  .sw { width: 0.85rem; height: 0.85rem; flex: none; display: inline-block; }
  .sw.p--tp { background: var(--accent); }
  .sw.p--fn { border: 2.5px solid var(--accent); }
  .sw.p--fp { background: var(--teal); }
  .sw.p--tn { border: 1px solid var(--rule-strong); }
  .answer { padding: var(--space-m); border: var(--stroke) solid var(--ink); background: var(--paper-raised); }
  .bar { display: flex; height: 2.2rem; border: var(--hair) solid var(--rule-strong); }
  .bar span { min-width: 2px; flex-basis: 0; }
  .bar__labels { display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: var(--step--1); margin-top: -0.3rem; }
  .bar__l--tp { color: var(--accent-ink); }
  .bar__l--fp { color: var(--teal-ink); }
  .bar__tp { background: var(--accent); }
  .bar__fp { background: var(--teal); }
  .verdict { font-size: var(--step-1); line-height: 1.4; }
  .verdict b { font-family: var(--font-mono); font-size: 0.9em; }
  .verdict .accent { color: var(--accent-ink); }
  .big { font-family: var(--font-display); font-size: var(--step-3); line-height: 1; color: var(--ink); margin-left: 0.2em; }
  .exact { display: block; font-size: var(--step--1); margin-top: 0.3rem; }
  .note { color: var(--ink-2); font-style: italic; font-size: var(--step--1); }
  @media (max-width: 52rem) { .controls { grid-template-columns: minmax(0, 1fr); padding: var(--space-s); } }
</style>
