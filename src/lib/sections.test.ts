import { describe, expect, it } from 'vitest';
import { sections, joinList, uncovered } from './sections';
import { lab, plates } from '../data/lab';

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
    expect(s.planned.map((x) => x.key)).toEqual(['agent-loop', 'simulation', 'game', 'journal']);
  });
  it('moves a section to "live" as soon as it exists', () => {
    const s = sections([E('Explorable'), E('Game', 'game'), E('Explainer', 'agent-loop')], { notes: true });
    expect(s.live.map((x) => x.key)).toEqual(['explorables', 'agent-loop', 'game', 'journal']);
    expect(s.planned.map((x) => x.key)).toEqual(['art', 'story', 'simulation']);
  });
  it('offers both a short and a descriptive phrase for each section', () => {
    for (const x of sections([], { notes: false }).planned) {
      expect(x.short.length).toBeGreaterThan(2);
      expect(x.long.length).toBeGreaterThan(x.short.length);
    }
  });
});

// Sweep 2 (M2): the site described itself from a closed list, and Pl. VII's kind had no
// entry, so the Home lede silently left it out. Every plate must be described by some
// section, listed or draft, so a new kind fails here instead of vanishing from the copy.
describe('uncovered', () => {
  it('names the entries no section describes', () => {
    expect(uncovered([E('Explorable'), E('Hologram', 'holo')])).toEqual(['Hologram (holo)']);
    expect(uncovered([E('Explainer', 'agent-loop')])).toEqual([]);
    expect(uncovered([E('Explainer', 'some-other-explainer')])).toEqual(['Explainer (some-other-explainer)']);
  });
  it('finds nothing uncovered in the Lab, drafts included', () => {
    expect(uncovered(plates)).toEqual([]);
    expect(uncovered(lab)).toEqual([]);
  });
});
