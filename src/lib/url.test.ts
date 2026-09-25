import { describe, expect, it } from 'vitest';
import { joinBase, isInternal } from './url';

describe('joinBase', () => {
  const B = '/agentic-website/';
  it('prefixes root-relative paths with the base', () => {
    expect(joinBase(B, '/lab/')).toBe('/agentic-website/lab/');
    expect(joinBase(B, 'lab/')).toBe('/agentic-website/lab/');
  });
  it('maps the root to the base with its trailing slash', () => {
    expect(joinBase(B, '/')).toBe('/agentic-website/');
    expect(joinBase(B, '')).toBe('/agentic-website/');
  });
  it('works with or without a trailing slash on the base', () => {
    expect(joinBase('/agentic-website', '/about/')).toBe('/agentic-website/about/');
  });
  it('keeps query strings and hashes', () => {
    expect(joinBase(B, '/lab/art/#seed=42')).toBe('/agentic-website/lab/art/#seed=42');
  });
  it('does not double-prefix', () => {
    expect(joinBase(B, '/agentic-website/lab/')).toBe('/agentic-website/lab/');
  });
  it('leaves external, protocol-relative and special URLs alone', () => {
    for (const u of ['https://github.com/x', '//cdn.example/x', 'mailto:a@b.c', '#top'])
      expect(joinBase(B, u)).toBe(u);
  });
  it('works with the root base', () => {
    expect(joinBase('/', '/lab/')).toBe('/lab/');
  });
});

describe('isInternal', () => {
  it('distinguishes site links from external ones', () => {
    expect(isInternal('/lab/')).toBe(true);
    expect(isInternal('lab/')).toBe(true);
    expect(isInternal('https://example.com')).toBe(false);
    expect(isInternal('//example.com')).toBe(false);
    expect(isInternal('mailto:x@y.z')).toBe(false);
    expect(isInternal('#frag')).toBe(false);
  });
});
