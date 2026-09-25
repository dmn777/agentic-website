<script lang="ts">
  // Plate IV: the generative gallery. Thumbnails are drawn once, when they scroll into view,
  // and animate only while hovered or focused. The detail view (a <dialog>) animates,
  // exposes each piece's parameters, regenerates with a new seed (kept in the URL hash)
  // and exports a PNG. Reduced motion: stills only. Pieces live in src/lib/art (tested).
  import { onMount } from 'svelte';
  import { PIECES, pieceById } from '../../lib/art/pieces';
  import { defaults, type Instance, type Palette, type Piece } from '../../lib/art/types';
  import { tokenColor, onThemeChange, prefersReducedMotion } from '../../scripts/theme';

  let pal: Palette | null = null;
  let reduced = false;
  const thumbs: HTMLCanvasElement[] = [];
  const insts: (Instance | null)[] = PIECES.map(() => null);
  let hoverRaf = 0;

  // Detail view state
  let dialog: HTMLDialogElement;
  let big: HTMLCanvasElement;
  let current = $state<Piece | null>(null);
  let seed = $state(0);
  let params = $state<Record<string, number>>({});
  let playing = $state(false);
  let raf = 0, timer: ReturnType<typeof setTimeout> | undefined;
  let bigInst: Instance | null = null;

  const readPalette = (): Palette => ({
    paper: tokenColor('--paper'), paperRaised: tokenColor('--paper-raised'), ink: tokenColor('--ink'), ink2: tokenColor('--ink-2'),
    ink3: tokenColor('--ink-3'), accent: tokenColor('--accent'), teal: tokenColor('--teal'), ochre: tokenColor('--ochre'), rule: tokenColor('--rule'),
  });

  function sized(canvas: HTMLCanvasElement) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(40, canvas.clientWidth), h = Math.round(w * 0.75);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h };
  }

  function drawThumb(i: number) {
    if (!pal) return;
    const p = PIECES[i], { ctx, w, h } = sized(thumbs[i]);
    insts[i] = p.make({ w, h, seed: p.seed, params: defaults(p), pal });
    insts[i]!.still(ctx);
    thumbs[i].dataset.drawn = '1';
  }

  function hover(i: number, on: boolean) {
    cancelAnimationFrame(hoverRaf);
    const inst = insts[i];
    if (!inst || !pal) return;
    const ctx = thumbs[i].getContext('2d')!;
    if (!on || reduced) { drawThumb(i); return; }
    const p = PIECES[i], c = thumbs[i];
    const fresh = p.make({ w: c.clientWidth, h: Math.round(c.clientWidth * 0.75), seed: p.seed, params: defaults(p), pal });
    const t0 = performance.now();
    const tick = (now: number) => { if (fresh.frame(ctx, (now - t0) / 1000)) hoverRaf = requestAnimationFrame(tick); };
    hoverRaf = requestAnimationFrame(tick);
  }

  // ── Detail view ──────────────────────────────────────────────────────────────────────
  function open(p: Piece, s = p.seed, fromHash = false) {
    current = p; seed = s; params = defaults(p);
    if (!dialog.open) dialog.showModal();
    if (!fromHash) writeHash();
    requestAnimationFrame(() => rebuild(true));
  }
  function close() { dialog.close(); }
  function onClose() {
    cancelAnimationFrame(raf); playing = false; current = null;
    history.replaceState(null, '', location.pathname + location.search);
  }
  function writeHash() { if (current) history.replaceState(null, '', `#art=${current.id}&seed=${seed}`); }
  function rebuild(animate: boolean) {
    if (!current || !pal || !big) return;
    cancelAnimationFrame(raf);
    const { ctx, w, h } = sized(big);
    bigInst = current.make({ w, h, seed, params: { ...params }, pal });
    if (!animate || reduced) { bigInst.still(ctx); playing = false; return; }
    playing = true;
    const t0 = performance.now();
    const tick = (now: number) => {
      if (!bigInst || !dialog.open) return;
      if (bigInst.frame(ctx, (now - t0) / 1000) && !document.hidden) raf = requestAnimationFrame(tick);
      else { playing = false; if (!document.hidden) bigInst.still(ctx); }
    };
    raf = requestAnimationFrame(tick);
  }
  function regenerate() { seed = Math.floor(Math.random() * 1_000_000); writeHash(); rebuild(true); }
  function setParam(k: string, v: number) {
    params[k] = v;
    clearTimeout(timer);
    timer = setTimeout(() => rebuild(false), 90); // params redraw as stills; Replay animates
  }
  function stop() { cancelAnimationFrame(raf); playing = false; bigInst?.still(big.getContext('2d')!); }
  function download() {
    if (!current) return;
    big.toBlob((b) => {
      if (!b) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(b);
      a.download = `unattended-${current!.id}-seed${seed}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, 'image/png');
  }

  onMount(() => {
    reduced = prefersReducedMotion();
    pal = readPalette();
    const io = new IntersectionObserver((es) => {
      for (const e of es) if (e.isIntersecting) { const i = thumbs.indexOf(e.target as HTMLCanvasElement); if (i >= 0 && !thumbs[i].dataset.drawn) setTimeout(() => drawThumb(i), 0); io.unobserve(e.target); }
    }, { rootMargin: '200px' });
    thumbs.forEach((c) => io.observe(c));
    const offTheme = onThemeChange(() => {
      pal = readPalette();
      thumbs.forEach((c, i) => { if (c.dataset.drawn) drawThumb(i); });
      if (current) rebuild(false);
    });
    const m = location.hash.match(/art=([\w-]+)(?:&seed=(\d+))?/);
    if (m && pieceById(m[1])) open(pieceById(m[1])!, m[2] ? Number(m[2]) : pieceById(m[1])!.seed, true);
    const onVis = () => { if (document.hidden) cancelAnimationFrame(raf); };
    document.addEventListener('visibilitychange', onVis);
    return () => { io.disconnect(); offTheme(); document.removeEventListener('visibilitychange', onVis); cancelAnimationFrame(raf); cancelAnimationFrame(hoverRaf); };
  });
</script>

<ul class="gallery" role="list" data-qa-canvas>
  {#each PIECES as p, i}
    <li class="piece">
      <button type="button" class="piece__frame crop" aria-label={`Open “${p.title}”: ${p.description}`}
        onclick={() => open(p)} onmouseenter={() => hover(i, true)} onmouseleave={() => hover(i, false)}
        onfocus={() => hover(i, true)} onblur={() => hover(i, false)}>
        <canvas bind:this={thumbs[i]} class="piece__canvas" width="400" height="300"></canvas>
      </button>
      <div class="piece__text">
        <p class="label piece__n">No. {i + 1} · {p.technique}</p>
        <h2 class="piece__title">{p.title}</h2>
        <p class="piece__desc">{p.description}</p>
      </div>
    </li>
  {/each}
</ul>
<noscript><p class="muted">Each drawing is made in your browser by a small program, so this gallery needs JavaScript.</p></noscript>

<dialog bind:this={dialog} class="detail" onclose={onClose} aria-labelledby="detail-title">
  {#if current}
    <div class="detail__inner">
      <header class="detail__head">
        <div>
          <p class="label">{current.technique} · seed {seed}</p>
          <h2 id="detail-title" class="detail__title">{current.title}</h2>
        </div>
        <button type="button" class="detail__close" onclick={close} aria-label="Close">×</button>
      </header>
      <div class="detail__body">
        <canvas bind:this={big} class="detail__canvas" width="800" height="600" role="img" aria-label={`${current.title}: ${current.description}`}></canvas>
        <aside class="detail__side">
          <p class="detail__desc">{current.description}</p>
          {#each current.params as q}
            <label class="control">
              <span class="control__head"><span class="label">{q.label}</span><span class="control__value">{params[q.key]}{q.unit ?? ''}</span></span>
              <input type="range" min={q.min} max={q.max} step={q.step} value={params[q.key]}
                style={`--fill:${((params[q.key] - q.min) / (q.max - q.min)) * 100}%`}
                oninput={(e) => setParam(q.key, Number((e.currentTarget as HTMLInputElement).value))} />
            </label>
          {/each}
          <div class="detail__actions">
            <button type="button" class="b b--ink" onclick={regenerate}>New seed</button>
            {#if !reduced}
              {#if playing}<button type="button" class="b" onclick={stop}>Finish</button>{:else}<button type="button" class="b" onclick={() => rebuild(true)}>Replay</button>{/if}
            {/if}
            <button type="button" class="b" onclick={download}>Download PNG</button>
          </div>
          <p class="detail__note muted">The address bar now holds this seed: copy it to share exactly this drawing.</p>
        </aside>
      </div>
    </div>
  {/if}
</dialog>

<style>
  .gallery { list-style: none; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(17rem, 1fr)); gap: var(--space-xl) var(--space-l); }
  .piece { display: grid; gap: var(--space-s); align-content: start; }
  .piece__frame { display: block; width: 100%; padding: 0; border: var(--hair) solid var(--rule); background: var(--paper-raised); cursor: zoom-in; }
  .piece__frame:hover { border-color: var(--rule-strong); }
  .piece__frame:hover::before, .piece__frame:focus-visible::before { --crop-gap: 10px; --crop-color: var(--accent); }
  .piece__canvas { display: block; width: 100%; height: auto; aspect-ratio: 4 / 3; }
  .piece__n { color: var(--accent-ink); }
  .piece__title { font-size: var(--step-2); line-height: 1; margin: 0.15rem 0 0.35rem; }
  .piece__desc { color: var(--ink-2); font-size: var(--step--1); line-height: 1.5; max-width: 34ch; }

  .detail { padding: 0; border: var(--stroke) solid var(--ink); background: var(--paper); color: var(--ink); width: min(96vw, 76rem); max-height: 94vh; }
  .detail::backdrop { background: color-mix(in srgb, var(--ink) 55%, transparent); }
  .detail__inner { padding: var(--space-m); display: grid; gap: var(--space-m); }
  .detail__head { display: flex; justify-content: space-between; align-items: start; gap: 1rem; border-bottom: var(--hair) solid var(--rule); padding-bottom: var(--space-s); }
  .detail__head .label { color: var(--accent-ink); }
  .detail__title { font-size: var(--step-3); line-height: 1; }
  .detail__close { flex: none; font: 400 2rem/1 var(--font-text); width: 2.75rem; height: 2.75rem; border: var(--hair) solid var(--rule-strong); background: transparent; color: var(--ink); cursor: pointer; }
  .detail__close:hover { border-color: var(--ink); }
  .detail__body { display: grid; grid-template-columns: minmax(0, 1fr) minmax(14rem, 18rem); gap: var(--space-l); align-items: start; }
  .detail__canvas { width: 100%; height: auto; aspect-ratio: 4 / 3; display: block; border: var(--hair) solid var(--rule); }
  .detail__side { display: grid; gap: var(--space-m); }
  .detail__desc { font-style: italic; color: var(--ink-2); }
  .detail__actions { display: flex; flex-wrap: wrap; gap: var(--space-2xs); }
  .detail__note { font-size: var(--step--1); }
  .b {
    font-family: var(--font-mono); font-size: var(--step--1); min-height: 2.75rem; padding: 0.5rem 0.95rem; cursor: pointer;
    background: var(--paper); color: var(--ink); border: var(--stroke) solid var(--ink); border-radius: var(--radius);
    box-shadow: 3px 3px 0 -1px color-mix(in srgb, var(--accent) 35%, transparent);
  }
  .b:hover { background: var(--paper-sunk); }
  .b--ink { background: var(--ink); color: var(--paper); }
  .b--ink:hover { background: var(--ink); }
  @media (max-width: 52rem) {
    .detail__body { grid-template-columns: minmax(0, 1fr); }
    .detail__inner { padding: var(--space-s); }
  }
</style>
