// Contract for a gallery piece. make() precomputes a seeded scene for one canvas size;
// still() draws the finished image (thumbnails, reduced motion, PNG export) and frame(t)
// draws time t in seconds for the animated view. Colours come in resolved (theme-aware).

export interface Palette { paper: string; paperRaised: string; ink: string; ink2: string; ink3: string; accent: string; teal: string; ochre: string; rule: string }

export interface Param { key: string; label: string; min: number; max: number; step: number; value: number; unit?: string }

export interface Instance {
  still(ctx: CanvasRenderingContext2D): void;
  /** Draw time t (s). Returns false once the animation has nothing more to show. */
  frame(ctx: CanvasRenderingContext2D, t: number): boolean;
}

export interface Piece {
  id: string;
  title: string;
  /** One line, shown under the thumbnail. */
  description: string;
  /** The technique, named plainly ("Poisson-disk stippling"). */
  technique: string;
  params: Param[];
  /** The seed its thumbnail uses. */
  seed: number;
  make(o: { w: number; h: number; seed: number; params: Record<string, number>; pal: Palette }): Instance;
}

export const defaults = (p: Piece): Record<string, number> => Object.fromEntries(p.params.map((q) => [q.key, q.value]));
