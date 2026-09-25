<script lang="ts">
  // "Guess the r": a cloud with an exact, hidden correlation; the reader guesses by eye.
  // Rounds are seeded (round k always shows the same cloud), so results are reproducible.
  import { rngFrom } from '../../lib/random';
  import { pointsWithCorrelation, pearson } from '../../lib/stats/regression';
  import { linearScale } from '../../lib/scale';

  let round = $state(1);
  let guess = $state(0);
  let revealed = $state(false);
  let history = $state<number[]>([]);
  let wRaw = $state(360);
  const w = $derived(wRaw || 360); // 0 for a moment during hydration

  const target = $derived(Math.round(rngFrom(`plate-3/guess/${round}`).range(-0.95, 0.95) * 100) / 100);
  const pts = $derived(pointsWithCorrelation(40, target, rngFrom(`plate-3/cloud/${round}`), { exact: true }));
  const truth = $derived(pearson(pts));
  const size = $derived(Math.min(w, 340));
  const s = $derived(linearScale([0, 1], [10, size - 10]));
  const sy = $derived(linearScale([0, 1], [size - 10, 10]));
  const err = $derived(Math.abs(guess - truth));
  const meanErr = $derived(history.length ? history.reduce((a, b) => a + b, 0) / history.length : NaN);
  const hits = $derived(history.filter((e) => e <= 0.1).length);

  function check() { revealed = true; history = [...history, Math.abs(guess - truth)]; }
  function next() { round += 1; revealed = false; guess = 0; }
  const verdict = (e: number) => (e <= 0.05 ? 'Spot on.' : e <= 0.1 ? 'Close.' : e <= 0.25 ? 'In the neighbourhood.' : 'Not quite.');
</script>

<div class="game" bind:clientWidth={wRaw}>
  <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} class="cloud" role="img" aria-label={`Round ${round}: a cloud of 40 points with a hidden correlation.`}>
    <rect x="0.5" y="0.5" width={size - 1} height={size - 1} class="frame" />
    {#each pts as p}<circle cx={s(p.x)} cy={sy(p.y)} r="3.6" class="dot" />{/each}
  </svg>
  <div class="panel">
    <p class="label">Round {round}</p>
    <label class="control">
      <span class="control__head"><span class="label">Your guess for r</span><span class="control__value">{guess.toFixed(2)}</span></span>
      <input type="range" min="-1" max="1" step="0.01" bind:value={guess} disabled={revealed} style={`--fill:${((guess + 1) / 2) * 100}%`} />
    </label>
    <div class="ends"><span>−1 · falls</span><span>0 · no pattern</span><span>+1 · rises</span></div>
    {#if !revealed}
      <button type="button" class="b b--ink" onclick={check}>Check my guess</button>
    {:else}
      <p class="result" aria-live="polite"><span class="big">r = {truth.toFixed(2)}</span> {verdict(err)} You were off by {err.toFixed(2)}.</p>
      <button type="button" class="b" onclick={next}>Next cloud →</button>
    {/if}
    <p class="score label" aria-live="polite">
      {#if history.length}{history.length} played · {hits} within 0.1 · mean error {meanErr.toFixed(2)}{:else}No guesses yet · rounds never run out{/if}
    </p>
  </div>
</div>

<style>
  .game { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: var(--space-l); align-items: start; }
  .cloud { display: block; background: var(--paper-raised); }
  .frame { fill: none; stroke: var(--rule-strong); }
  .dot { fill: var(--ink); opacity: 0.85; }
  .panel { display: grid; gap: var(--space-s); max-width: 26rem; }
  .ends { display: flex; justify-content: space-between; font-family: var(--font-mono); font-size: var(--step--2); color: var(--ink-3); margin-top: -0.5rem; }
  .b {
    justify-self: start; font-family: var(--font-mono); font-size: var(--step--1); min-height: 2.75rem; padding: 0.5rem 1rem; cursor: pointer;
    background: var(--paper); color: var(--ink); border: var(--stroke) solid var(--ink); border-radius: var(--radius);
    box-shadow: 3px 3px 0 -1px color-mix(in srgb, var(--accent) 35%, transparent);
  }
  .b--ink { background: var(--ink); color: var(--paper); }
  .result { font-size: var(--step-0); }
  .big { display: block; font-family: var(--font-display); font-size: var(--step-3); line-height: 1; color: var(--accent-ink); margin-bottom: 0.2rem; }
  .score { color: var(--ink-2); }
  @media (max-width: 40rem) { .game { grid-template-columns: minmax(0, 1fr); } }
</style>
