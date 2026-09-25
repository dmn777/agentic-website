// Data layer for the Keeling-curve story (T8): NOAA GML Mauna Loa CO₂ files, committed in
// src/data/keeling/ with their provenance. Pure functions, tested against NOAA's own
// published annual files.

export interface Month { year: number; month: number; t: number; ppm: number; deseason: number }
export interface YearValue { year: number; value: number }

const rows = (csv: string) => csv.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#') && /^\d/.test(l));

/** co2_mm_mlo.csv: year,month,decimal date,average,deseasonalized,ndays,sdev,unc */
export const parseCO2 = (csv: string): Month[] =>
  rows(csv).map((l) => {
    const [year, month, t, ppm, deseason] = l.split(',').map(Number);
    return { year, month, t, ppm, deseason };
  });

/** Two-column NOAA annual files (co2_annmean_mlo.csv, co2_gr_mlo.csv): year,value,unc */
export const parseAnnual = (csv: string): YearValue[] =>
  rows(csv).map((l) => { const [year, value] = l.split(',').map(Number); return { year, value }; });

/** Mean of the monthly averages, for years with all 12 months. */
export function annualMeans(ms: Month[]): YearValue[] {
  const by = new Map<number, number[]>();
  for (const m of ms) by.set(m.year, [...(by.get(m.year) ?? []), m.ppm]);
  return [...by].filter(([, v]) => v.length === 12).map(([year, v]) => ({ year, value: v.reduce((a, b) => a + b) / 12 }));
}

/**
 * Jan-to-Dec increase from the deseasonalised series: the mean over a five-month window
 * centred on each turn of the year (Oct–Feb), minus the same a year earlier. Of the
 * windows tried (Dec–Dec, Jan–Jan, Dec/Jan pairs, 3- and 5-month windows), this one
 * reproduces NOAA's curve-fitted published growth best (mean |Δ| ≈ 0.06 ppm, see the test).
 */
export function annualGrowth(ms: Month[]): YearValue[] {
  const d = new Map(ms.map((m) => [m.year * 12 + (m.month - 1), m.deseason]));
  const turn = (y: number) => {
    const v: number[] = [];
    for (let k = -2; k <= 2; k++) { const x = d.get(y * 12 + 11 + k); if (x === undefined) return undefined; v.push(x); }
    return v.reduce((a, b) => a + b) / v.length;
  };
  const out: YearValue[] = [];
  for (const y of new Set(ms.map((m) => m.year))) {
    const end = turn(y), start = turn(y - 1);
    if (end !== undefined && start !== undefined) out.push({ year: y, value: end - start });
  }
  return out;
}

/** Average seasonal departure (ppm − deseasonalised) for each calendar month, Jan..Dec. */
export function seasonalCycle(ms: Month[]): number[] {
  const sum = new Array(12).fill(0), n = new Array(12).fill(0);
  for (const m of ms) { sum[m.month - 1] += m.ppm - m.deseason; n[m.month - 1]++; }
  return sum.map((s, i) => s / n[i]);
}

/** Mean annual growth per complete decade (1960 = 1960–1969). */
export function decadeGrowth(growth: YearValue[]): { decade: number; value: number; years: number }[] {
  const by = new Map<number, number[]>();
  for (const g of growth) { const d = Math.floor(g.year / 10) * 10; by.set(d, [...(by.get(d) ?? []), g.value]); }
  return [...by].filter(([, v]) => v.length === 10).map(([decade, v]) => ({ decade, value: v.reduce((a, b) => a + b) / 10, years: 10 }));
}
