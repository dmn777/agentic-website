// Sampling distribution of the mean: the engine of the CLT explorable.
import type { Rng } from '../random';
import type { Population } from './populations';
import { mean } from './describe';

export const drawSample = (p: Population, n: number, r: Rng): number[] => Array.from({ length: n }, () => p.sample(r));

/** k sample means, each of a fresh sample of size n. */
export const sampleMeans = (p: Population, n: number, k: number, r: Rng): number[] =>
  Array.from({ length: k }, () => mean(drawSample(p, n, r)));

/** Standard error of the mean, σ/√n. */
export const standardError = (sigma: number, n: number): number => sigma / Math.sqrt(n);
