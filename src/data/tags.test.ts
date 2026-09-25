import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { TAGS, tagInfo } from './tags';
import { parseSeed } from '../lib/notes/markdown-to-pt';

// Sweep 2 (m2): 12 free-form tags for 8 posts, 9 of them used once, and #qa on 7 of 8, so
// the tag pages filtered nothing. Tags now come from one registry with written
// descriptions, and each one has to group at least two posts.
const dir = path.resolve(__dirname, '../../content/notes-seed');
const seeds = fs.readdirSync(dir).filter((f) => /^\d\d-.*\.md$/.test(f)).map((f) => parseSeed(fs.readFileSync(path.join(dir, f), 'utf8')));

describe('tag registry', () => {
  it('covers every tag the posts use', () => {
    for (const s of seeds) for (const t of s.tags) expect(TAGS.map((x) => x.tag), `${s.slug}: ${t}`).toContain(t);
  });
  it('has no tag that groups fewer than two posts, or nearly all of them', () => {
    for (const { tag } of TAGS) {
      const n = seeds.filter((s) => s.tags.includes(tag)).length;
      expect(n, tag).toBeGreaterThanOrEqual(2);
      expect(n, tag).toBeLessThanOrEqual(Math.ceil(seeds.length / 2));
    }
  });
  it('describes each tag in its own words', () => {
    for (const { tag, description } of TAGS) {
      expect(description.length, tag).toBeGreaterThan(40);
      expect(description).not.toMatch(/Build-journal entries about/);
    }
    expect(tagInfo('design')?.tag).toBe('design');
    expect(tagInfo('nope')).toBeUndefined();
  });
  it('matches the list the Studio offers editors', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../../studio/schemaTypes/post.ts'), 'utf8');
    const studio = JSON.parse(src.match(/export const TAGS = (\[[^\]]*\])/)![1].replace(/'/g, '"'));
    expect(studio).toEqual(TAGS.map((x) => x.tag));
  });
});
