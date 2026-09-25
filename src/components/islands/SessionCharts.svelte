<script lang="ts">
  // Whole-session charts for Pl. VI: context over time against the model's window, and tool
  // calls by tool. Measured, not scaled (DESIGN.md §Charts), so labels stay legible on
  // phones. Data: src/data/trace/session-stats.json (counts only, no content).
  import { usable } from '../../lib/measure';
  import { linearScale, niceTicks } from '../../lib/scale';

  interface Stats {
    started: string; snapshot: string;
    modelCalls: number;
    toolCalls: { tool: string; n: number }[];
    context: { first: number; max: number; window: number; series: { h: number; c: number }[] };
  }
  const { stats }: { stats: Stats } = $props();

  let aRaw = $state(720), bRaw = $state(720);
  const W = $derived(usable(aRaw - 16, 720)), H = $derived(W < 480 ? 220 : 260);
  const pad = { l: 50, r: 14, t: 26, b: 30 };
  const last = $derived(stats.context.series.at(-1)!);
  const x = $derived(linearScale([0, Math.ceil(last.h)], [pad.l, W - pad.r]));
  const y = $derived(linearScale([0, stats.context.window], [H - pad.b, pad.t]));
  const line = $derived(stats.context.series.map((p, i) => `${i ? 'L' : 'M'}${x(p.h).toFixed(1)} ${y(p.c).toFixed(1)}`).join(''));
  const area = $derived(`${line} L${x(last.h).toFixed(1)} ${y(0)} L${x(0)} ${y(0)} Z`);
  const yt = [0, 250_000, 500_000, 750_000, 1_000_000];
  const xt = $derived(niceTicks(0, Math.ceil(last.h), W < 480 ? 3 : 6).filter((v) => Number.isInteger(v)));

  const B = $derived(usable(bRaw - 16, 720));
  const bh = 24, gap = 8, bl = 104;
  const maxN = $derived(Math.max(...stats.toolCalls.map((t) => t.n)));
  const bx = $derived(linearScale([0, maxN], [bl, B - 48]));
  const BH = $derived(stats.toolCalls.length * (bh + gap));
  const fmt = (n: number) => n.toLocaleString('en');
  const mins = $derived(Math.round((Date.parse(stats.snapshot) - Date.parse(stats.started)) / 60000));
</script>

<div class="session-charts">
  <figure class="fig">
    <div class="fig__plot" bind:clientWidth={aRaw}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`The session's context grew from ${fmt(stats.context.first)} to ${fmt(stats.context.max)} tokens in ${Math.floor(mins / 60)} hours ${mins % 60} minutes, against a window of ${fmt(stats.context.window)} tokens.`}>
        {#each yt as v}<line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} class="grid" /><text x={pad.l - 8} y={y(v) + 4} class="t" text-anchor="end">{v === 0 ? '0' : v === 1_000_000 ? '1M' : `${v / 1000}k`}</text>{/each}
        {#each xt as v}<text x={x(v)} y={H - pad.b + 20} class="t" text-anchor="middle">{v} h</text>{/each}
        <line x1={pad.l} x2={W - pad.r} y1={y(stats.context.window)} y2={y(stats.context.window)} class="window" />
        <text x={W - pad.r} y={y(stats.context.window) - 8} class="t t--em" text-anchor="end">window: {fmt(stats.context.window)}</text>
        <path d={area} class="area" />
        <path d={line} class="line" />
        <circle cx={x(last.h)} cy={y(stats.context.max)} r="4.5" class="dot" />
        <text x={x(last.h) - 10} y={y(stats.context.max) + 22} class="t t--em" text-anchor="end">{fmt(stats.context.max)}</text>
      </svg>
    </div>
    <figcaption class="fig__cap"><span class="fig__label">Fig. 3 · Context over the whole session</span> <span class="fig__note">Tokens the model reads at each of its {fmt(stats.modelCalls)} calls, from the first step to the snapshot. Dashed: the model's window.</span></figcaption>
  </figure>
  <figure class="fig">
    <div class="fig__plot" bind:clientWidth={bRaw}>
      <svg width={B} height={BH} viewBox={`0 0 ${B} ${BH}`} role="img" aria-label={`Tool calls by tool: ${stats.toolCalls.map((t) => `${t.tool} ${t.n}`).join(', ')}.`}>
        {#each stats.toolCalls as t, i}
          <text x={bl - 10} y={i * (bh + gap) + bh / 2 + 5} class="t t--tool" text-anchor="end">{t.tool}</text>
          <rect x={bl} y={i * (bh + gap)} width={Math.max(2, bx(t.n) - bl)} height={bh} class="bar" class:bar--agent={t.tool === 'Agent' || t.tool === 'SendMessage'} />
          <text x={bx(t.n) + 8} y={i * (bh + gap) + bh / 2 + 5} class="t t--em">{t.n}</text>
        {/each}
      </svg>
    </div>
    <figcaption class="fig__cap"><span class="fig__label">Fig. 4 · Tool calls by tool</span> <span class="fig__note">Every tool call in the session. Vermilion: calls that start or talk to a subagent.</span></figcaption>
  </figure>
</div>

<style>
  .session-charts { display: grid; gap: var(--space-l); }
  .grid { stroke: var(--rule); stroke-dasharray: 2 4; }
  .t { font-family: var(--font-mono); font-size: 11px; fill: var(--ink-3); }
  .t--em { fill: var(--ink); font-size: 12px; }
  .t--tool { fill: var(--ink-2); font-size: 12px; }
  .window { stroke: var(--rule-strong); stroke-dasharray: 6 5; stroke-width: 1.5; }
  .area { fill: var(--accent-wash); }
  .line { fill: none; stroke: var(--ink); stroke-width: 2; stroke-linejoin: round; }
  .dot { fill: var(--accent); }
  .bar { fill: var(--ink); opacity: 0.82; }
  .bar--agent { fill: var(--accent); opacity: 1; }
</style>
