<script lang="ts">
  import { usable } from '../../lib/measure';
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
  const w = $derived(usable(wRaw, 360)); // see lib/measure.ts

  const target = $derived(Math.round(rngFrom(`plate-3/guess/${round}`).range(-0.95, 0.95) * 100) / 100);
  const pts = $derived(pointsWithCorrelation(40, target, rngFrom(`plate-3/cloud/${round}`), { exact: true }));
  const truth = $derived(pearson(pts));
  const size = $derived(Math.min(w - 16, 340)); // plot frame has 8 px padding
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
  <figure class="fig">
    <div class="fig__plot">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} class="cloud" role="img" aria-label={`Round ${round}: a cloud of 40 points with a hidden correlation.`}>
        {#each pts as p}<circle cx={s(p.x)} cy={sy(p.y)} r="3.6" class="dot" />{/each}
      </svg>
    </div>
    <figcaption class="fig__cap"><span class="fig__label">Fig. 2 · Round {round}</span> <span class="fig__note">40 points, one hidden correlation.</span></figcaption>
  </figure>
  <div class="game__side">
    <label class="control">
      <span class="control__head"><span class="label">Your guess for r</span><span class="control__value">{guess.toFixed(2)}</span></span>
      <input type="range" min="-1" max="1" step="0.01" bind:value={guess} disabled={revealed} style={`--fill:${((guess + 1) / 2) * 100}%`} />
    </label>
    <div class="ends"><span>−1 · falls</span><span>0 · no pattern</span><span>+1 · rises</span></div>
    {#if !revealed}
      <button type="button" class="btn btn--primary btn--sm" onclick={check}>Check my guess</button>
    {:else}
      <p class="result" aria-live="polite"><span class="answer-num">r = {truth.toFixed(2)}</span> {verdict(err)} You were off by {err.toFixed(2)}.</p>
      <button type="button" class="btn btn--primary btn--sm" onclick={next}>Next cloud <span class="btn__arrow" aria-hidden="true">→</span></button>
    {/if}
    <p class="score label" aria-live="polite">
      {#if history.length}{history.length} played · {hits} within 0.1 · mean error {meanErr.toFixed(2)}{:else}No guesses yet · rounds never run out{/if}
    </p>
  </div>
</div>

<style>
  /* Buttons, the figure frame and the answer number come from the kit (styles/explorable.css). */
  .game { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: var(--space-l); align-items: start; }
  .cloud { display: block; }
  .dot { fill: var(--ink); opacity: 0.85; }
  .game__side { display: grid; gap: var(--space-s); max-width: 26rem; justify-items: start; }
  .game__side .control { width: 100%; }
  .ends { display: flex; justify-content: space-between; width: 100%; font-family: var(--font-mono); font-size: var(--step--2); color: var(--ink-3); margin-top: -0.5rem; }
  .result { font-size: var(--step-0); }
  .result .answer-num { display: block; margin-bottom: 0.2rem; }
  .score { color: var(--ink-2); }
  @media (max-width: 40rem) { .game { grid-template-columns: minmax(0, 1fr); } }
</style>
