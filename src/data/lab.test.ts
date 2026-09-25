import { describe, expect, it } from 'vitest';
import { lab, labEntry, plates } from './lab';

// A draft plate has a page (so it can ship and be tested live) but no listing: Home,
// /lab/, the pager of its neighbours and the site description all read `lab`, which
// leaves drafts out. Its own page reads `labEntry`, which finds it.
describe('draft plates', () => {
  it('every plate number is unique across drafts and listed plates', () => {
    const nums = plates.map((e) => e.plate);
    expect(new Set(nums).size).toBe(nums.length);
  });
  it('lab lists no drafts', () => {
    expect(lab.some((e) => e.draft)).toBe(false);
    expect(lab.length).toBe(plates.filter((e) => !e.draft).length);
  });
  it('labEntry finds a plate whether or not it is a draft', () => {
    for (const e of plates) expect(labEntry(e.slug)).toBe(e);
  });
});
