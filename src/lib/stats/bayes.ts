// Bayes' rule, shown as natural frequencies ("of 1000 people…"). Counts are rounded so the
// four cells always add up: first the condition split, then each group's test results,
// each by largest-remainder rounding.

export interface TestParams { prior: number; sensitivity: number; specificity: number }

export interface Frequencies {
  population: number;
  truePos: number; falseNeg: number; falsePos: number; trueNeg: number;
  /** Exact P(condition | positive). */
  posterior: number;
  /** Exact P(no condition | negative). */
  npv: number;
  /** Share of positives in the rounded counts who have the condition. */
  ppvCounts: number;
}

/** P(condition | positive test). NaN when nobody can test positive. */
export function posterior({ prior, sensitivity, specificity }: TestParams): number {
  const pos = sensitivity * prior + (1 - specificity) * (1 - prior);
  return pos === 0 ? NaN : (sensitivity * prior) / pos;
}

/** Split an integer total into two integers proportional to share and 1 − share. */
function split(total: number, share: number): [number, number] {
  const a = Math.round(total * share);
  return [a, total - a];
}

export function naturalFrequencies(t: TestParams, population = 1000): Frequencies {
  const [sick, well] = split(population, t.prior);
  const [truePos, falseNeg] = split(sick, t.sensitivity);
  const [trueNeg, falsePos] = split(well, t.specificity);
  const negP = (1 - t.sensitivity) * t.prior + t.specificity * (1 - t.prior);
  return {
    population, truePos, falseNeg, falsePos, trueNeg,
    posterior: posterior(t),
    npv: negP === 0 ? NaN : (t.specificity * (1 - t.prior)) / negP,
    ppvCounts: truePos + falsePos === 0 ? NaN : truePos / (truePos + falsePos),
  };
}

export interface BayesPreset extends TestParams {
  id: string; label: string; note: string;
  /** What the 1000 squares are ("people" / "emails"), singular, and the relative pronoun. */
  unit: string; unitOne: string; who: 'who' | 'that';
  /** Verb phrases, plural and singular: "have the condition" / "has the condition". */
  condition: string; conditionOne: string;
  test: string; testOne: string;
}

/** Illustrative scenarios (round numbers chosen for teaching, not measured rates). */
export const BAYES_PRESETS: BayesPreset[] = [
  { id: 'screening', label: 'Screening test', unit: 'people', unitOne: 'person', who: 'who', condition: 'have the condition', conditionOne: 'has the condition', test: 'test positive', testOne: 'tests positive', prior: 0.01, sensitivity: 0.9, specificity: 0.91,
    note: 'A fairly good test for an uncommon condition: most positives are still false alarms.' },
  { id: 'rare', label: 'Rare disease', unit: 'people', unitOne: 'person', who: 'who', condition: 'have the disease', conditionOne: 'has the disease', test: 'test positive', testOne: 'tests positive', prior: 0.001, sensitivity: 0.99, specificity: 0.99,
    note: 'Even a 99%-accurate test struggles when only 1 in 1000 people is ill.' },
  { id: 'spam', label: 'Spam filter', unit: 'emails', unitOne: 'email', who: 'that', condition: 'are spam', conditionOne: 'is spam', test: 'get flagged', testOne: 'gets flagged', prior: 0.4, sensitivity: 0.95, specificity: 0.98,
    note: 'When the thing you look for is common, a positive result means much more.' },
];
