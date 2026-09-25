import { describe, expect, it } from 'vitest';
import { sections, joinList } from './sections';

const E = (kind: string, slug = kind.toLowerCase()) => ({ kind, slug });

describe('joinList', () => {
  it('joins with commas and a final "and"', () => {
    expect(joinList([])).toBe('');
    expect(joinList(['a'])).toBe('a');
    expect(joinList(['a', 'b'])).toBe('a and b');
    expect(joinList(['a', 'b', 'c'])).toBe('a, b and c');
  });
});

describe('sections', () => {
  it('splits what the site has from what it plans, in a fixed order', () => {
    const s = sections([E('Explorable'), E('Gallery'), E('Story', 'keeling')], { notes: false });
    expect(s.live.map((x) => x.key)).toEqual(['explorables', 'art', 'story']);
    expect(s.planned.map((x) => x.key)).toEqual(['agent-loop', 'game', 'journal']);
  });
  it('moves a section to "live" as soon as it exists', () => {
    const s = sections([E('Explorable'), E('Game', 'game'), E('Explainer', 'agent-loop')], { notes: true });
    expect(s.live.map((x) => x.key)).toEqual(['explorables', 'agent-loop', 'game', 'journal']);
    expect(s.planned.map((x) => x.key)).toEqual(['art', 'story']);
  });
  it('offers both a short and a descriptive phrase for each section', () => {
    for (const x of sections([], { notes: false }).planned) {
      expect(x.short.length).toBeGreaterThan(2);
      expect(x.long.length).toBeGreaterThan(x.short.length);
    }
  });
});
