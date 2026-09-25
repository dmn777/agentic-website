<script lang="ts">
  import { usable } from '../../lib/measure';
  // Plate V: a scrollytelling story over NOAA's Mauna Loa CO₂ record. A sticky chart morphs
  // between views as the text steps scroll past. Server-rendered on the full-record view,
  // so the article reads (and shows a meaningful chart) without JavaScript. Under reduced
  // motion, views switch instantly.
  import { onMount } from 'svelte';
  import { Tween } from 'svelte/motion';
  import { cubicInOut } from 'svelte/easing';
  import { linearScale, niceTicks } from '../../lib/scale';

  type View = 'first' | 'years' | 'cycle' | 'record' | 'decades' | 'now' | 'gap';
  interface Step { id: string; view: View; html: string }
  interface Props {
    steps: Step[];
    t: number[]; ppm: number[]; trend: number[];
    cycle: number[]; decades: { label: string; value: number; partial?: boolean }[];
    facts: { first: number; y1959: number; y2025: number; peak: number; peakT: number; peakLabel: string };
  }
  const { steps, t, ppm, trend, cycle, decades, facts }: Props = $props();

  // svelte-ignore state_referenced_locally
  const FULL_STEP = steps.findIndex((s) => s.view === 'record'); // steps never change
  let active = $state(FULL_STEP);           // SSR / no-JS: the full record
  let wRaw = $state(640), hRaw = $state(480);
  const w = $derived(usable(wRaw, 640)), h = $derived(Math.max(260, usable(hRaw, 480)));
  const view = $derived(steps[active]?.view ?? 'record');

  const DOMAINS: Record<View, { x: [number, number]; y: [number, number] }> = {
    first: { x: [1958, 1959.5], y: [312, 320] },
    years: { x: [1958.1, 1961.6], y: [311, 322] },
    cycle: { x: [1958, 2027], y: [300, 440] },
    record: { x: [1958, 2027], y: [305, 440] },
    decades: { x: [1958, 2027], y: [305, 440] },
    now: { x: [1958, 2027], y: [270, 445] },
    gap: { x: [2021.6, 2024.6], y: [410, 428] },
  };
  let reduced = false;
  const dur = () => (reduced ? 0 : 900);
  const xd = new Tween<[number, number]>(DOMAINS.record.x, { duration: 900, easing: cubicInOut });
  const yd = new Tween<[number, number]>(DOMAINS.record.y, { duration: 900, easing: cubicInOut });
  $effect(() => {
    const d = DOMAINS[view];
    xd.set(d.x, { duration: dur() });
    yd.set(d.y, { duration: dur() });
  });

  const pad = $derived({ l: 46, r: 16, t: 18, b: 34 });
  const x = $derived(linearScale(xd.current, [pad.l, w - pad.r]));
  const y = $derived(linearScale(yd.current, [h - pad.b, pad.t]));
  // Short spans get calendar ticks (years and "Jul"), never fractional years like 1958.3.
  const xt = $derived.by(() => {
    const [a, b] = xd.current;
    if (b - a > 6) return niceTicks(a, b, w < 480 ? 4 : 7).filter((v) => v >= a && v <= b).map((v) => ({ v, label: String(Math.round(v)) }));
    const out: { v: number; label: string }[] = [];
    for (let yr = Math.floor(a); yr <= b; yr++) {
      if (yr >= a) out.push({ v: yr, label: String(yr) });
      if (yr + 0.5 >= a && yr + 0.5 <= b && w >= 420) out.push({ v: yr + 0.5, label: 'Jul' });
    }
    return out;
  });
  const yt = $derived(niceTicks(yd.current[0], yd.current[1], 5).filter((v) => v >= yd.current[0] && v <= yd.current[1]));
  const lastIndex = $derived(view === 'first' ? 1 : t.length);
  const path = (vals: number[]) => {
    let d = '', started = false;
    const [a, b] = xd.current;
    for (let i = 0; i < lastIndex; i++) {
      if (t[i] < a - 0.2 || t[i] > b + 0.2) { started = false; continue; }
      d += `${started ? 'L' : 'M'}${x(t[i]).toFixed(1)} ${y(vals[i]).toFixed(1)}`;
      started = true;
    }
    return d;
  };
  const monthly = $derived(path(ppm));
  const smooth = $derived(path(trend));
  const showTrend = $derived(view === 'record' || view === 'now');
  const lineOpacity = $derived(view === 'cycle' || view === 'decades' ? 0 : 1);

  // Cycle view: Jan..Dec departures.
  const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
  const cx = $derived(linearScale([0.5, 12.5], [pad.l, w - pad.r]));
  const cy = $derived(linearScale([-4, 4], [h - pad.b, pad.t]));
  const cyclePath = $derived(cycle.map((v, i) => `${i ? 'L' : 'M'}${cx(i + 1).toFixed(1)} ${cy(v).toFixed(1)}`).join(''));
  const peakI = $derived(cycle.indexOf(Math.max(...cycle)));
  const troughI = $derived(cycle.indexOf(Math.min(...cycle)));

  // Decades view.
  const dMax = $derived(Math.max(...decades.map((d) => d.value)) * 1.18);
  const bx = $derived(linearScale([0, decades.length], [pad.l, w - pad.r]));
  const by = $derived(linearScale([0, dMax], [h - pad.b, pad.t]));

  // DESIGN.md §Charts: every mark is explained in the caption.
  const CAPTION: Record<View, { title: string; key: string }> = {
    first: { title: 'Monthly mean CO₂ at Mauna Loa, ppm', key: 'The first monthly average.' },
    years: { title: 'Monthly mean CO₂ at Mauna Loa, ppm', key: 'One point per month, 1958–1961.' },
    cycle: { title: 'The average seasonal cycle, 1958–2026', key: 'Each month’s average distance above or below the trend.' },
    record: { title: 'Monthly mean CO₂ at Mauna Loa, ppm', key: 'Black: monthly means. Vermilion: NOAA’s deseasonalised trend.' },
    decades: { title: 'Average annual growth by decade, ppm/yr (NOAA)', key: 'Outlined: 2020–25, a decade still in progress.' },
    now: { title: 'Monthly mean CO₂ at Mauna Loa, ppm', key: 'Black: monthly means. Vermilion: trend. Dashed teal: about 280 ppm before industrialisation.' },
    gap: { title: 'Monthly mean CO₂, 2021–2024, ppm', key: 'Teal band: months measured at Maunakea while Mauna Loa was closed.' },
  };
  let stepEls: HTMLElement[] = [];
  onMount(() => {
    reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // The step whose card is in the reading zone drives the chart. On desktop that zone is
    // the middle of the viewport. On phones the chart is sticky over the top ~half, so the
    // zone is the band just below it (50–75 %); cards under the chart don't count.
    let io: IntersectionObserver | undefined;
    const narrow = window.matchMedia('(max-width: 52rem)');
    const observe = () => {
      io?.disconnect();
      io = new IntersectionObserver((es) => {
        for (const e of es) if (e.isIntersecting) active = Number((e.target as HTMLElement).dataset.i);
        aboveStory();
      }, { rootMargin: narrow.matches ? '-50% 0px -25% 0px' : '-45% 0px -45% 0px' });
      stepEls.forEach((el) => io!.observe(el));
      aboveStory();
    };
    // Above the story (first card still below the reading zone) the chart shows step 0,
    // matching the first text a reader sees, instead of whichever step was last active.
    const aboveStory = () => {
      const first = stepEls[0]?.getBoundingClientRect();
      if (first && first.top > innerHeight * (narrow.matches ? 0.75 : 0.55)) active = 0;
    };
    const onScroll = () => requestAnimationFrame(aboveStory);
    window.addEventListener('scroll', onScroll, { passive: true });
    observe();
    narrow.addEventListener('change', observe);
    return () => { io?.disconnect(); narrow.removeEventListener('change', observe); window.removeEventListener('scroll', onScroll); };
  });
  const fmt = (v: number, d = 2) => v.toFixed(d);
</script>

<div class="story" data-step={active} data-view={view}>
  <div class="story__figure" bind:clientWidth={wRaw} bind:clientHeight={hRaw}>
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Chart: ${steps[active]?.html.replace(/<[^>]+>/g, '').slice(0, 160)}`}>
      <defs><clipPath id="plotarea"><rect x={pad.l} y={pad.t - 4} width={w - pad.l - pad.r} height={h - pad.t - pad.b + 8} /></clipPath></defs>

      <g class="layer" class:is-hidden={view === 'cycle' || view === 'decades'}>
        {#each yt as v}<line x1={pad.l} x2={w - pad.r} y1={y(v)} y2={y(v)} class="grid" /><text x={pad.l - 8} y={y(v) + 4} class="t" text-anchor="end">{v}</text>{/each}
        {#each xt as tk}<text x={x(tk.v)} y={h - pad.b + 20} class="t" text-anchor="middle">{tk.label}</text>{/each}
        <line x1={pad.l} x2={w - pad.r} y1={h - pad.b} y2={h - pad.b} class="axis" />
      </g>

      <g clip-path="url(#plotarea)">
        {#if view === 'gap'}
          <rect x={x(2022.92)} y={pad.t} width={Math.max(0, x(2023.51) - x(2022.92))} height={h - pad.t - pad.b} class="band" />
          <text x={x(2023.2)} y={pad.t + 16} class="t t--band" text-anchor="middle">Maunakea</text>
        {/if}
        {#if view === 'now'}
          <line x1={pad.l} x2={w - pad.r} y1={y(280)} y2={y(280)} class="ref" />
          <text x={w - pad.r - 4} y={y(280) - 8} class="t t--ref" text-anchor="end">≈ 280 ppm before industrialisation</text>
        {/if}
        <path d={monthly} class="line" style={`opacity:${lineOpacity}`} />
        {#if showTrend}<path d={smooth} class="trend" />{/if}
        {#if view === 'first'}
          <circle cx={x(t[0])} cy={y(ppm[0])} r="7" class="dot" />
          <text x={x(t[0]) + 14} y={y(ppm[0]) + 5} class="t t--big">{fmt(facts.first)} ppm · March 1958</text>
        {/if}
        {#if view === 'now'}
          <!-- The line rises left to right: below-right of 1959 and above-left of 2025 are clear. -->
          <circle cx={x(1959.5)} cy={y(facts.y1959)} r="5" class="dot" />
          <text x={x(1959.5) + 8} y={y(facts.y1959) + 24} class="t t--big t--halo">1959: {fmt(facts.y1959)}</text>
          <circle cx={x(2025.5)} cy={y(facts.y2025)} r="5" class="dot" />
          <!-- Straight below the 2025 point the plot is empty (the curve lies up and to the
               left), so its label hangs there on a leader line. -->
          <line x1={x(2025.5)} x2={x(2025.5)} y1={y(facts.y2025) + 8} y2={y(facts.y2025 - 62)} class="leader" />
          <text x={x(2025.5) + 4} y={y(facts.y2025 - 62) + 16} class="t t--big t--halo" text-anchor="end">2025 average: {fmt(facts.y2025)}</text>
          <circle cx={x(facts.peakT)} cy={y(facts.peak)} r="7" class="ring" />
          <text x={x(facts.peakT) - 14} y={y(facts.peak) - 6} class="t t--big t--halo" text-anchor="end">Highest month: {fmt(facts.peak)} ({facts.peakLabel})</text>
        {/if}
      </g>

      <g class="layer" class:is-hidden={view !== 'cycle'}>
        <line x1={pad.l} x2={w - pad.r} y1={cy(0)} y2={cy(0)} class="axis" />
        {#each [-4, -2, 0, 2, 4] as v}<text x={pad.l - 8} y={cy(v) + 4} class="t" text-anchor="end">{v > 0 ? '+' : ''}{v}</text>{/each}
        {#each MONTHS as m, i}<text x={cx(i + 1)} y={h - pad.b + 20} class="t" text-anchor="middle">{m}</text>{/each}
        <path d={cyclePath} class="cycle" />
        {#each cycle as v, i}<circle cx={cx(i + 1)} cy={cy(v)} r={i === peakI || i === troughI ? 6 : 3.5} class="cdot" class:cdot--key={i === peakI || i === troughI} />{/each}
        <text x={cx(peakI + 1)} y={cy(cycle[peakI]) - 14} class="t t--big" text-anchor="middle">May +{fmt(cycle[peakI], 1)}</text>
        <text x={cx(troughI + 1)} y={cy(cycle[troughI]) + 26} class="t t--big" text-anchor="middle">Oct {fmt(cycle[troughI], 1)}</text>
        <text x={pad.l} y={pad.t - 2} class="t">ppm above or below the trend</text>
      </g>

      <g class="layer" class:is-hidden={view !== 'decades'}>
        <line x1={pad.l} x2={w - pad.r} y1={by(0)} y2={by(0)} class="axis" />
        {#each decades as d, i}
          {@const bw = (bx(1) - bx(0)) * 0.62}
          <rect x={bx(i + 0.5) - bw / 2} y={by(d.value)} width={bw} height={by(0) - by(d.value)} class="bar" class:bar--partial={d.partial} />
          <text x={bx(i + 0.5)} y={by(d.value) - 8} class="t t--big" text-anchor="middle">{fmt(d.value, 1)}</text>
          <text x={bx(i + 0.5)} y={h - pad.b + 20} class="t" text-anchor="middle">{d.label}</text>
        {/each}
        <text x={pad.l} y={pad.t - 2} class="t">average growth, ppm per year</text>
      </g>
    </svg>
    <p class="story__caption"><span class="label">Fig. 1 · {CAPTION[view].title}</span> <span class="story__key">{CAPTION[view].key}</span></p>
  </div>

  <ol class="story__steps">
    {#each steps as s, i}
      <li class="step" class:is-active={i === active}>
        <div class="step__card" data-i={i} bind:this={stepEls[i]}>{@html s.html}</div>
      </li>
    {/each}
  </ol>
</div>

<style>
  .story { position: relative; display: grid; grid-template-columns: minmax(0, 20rem) minmax(0, 1fr); gap: var(--space-xl); }
  .story__figure {
    grid-column: 2; grid-row: 1; position: sticky; top: 12vh; height: 74vh; min-height: 22rem;
    display: grid; grid-template-rows: minmax(0, 1fr) auto; background: var(--paper-raised); border: var(--hair) solid var(--rule); padding: var(--space-s);
  }
  .story__figure svg { display: block; width: 100%; height: 100%; overflow: visible; }
  .story__caption { padding-top: var(--space-2xs); display: flex; flex-wrap: wrap; gap: 0.2rem 0.8rem; align-items: baseline; }
  .story__caption .label { color: var(--accent-ink); }
  .story__key { font-size: var(--step--1); font-style: italic; color: var(--ink-2); }
  .story__steps { grid-column: 1; grid-row: 1; list-style: none; padding: 0; margin: 0; }
  .step { min-height: 78vh; display: flex; align-items: center; }
  .step:first-child { min-height: 60vh; align-items: flex-start; padding-top: 10vh; }
  .step:last-child { min-height: 70vh; }
  .step__card { font-size: var(--step-0); line-height: var(--leading-body); border-left: 3px solid var(--rule); padding: var(--space-2xs) 0 var(--space-2xs) var(--space-m); transition: border-color var(--dur-ui), opacity var(--dur-ui); opacity: 0.55; }
  .step.is-active .step__card { border-left-color: var(--accent); opacity: 1; }
  .step__card :global(strong) { font-weight: 640; }
  .step__card :global(.num) { font-family: var(--font-mono); font-size: 0.9em; font-variant-numeric: tabular-nums; }
  .layer { transition: opacity 500ms var(--ease-out); }
  .layer.is-hidden { opacity: 0; pointer-events: none; }
  .grid { stroke: var(--rule); stroke-dasharray: 2 4; }
  .axis { stroke: var(--rule-strong); }
  .t { font-family: var(--font-mono); font-size: 11px; fill: var(--ink-3); }
  .t--big { font-size: 13px; fill: var(--ink); font-weight: 500; }
  .t--band { fill: var(--teal-ink); }
  .t--halo { paint-order: stroke; stroke: var(--paper-raised); stroke-width: 4px; stroke-linejoin: round; }
  .t--ref { fill: var(--ink-2); }
  .line { fill: none; stroke: var(--ink); stroke-width: 1.3; stroke-linejoin: round; transition: opacity 500ms; }
  .trend { fill: none; stroke: var(--accent); stroke-width: 2.4; }
  .dot { fill: var(--accent); }
  .ring { fill: none; stroke: var(--accent); stroke-width: 2.5; }
  .leader { stroke: var(--ink-3); stroke-width: 1; }
  .band { fill: var(--teal-wash); }
  .ref { stroke: var(--teal); stroke-dasharray: 6 5; stroke-width: 1.5; }
  .cycle { fill: none; stroke: var(--ink); stroke-width: 2; }
  .cdot { fill: var(--paper-raised); stroke: var(--ink); stroke-width: 1.5; }
  .cdot--key { fill: var(--accent); stroke: var(--accent); }
  .bar { fill: var(--ink); opacity: 0.82; }
  .bar--partial { fill: none; stroke: var(--ink); stroke-dasharray: 4 3; opacity: 1; }
  @media (prefers-reduced-motion: reduce) { .layer, .line, .step__card { transition: none; } }
  @media (max-width: 52rem) {
    .story { grid-template-columns: minmax(0, 1fr); gap: 0; }
    .story__figure { grid-column: 1; top: var(--space-2xs); height: 46vh; min-height: 16rem; z-index: 3; padding: var(--space-2xs); }
    /* Cards slide under the sticky chart, so the chart is never covered while reading. */
    .story__steps { grid-column: 1; grid-row: 2; position: relative; z-index: 1; }
    .step, .step:first-child, .step:last-child { min-height: 70vh; padding-top: 0; align-items: flex-start; }
    .step__card { background: var(--paper-raised); border: var(--hair) solid var(--rule); border-left-width: 3px; padding: var(--space-s) var(--space-m); opacity: 1; box-shadow: 0 6px 18px -10px color-mix(in srgb, var(--ink) 40%, transparent); }
    .step { padding-top: 2vh; }
  }
</style>
