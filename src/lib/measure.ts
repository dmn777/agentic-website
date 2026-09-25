// Svelte's bind:clientWidth/Height can report 0 or a tiny transient size (e.g. 16 px) for
// a frame while an island hydrates. Geometry derived from it then goes negative, and
// Chromium logs "<rect> attribute width: A negative value is not valid" (a QA gate
// failure). Use the measured size only once it is plausible.
export const usable = (px: number | undefined, fallback: number, min = 120): number =>
  px !== undefined && px >= min ? px : fallback;
