<script lang="ts">
  // Plate VI: the agent loop, replayed from a real (abridged, sanitized) trace of the
  // Claude Code session that built this site. A loop diagram highlights where each step
  // happens; a card shows the step itself; a meter shows the context growing.
  import { onDestroy } from 'svelte';
  import { usable } from '../../lib/measure';
  import { linearScale, niceTicks } from '../../lib/scale';

  type Kind = 'prompt' | 'think' | 'say' | 'call' | 'result';
  interface Step { at: number; kind: Kind; ctx?: number; out?: number; text?: string; tool?: string; desc?: string; input?: string; output?: string; error?: boolean }
  interface Props { steps: Step[]; notes?: Record<number, string> }
  const { steps, notes = {} }: Props = $props();

  let i = $state(0);
  let playing = $state(false);
  let speed = $state(1);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const step = $derived(steps[i]);

  // Context in effect at each step: the last model call's context (results are added to
  // it on the next call, so a result step shows the context it will join).
  const ctxAt = $derived(steps.map((_, k) => { for (let j = k; j >= 0; j--) if (steps[j].ctx) return steps[j].ctx!; return steps.find((s) => s.ctx)?.ctx ?? 0; }));

  function go(k: number) { i = Math.max(0, Math.min(steps.length - 1, k)); }
  function tick() {
    if (i >= steps.length - 1) { playing = false; return; }
    go(i + 1);
    timer = setTimeout(tick, 1400 / speed);
  }
  function toggle() {
    if (playing) { playing = false; clearTimeout(timer); return; }
    if (i >= steps.length - 1) i = 0;
    playing = true; timer = setTimeout(tick, 600 / speed);
  }
  onDestroy(() => clearTimeout(timer));

  // ── Loop diagram geometry (fixed viewBox; it scales as a whole) ───────────────────────
  const N = {
    you: { x: 70, y: 70, label: 'You' },
    model: { x: 330, y: 70, label: 'Model' },
    tool: { x: 330, y: 300, label: 'Tools' },
    ctx: { x: 70, y: 300, label: 'Context' },
  };
  // Which node is active and which edge carries the step.
  const ACTIVE: Record<Kind, { node: keyof typeof N; edge: string }> = {
    prompt: { node: 'ctx', edge: 'you-ctx' },
    think: { node: 'model', edge: 'ctx-model' },
    say: { node: 'you', edge: 'model-you' },
    call: { node: 'tool', edge: 'model-tool' },
    result: { node: 'ctx', edge: 'tool-ctx' },
  };
  const EDGES: Record<string, string> = {
    'you-ctx': `M${N.you.x} ${N.you.y + 40} L${N.ctx.x} ${N.ctx.y - 40}`,
    'ctx-model': `M${N.ctx.x + 32} ${N.ctx.y - 30} C 150 190, 230 130, ${N.model.x - 32} ${N.model.y + 30}`,
    'model-you': `M${N.model.x - 42} ${N.model.y} L${N.you.x + 42} ${N.you.y}`,
    'model-tool': `M${N.model.x} ${N.model.y + 40} L${N.tool.x} ${N.tool.y - 40}`,
    'tool-ctx': `M${N.tool.x - 42} ${N.tool.y} L${N.ctx.x + 42} ${N.ctx.y}`,
  };
  const active = $derived(ACTIVE[step.kind]);
  const KIND_LABEL: Record<Kind, string> = { prompt: 'Prompt', think: 'Thinking', say: 'Says', call: 'Tool call', result: 'Tool result' };

  // ── Context meter ──────────────────────────────────────────────────────────────────
  let wRaw = $state(640);
  const w = $derived(usable(wRaw - 16, 640)), h = 150;
  const pad = { l: 58, r: 14, t: 12, b: 26 };
  const ctxMin = $derived(Math.min(...ctxAt.filter(Boolean)));
  const ctxMax = $derived(Math.max(...ctxAt));
  const mx = $derived(linearScale([0, steps.length - 1], [pad.l, w - pad.r]));
  const my = $derived(linearScale([Math.floor(ctxMin / 5000) * 5000, Math.ceil(ctxMax / 5000) * 5000], [h - pad.b, pad.t]));
  const myt = $derived(niceTicks(my.domain[0], my.domain[1], 4));
  const meter = $derived(ctxAt.map((c, k) => `${k ? 'L' : 'M'}${mx(k).toFixed(1)} ${my(c).toFixed(1)}`).join(''));
  const fmtN = (n: number) => n.toLocaleString('en');
</script>

<!-- Keyboard: the step slider below moves with the arrow keys (native range input). -->
<div class="loop" role="group" aria-label="Agent loop replay">
  <div class="controls">
    <div class="btn-row">
      <button type="button" class="btn btn--primary btn--sm play" onclick={toggle} aria-pressed={playing}>{playing ? 'Pause' : i >= steps.length - 1 ? 'Replay' : 'Play'}</button>
      <button type="button" class="btn btn--secondary btn--sm" onclick={() => go(i - 1)} disabled={i === 0} aria-label="Previous step">← Step</button>
      <button type="button" class="btn btn--secondary btn--sm" onclick={() => go(i + 1)} disabled={i === steps.length - 1} aria-label="Next step">Step →</button>
      <fieldset class="seg speed">
        <legend class="visually-hidden">Speed</legend>
        <div class="seg__row">
          {#each [1, 2, 4] as v}<label class="seg__opt"><input type="radio" name="speed" checked={speed === v} onchange={() => (speed = v)} />{v}×</label>{/each}
        </div>
      </fieldset>
    </div>
    <label class="control controls__wide">
      <span class="control__head"><span class="label">Step {i + 1} of {steps.length}</span><span class="control__value">t = {step.at.toFixed(1)} s</span></span>
      <input type="range" min="0" max={steps.length - 1} step="1" value={i} oninput={(e) => go(Number((e.currentTarget as HTMLInputElement).value))}
        style={`--fill:${(i / (steps.length - 1)) * 100}%`} aria-valuetext={`Step ${i + 1}: ${KIND_LABEL[step.kind]}`} />
    </label>
  </div>

  <div class="loop__main">
    <figure class="fig">
      <div class="fig__plot">
        <svg viewBox="0 0 400 370" class="diagram" role="img" aria-label={`Loop diagram: the current step goes from ${active.edge.replace('-', ' to ')}.`}>
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" class="arrowhead" /></marker>
            <marker id="arrow-on" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" class="arrowhead arrowhead--on" /></marker>
          </defs>
          {#each Object.entries(EDGES) as [id, d]}
            <path {d} class="edge" class:edge--on={active.edge === id} marker-end={active.edge === id ? 'url(#arrow-on)' : 'url(#arrow)'} />
          {/each}
          {#key i}{#if EDGES[active.edge]}<circle r="6" class="pulse"><animateMotion dur="0.9s" fill="freeze" path={EDGES[active.edge]} /></circle>{/if}{/key}
          {#each Object.entries(N) as [id, n]}
            <g class="node" class:node--on={active.node === id}>
              <circle cx={n.x} cy={n.y} r="38" />
              <text x={n.x} y={n.y + 5} text-anchor="middle">{n.label}</text>
            </g>
          {/each}
          <text x="200" y="358" text-anchor="middle" class="caption-t">Claude Code runs each approved tool call and appends the result.</text>
        </svg>
      </div>
      <figcaption class="fig__cap"><span class="fig__label">Fig. 1 · The loop</span> <span class="fig__note">Vermilion: where the current step happens.</span></figcaption>
    </figure>

    <article class="card" aria-live="polite">
      <p class="card__kind"><span class="label card__label">{KIND_LABEL[step.kind]}{step.tool ? ` · ${step.tool}` : ''}</span> <span class="label">{fmtN(ctxAt[i])} tokens in context</span></p>
      {#if step.kind === 'prompt'}
        <p class="card__lead">The user starts the session with one command:</p>
        <pre class="card__code">{step.text}</pre>
        <p class="card__note">That expands into a written procedure. With the system instructions, the tool definitions and the project's notes, the model's context holds {fmtN(steps.find((s) => s.ctx)?.ctx ?? 0)} tokens before it has done anything.</p>
      {:else if step.kind === 'think'}
        <p class="card__lead">The model reads the whole context and decides what to do next.</p>
        <p class="card__note">Its private reasoning isn't shown here. This turn produced {fmtN(step.out ?? 0)} output tokens, counting the tool call that follows.</p>
      {:else if step.kind === 'say'}
        <p class="card__lead">A progress note to the user:</p>
        <blockquote class="card__quote">{step.text}</blockquote>
      {:else if step.kind === 'call'}
        <p class="card__lead">{step.desc || 'The model asks the harness to run a tool.'}</p>
        <pre class="card__code">{step.input}</pre>
        <p class="card__note">The model only writes the request. Claude Code runs it, subject to the session's permission settings.</p>
      {:else}
        <p class="card__lead">{step.error ? 'The tool reports an error' : 'The output comes back'} and is added to the context.</p>
        <pre class="card__code card__code--out">{step.output || '(no output)'}</pre>
      {/if}
      {#if notes[i]}<p class="card__gloss"><span class="label">Note</span> {notes[i]}</p>{/if}
    </article>
  </div>

  <figure class="fig">
    <div class="fig__plot" bind:clientWidth={wRaw}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Context size across the ${steps.length} steps: from ${fmtN(ctxMin)} to ${fmtN(ctxMax)} tokens.`}>
        {#each myt as v}<line x1={pad.l} x2={w - pad.r} y1={my(v)} y2={my(v)} class="grid" /><text x={pad.l - 8} y={my(v) + 4} class="t" text-anchor="end">{(v / 1000).toFixed(0)}k</text>{/each}
        <path d={meter} class="meter" />
        {#each steps as s, k}{#if s.kind === 'call'}<line x1={mx(k)} x2={mx(k)} y1={h - pad.b} y2={h - pad.b + 5} class="tick" />{/if}{/each}
        <line x1={mx(i)} x2={mx(i)} y1={pad.t} y2={h - pad.b} class="now" />
        <circle cx={mx(i)} cy={my(ctxAt[i])} r="5" class="dot" />
        <text x={pad.l} y={h - 6} class="t">step 1</text><text x={w - pad.r} y={h - 6} class="t" text-anchor="end">step {steps.length}</text>
      </svg>
    </div>
    <figcaption class="fig__cap"><span class="fig__label">Fig. 2 · Context during this task</span> <span class="fig__note">Tokens the model reads at each step. Ticks: tool calls. Vermilion: the current step.</span></figcaption>
  </figure>
</div>

<style>
  .loop { display: grid; gap: var(--space-m); }
  .play { min-width: 6rem; }
  .speed { margin-left: auto; }
  .loop__main { display: grid; grid-template-columns: minmax(0, 22rem) minmax(0, 1fr); gap: var(--space-l); align-items: start; }
  .diagram { width: 100%; height: auto; }
  .edge { fill: none; stroke: var(--rule-strong); stroke-width: 1.5; }
  .edge--on { stroke: var(--accent); stroke-width: 3; }
  .arrowhead { fill: var(--rule-strong); }
  .arrowhead--on { fill: var(--accent); }
  .pulse { fill: var(--accent); }
  .node circle { fill: var(--paper-raised); stroke: var(--ink); stroke-width: 1.5; }
  .node text { font-family: var(--font-mono); font-size: 12px; fill: var(--ink); }
  .node--on circle { fill: var(--accent-wash); stroke: var(--accent); stroke-width: 2.5; }
  .caption-t { font-family: var(--font-text); font-style: italic; font-size: 12px; fill: var(--ink-3); }
  .card { display: grid; gap: var(--space-xs); padding: var(--space-m); background: var(--paper-raised); border: var(--hair) solid var(--rule); border-left: 3px solid var(--accent); min-height: 18rem; align-content: start; min-width: 0; }
  .card__kind { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0.3rem 1rem; }
  .card__label { color: var(--accent-ink); }
  .card__lead { font-size: var(--step-0); }
  .card__note { font-size: var(--step--1); color: var(--ink-2); font-style: italic; }
  .card__quote { border-left: var(--stroke) solid var(--rule-strong); padding-left: var(--space-s); color: var(--ink-2); font-style: italic; }
  .card__code { font-family: var(--font-mono); font-size: var(--step--2); line-height: 1.55; background: var(--code-bg); border: var(--hair) solid var(--rule); padding: var(--space-xs) var(--space-s); white-space: pre-wrap; overflow-wrap: anywhere; max-height: 14rem; overflow: auto; margin: 0; }
  .card__code--out { color: var(--ink-2); }
  .card__gloss { font-size: var(--step--1); border-top: var(--hair) dashed var(--rule); padding-top: var(--space-2xs); }
  .card__gloss .label { color: var(--teal-ink); margin-right: 0.4rem; }
  .grid { stroke: var(--rule); stroke-dasharray: 2 4; }
  .t { font-family: var(--font-mono); font-size: 11px; fill: var(--ink-3); }
  .meter { fill: none; stroke: var(--ink); stroke-width: 2; stroke-linejoin: round; }
  .tick { stroke: var(--teal); stroke-width: 1.5; }
  .now { stroke: var(--accent); stroke-dasharray: 3 3; }
  .dot { fill: var(--accent); }
  @media (max-width: 52rem) { .loop__main { grid-template-columns: minmax(0, 1fr); } .diagram { max-width: 22rem; margin-inline: auto; display: block; } .speed { margin-left: 0; } }
  @media (prefers-reduced-motion: reduce) { .pulse { display: none; } }
</style>
