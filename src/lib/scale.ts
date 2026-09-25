// Tiny scale helpers for hand-built SVG charts (no charting dependency).

export interface Scale { (v: number): number; invert(px: number): number; domain: [number, number]; range: [number, number] }

export function linearScale(domain: [number, number], range: [number, number], clamp = false): Scale {
  const [d0, d1] = domain, [r0, r1] = range;
  const k = (r1 - r0) / (d1 - d0 || 1);
  const f = ((v: number) => {
    const t = clamp ? Math.min(Math.max(v, Math.min(d0, d1)), Math.max(d0, d1)) : v;
    return r0 + (t - d0) * k;
  }) as Scale;
  f.invert = (px) => d0 + (px - r0) / k;
  f.domain = domain; f.range = range;
  return f;
}

export function logScale(domain: [number, number], range: [number, number]): Scale {
  const lin = linearScale([Math.log10(domain[0]), Math.log10(domain[1])], range);
  const f = ((v: number) => lin(Math.log10(v))) as Scale;
  f.invert = (px) => Math.pow(10, lin.invert(px));
  f.domain = domain; f.range = range;
  return f;
}

/** "Nice" 1-2-5 ticks covering [lo, hi] with roughly `count` intervals. */
export function niceTicks(lo: number, hi: number, count = 5): number[] {
  if (hi === lo) return [lo];
  const raw = (hi - lo) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw * 0.999) ?? 10 * mag;
  const dec = Math.max(0, -Math.floor(Math.log10(step)) + (step / mag === 2.5 ? 1 : 0));
  const out: number[] = [];
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + step * 1e-9; v += step) out.push(Number(v.toFixed(dec)));
  return out;
}
