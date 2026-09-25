// Darkfield's difficulty curve (GAME_DESIGN.md §Difficulty curve). One monotone value d(t)
// drives every parameter, so "it gets harder" is a checkable property, not a feeling.

export interface Params {
  penSpeed: number;      // u/s
  drain: number;         // ink per second
  diatomTarget: number;  // diatoms kept on the field
  respawnDelay: number;  // s between diatom respawns
  hazardTarget: number;  // contaminants kept on the field
  hazardSpeed: number;   // u/s
  homing: number;        // rad/s a contaminant turns towards the pen
}

const TAU = 140; // s
const HAZARD_STEPS = [0.15, 0.3, 0.45, 0.6, 0.75];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** d(t) = 1 − e^(−t/140): 0 at the start, ½ after ~97 s, ~0.88 after 5 min. */
export const difficulty = (t: number) => 1 - Math.exp(-Math.max(0, t) / TAU);

export function paramsAt(d: number): Params {
  return {
    penSpeed: lerp(170, 250, d),
    drain: lerp(2.5, 7.5, d),
    diatomTarget: Math.round(lerp(9, 5, d)),
    respawnDelay: lerp(0.8, 1.8, d),
    hazardTarget: 1 + HAZARD_STEPS.filter((s) => d >= s).length,
    hazardSpeed: lerp(45, 115, d),
    homing: lerp(0.15, 0.6, d),
  };
}

/** A loop scores the sum of its catch times the number caught. */
export function loopScore(points: number[]): number {
  return points.reduce((a, b) => a + b, 0) * points.length;
}
