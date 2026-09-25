import { describe, expect, it } from 'vitest';
import { lab, labEntry, plates, plateFor, journalRoutes } from './lab';

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

// Sweep 2 (M1): notes and plates link to each other through a note's labPage route.
describe('plateFor', () => {
  it('names a plate, or a series by its range', () => {
    expect(plateFor('/lab/chladni/')).toEqual({ label: 'Pl. VII', title: 'The shape of a sound', href: '/lab/chladni/' });
    expect(plateFor('/lab/stats/')).toEqual({ label: 'Pl. I–III', title: 'Statistics, seen', href: '/lab/stats/' });
    expect(plateFor('/lab/nope/')).toBeUndefined();
    expect(plateFor(undefined)).toBeUndefined();
  });
  it('lists the labPage routes a note can use to belong to a plate: its own, and its series hub', () => {
    expect(journalRoutes(labEntry('chladni'))).toEqual(['/lab/chladni/']);
    expect(journalRoutes(labEntry('stats/sampling'))).toEqual(['/lab/stats/sampling/', '/lab/stats/']);
  });
});

