<script lang="ts">
  // Styleguide island: re-plot the signature specimen in the browser from a seed, using the
  // very same generator the server uses (lib/plot/specimen.ts).
  import { specimen, SPECIES, type Species } from '../../lib/plot/specimen';

  let seed = $state('unattended');
  let species = $state<Species | 'auto'>('auto');
  let detail = $state(0.8);
  let run = $state(0);

  const sp = $derived(specimen(seed || ' ', { species: species === 'auto' ? undefined : species, detail }));
  const ink = $derived(sp.paths.filter((p) => p.pen === 'ink'));
  const acc = $derived(sp.paths.filter((p) => p.pen === 'accent'));
  const stagger = $derived(Math.max(4, Math.round(1800 / Math.max(1, sp.paths.length))));

  function shuffle() {
    seed = Math.random().toString(36).slice(2, 8);
    run++;
  }
</script>

<div class="playground">
  <div class="playground__controls">
    <label class="control">
      <span class="control__head"><span class="label">Seed</span></span>
      <input type="text" bind:value={seed} spellcheck="false" autocomplete="off" />
    </label>
    <label class="control">
      <span class="control__head"><span class="label">Species</span></span>
      <select bind:value={species}>
        <option value="auto">auto (from seed)</option>
        {#each SPECIES as s}<option value={s}>{s}</option>{/each}
      </select>
    </label>
    <label class="control">
      <span class="control__head"><span class="label">Detail</span><span class="control__value">{detail.toFixed(2)}</span></span>
      <input type="range" min="0.2" max="1.4" step="0.05" bind:value={detail} style={`--fill:${((detail - 0.2) / 1.2) * 100}%`} />
    </label>
    <button class="btn btn--secondary btn--sm replot" type="button" onclick={shuffle}>New seed</button>
    <p class="label playground__readout">species: {sp.species} · strokes: {sp.paths.length}</p>
  </div>
  <div class="playground__sheet">
    {#key `${seed}|${species}|${detail}|${run}`}
      <svg class="plot" viewBox={sp.viewBox.join(' ')} data-draw data-in style={`--stagger:${stagger}ms`} role="img" aria-label={`Plotter specimen for seed ${seed}`}>
        <g class="pen-ink">{#each ink as p, i}<path d={p.d} pathLength="1" style={`--i:${i}`} />{/each}</g>
        <g class="pen-accent">{#each acc as p, i}<path d={p.d} pathLength="1" style={`--i:${ink.length + i}`} />{/each}</g>
      </svg>
    {/key}
  </div>
</div>

<style>
  .playground { display: grid; grid-template-columns: minmax(0, 16rem) minmax(0, 1fr); gap: var(--space-l); align-items: start; }
  .playground__controls { display: grid; gap: var(--space-s); }
  .playground__sheet { aspect-ratio: 1; max-width: 30rem; width: 100%; background: var(--paper-raised); border: var(--hair) solid var(--rule); padding: var(--space-m); }
  .playground__readout { margin-top: var(--space-2xs); }
  .replot { justify-self: start; }
  @media (max-width: 44rem) { .playground { grid-template-columns: minmax(0, 1fr); } }
</style>
