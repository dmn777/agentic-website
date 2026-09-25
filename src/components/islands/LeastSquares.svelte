<script lang="ts">
  import { usable } from '../../lib/measure';
  // Plate III: least squares you can push around. Points are stored in [0, 1]² and shown
  // on a 0–10 scale. Drag with mouse or touch, add by clicking empty space, or focus a
  // point and use the arrow keys (Delete removes it).
  import { rngFrom } from '../../lib/random';
  import { ols, pointsWithCorrelation, type Pt } from '../../lib/stats/regression';
  import { linearScale, niceTicks } from '../../lib/scale';

  // The starting cloud sits in the left two thirds, leaving room on the right for the
  // far-out point to show what leverage does. (An affine squeeze of x keeps r exact.)
  const START = pointsWithCorrelation(12, 0.72, rngFrom('plate-3/start'), { exact: true })
    .map((p) => ({ x: 0.08 + ((p.x - 0.05) / 0.9) * 0.6, y: p.y }));
  let pts = $state<Pt[]>(START.map((p) => ({ ...p })));
  let active = $state<number | null>(null);
  let dragging = $state<number | null>(null);
  let showResiduals = $state(true);
  let showSquares = $state(false);
  let wRaw = $state(640);
  // bind:clientWidth reports 0 for a moment during hydration; keep the geometry sane.
  const w = $derived(usable(wRaw - 16, 640)); // plot frame has 8 px padding
  let svgEl: SVGSVGElement;

  const fit = $derived(ols(pts));
  const H = $derived(Math.round(Math.min(Math.max(w * 0.72, 300), 460)));
  const pad = { l: 40, r: 14, t: 14, b: 34 };
  const x = $derived(linearScale([0, 1], [pad.l, w - pad.r]));
  const y = $derived(linearScale([0, 1], [H - pad.b, pad.t]));
  const ticks = niceTicks(0, 10, 5);
  const highLev = $derived(4 / Math.max(pts.length, 1)); // "high" leverage: twice the average 2/n
  const ssr = $derived(fit.residuals.reduce((a, e) => a + (e * 10) ** 2, 0));
  const fmt = (v: number, d = 2) => (Number.isFinite(v) ? v.toFixed(d) : '–');

  // The fitted line clipped to the unit box.
  const line = $derived.by(() => {
    if (!Number.isFinite(fit.slope)) return null;
    const yAt = (u: number) => fit.intercept + fit.slope * u;
    let x0 = 0, x1 = 1;
    if (fit.slope !== 0) {
      const xs = [(0 - fit.intercept) / fit.slope, (1 - fit.intercept) / fit.slope].sort((a, b) => a - b);
      x0 = Math.max(0, xs[0]); x1 = Math.min(1, xs[1]);
    }
    return x0 < x1 ? { x0, y0: yAt(x0), x1, y1: yAt(x1) } : null;
  });

  function toData(ev: PointerEvent): Pt {
    const r = svgEl.getBoundingClientRect();
    const px = ((ev.clientX - r.left) / r.width) * w, py = ((ev.clientY - r.top) / r.height) * H;
    return { x: Math.min(1, Math.max(0, x.invert(px))), y: Math.min(1, Math.max(0, y.invert(py))) };
  }
  function down(i: number, ev: PointerEvent) {
    ev.preventDefault(); ev.stopPropagation();
    dragging = i; active = i;
    (ev.currentTarget as Element).setPointerCapture(ev.pointerId);
  }
  function move(i: number, ev: PointerEvent) {
    if (dragging !== i) return;
    pts[i] = toData(ev);
  }
  function up() { dragging = null; }
  function addAt(ev: PointerEvent) {
    if (dragging !== null || pts.length >= 40) return;
    const p = toData(ev);
    pts.push(p); active = pts.length - 1;
  }
  function key(i: number, ev: KeyboardEvent) {
    const step = ev.shiftKey ? 0.1 : 0.02;
    const p = { ...pts[i] };
    if (ev.key === 'ArrowLeft') p.x -= step; else if (ev.key === 'ArrowRight') p.x += step;
    else if (ev.key === 'ArrowUp') p.y += step; else if (ev.key === 'ArrowDown') p.y -= step;
    else if (ev.key === 'Delete' || ev.key === 'Backspace') { remove(i); ev.preventDefault(); return; }
    else return;
    ev.preventDefault();
    pts[i] = { x: Math.min(1, Math.max(0, p.x)), y: Math.min(1, Math.max(0, p.y)) };
  }
  function remove(i: number) {
    if (pts.length <= 2) return;
    pts.splice(i, 1); active = null;
  }
  function addOutlier() {
    pts.push({ x: 0.97, y: 0.06 }); active = pts.length - 1;
  }
  function reset() { pts = START.map((p) => ({ ...p })); active = null; }
</script>

<div class="explorable">
  <div class="controls">
    <div class="btn-row">
      <label class="check"><input type="checkbox" bind:checked={showResiduals} /> Residuals</label>
      <label class="check"><input type="checkbox" bind:checked={showSquares} /> Squared residuals</label>
      <span class="spacer"></span>
      <button type="button" class="btn btn--secondary btn--sm" onclick={addOutlier}>Add a far-out point</button>
      <button type="button" class="btn btn--quiet btn--sm" onclick={reset}>Reset</button>
    </div>
  </div>

  <figure class="fig">
    <div class="fig__plot" bind:clientWidth={wRaw}>
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <svg bind:this={svgEl} width={w} height={H} viewBox={`0 0 ${w} ${H}`} class="plotarea" class:is-dragging={dragging !== null}
      role="application" aria-label={`Scatter plot of ${pts.length} points with the least-squares line. Slope ${fmt(fit.slope)}, r ${fmt(fit.r)}. Click empty space to add a point; focus a point and use arrow keys to move it.`}
      onpointerdown={addAt} onpointerup={up}>
      {#each ticks as t}
        <line x1={x(t / 10)} x2={x(t / 10)} y1={y(0)} y2={y(1)} class="grid" />
        <line x1={x(0)} x2={x(1)} y1={y(t / 10)} y2={y(t / 10)} class="grid" />
        <text x={x(t / 10)} y={y(0) + 18} class="t" text-anchor="middle">{t}</text>
        <text x={x(0) - 8} y={y(t / 10) + 4} class="t" text-anchor="end">{t}</text>
      {/each}
      <rect x={x(0)} y={y(1)} width={x(1) - x(0)} height={y(0) - y(1)} class="frame" />
      {#if showSquares && Number.isFinite(fit.slope)}
        {#each pts as p, i}
          {@const e = fit.residuals[i]}
          {@const side = Math.abs(y(p.y) - y(p.y - e))}
          <rect x={p.x > 0.5 ? x(p.x) - side : x(p.x)} y={Math.min(y(p.y), y(p.y - e))} width={side} height={side} class="sq" />
        {/each}
      {/if}
      {#if showResiduals && Number.isFinite(fit.slope)}
        {#each pts as p, i}
          <line x1={x(p.x)} x2={x(p.x)} y1={y(p.y)} y2={y(p.y - fit.residuals[i])} class="res" />
        {/each}
      {/if}
      {#if line}<line x1={x(line.x0)} y1={y(line.y0)} x2={x(line.x1)} y2={y(line.y1)} class="fit" />{/if}
      {#each pts as p, i}
        {@const hi = fit.leverage[i] > highLev}
        <circle cx={x(p.x)} cy={y(p.y)} data-x={p.x} data-y={p.y} r={hi ? 8 : 6.5} class="pt" class:pt--hi={hi} class:pt--on={active === i}
          tabindex="0" role="button" aria-label={`Point ${i + 1} at (${fmt(p.x * 10, 1)}, ${fmt(p.y * 10, 1)}), leverage ${fmt(fit.leverage[i])}`}
          onpointerdown={(e) => down(i, e)} onpointermove={(e) => move(i, e)} onpointerup={up} onpointercancel={up}
          onkeydown={(e) => key(i, e)} onfocus={() => (active = i)} />
      {/each}
    </svg>
    </div>
    <figcaption class="fig__cap">
      <span class="fig__label">Fig. 1 · Drag the points</span>
      <span class="fig__note">Click empty space to add one. Keyboard: Tab to a point, then arrows to move it (Shift for big steps), Delete to remove it. Circled points have high leverage.</span>
    </figcaption>
  </figure>

  <dl class="readout" aria-live="polite">
    <div class="readout__wide"><dt>Line</dt><dd>ŷ = {fmt(fit.intercept * 10)} {fit.slope < 0 ? '−' : '+'} {fmt(Math.abs(fit.slope))}·x</dd></div>
    <div><dt>Correlation r</dt><dd>{fmt(fit.r)}</dd></div>
    <div><dt>R²</dt><dd>{fmt(fit.r2)}</dd></div>
    <div><dt>Sum of squared residuals</dt><dd>{fmt(ssr, 1)}</dd></div>
    <div><dt>Points</dt><dd>{pts.length}</dd></div>
    {#if active !== null && pts[active]}
      <div><dt>Point {active + 1}: leverage</dt><dd>{fmt(fit.leverage[active])} <span class="muted">avg {fmt(2 / pts.length)}</span></dd></div>
    {/if}
  </dl>
</div>

<style>
  /* Controls, buttons, the figure frame and the readout come from the kit
     (styles/explorable.css); only this plate's chart marks are styled here. */
  .explorable { display: grid; gap: var(--space-s); }
  .spacer { flex: 1; }
  .check { display: inline-flex; align-items: center; gap: 0.5rem; font-size: var(--step--1); cursor: pointer; min-height: 2.75rem; margin-right: var(--space-s); }
  .plotarea { display: block; touch-action: none; cursor: crosshair; user-select: none; -webkit-user-select: none; }
  .plotarea.is-dragging { cursor: grabbing; }
  .frame { fill: none; stroke: var(--rule-strong); }
  .grid { stroke: var(--rule); stroke-dasharray: 2 4; }
  .t { font-family: var(--font-mono); font-size: 11px; fill: var(--ink-3); }
  .fit { stroke: var(--accent); stroke-width: 2.5; }
  .res { stroke: var(--teal); stroke-width: 1.5; stroke-dasharray: 4 3; }
  .sq { fill: var(--accent-wash); stroke: var(--accent); stroke-width: 0.8; opacity: 0.9; }
  .pt { fill: var(--paper); stroke: var(--ink); stroke-width: 2; cursor: grab; }
  .pt--hi { stroke: var(--accent); stroke-width: 2.5; }
  .pt--on { fill: var(--ink); }
  .pt:focus-visible { outline: none; stroke: var(--focus); stroke-width: 3; }
</style>
