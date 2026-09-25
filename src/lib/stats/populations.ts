// Populations for the sampling explorable. Each has a sampler (seeded), an exact mean and
// sd, a density for drawing its shape, and a finite display domain that contains every
// draw (the skewed one is truncated far out in the tail and renormalised).
import type { Rng } from '../random';

export interface Population {
  id: 'skewed' | 'bimodal' | 'uniform';
  label: string;
  blurb: string;
  domain: [number, number];
  mean: number;
  sd: number;
  pdf: (x: number) => number;
  sample: (r: Rng) => number;
}

// Skewed: exponential with rate 1/2 (mean 2), truncated at 20 (P(X > 20) = e^-10 ≈ 4.5e-5).
const L = 0.5, T = 20, Z = 1 - Math.exp(-L * T);
const expMean = (1 / L - (T * Math.exp(-L * T)) / Z);
const expM2 = (2 / L ** 2 - (Math.exp(-L * T) * (T * T + (2 * T) / L)) / Z);

// Bimodal: an equal mix of N(3, 0.8²) and N(7, 0.8²), clipped to [0, 10] (tails < 1e-4).
const M1 = 3, M2 = 7, S = 0.8;
const phi = (x: number, m: number) => Math.exp(-0.5 * ((x - m) / S) ** 2) / (S * Math.sqrt(2 * Math.PI));

export const POPULATIONS: Population[] = [
  {
    id: 'skewed',
    label: 'Skewed',
    blurb: 'Waiting times: mostly short, occasionally very long.',
    domain: [0, T],
    mean: expMean,
    sd: Math.sqrt(expM2 - expMean ** 2),
    pdf: (x) => (x < 0 || x > T ? 0 : (L * Math.exp(-L * x)) / Z),
    sample: (r) => -Math.log(1 - r.next() * Z) / L, // inverse CDF of the truncated exponential
  },
  {
    id: 'bimodal',
    label: 'Two humps',
    blurb: 'Two groups mixed together, with nobody in the middle.',
    domain: [0, 10],
    mean: (M1 + M2) / 2,
    sd: Math.sqrt(S * S + ((M2 - M1) / 2) ** 2),
    pdf: (x) => (x < 0 || x > 10 ? 0 : 0.5 * phi(x, M1) + 0.5 * phi(x, M2)),
    sample: (r) => {
      for (;;) {
        const x = (r.next() < 0.5 ? M1 : M2) + S * r.normal();
        if (x >= 0 && x <= 10) return x;
      }
    },
  },
  {
    id: 'uniform',
    label: 'Flat',
    blurb: 'Every value between 0 and 10 equally likely.',
    domain: [0, 10],
    mean: 5,
    sd: 10 / Math.sqrt(12),
    pdf: (x) => (x < 0 || x > 10 ? 0 : 0.1),
    sample: (r) => r.next() * 10,
  },
];

export const getPopulation = (id: Population['id']): Population => {
  const p = POPULATIONS.find((q) => q.id === id);
  if (!p) throw new Error(`unknown population ${id}`);
  return p;
};
