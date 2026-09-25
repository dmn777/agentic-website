import { describe, expect, it } from 'vitest';
import { contrast, parseHex, relativeLuminance } from './color';

describe('color', () => {
  it('parses 3- and 6-digit hex', () => {
    expect(parseHex('#fff')).toEqual([255, 255, 255]);
    expect(parseHex('#1a2B3c')).toEqual([26, 43, 60]);
  });
  it('computes WCAG relative luminance', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 10);
  });
  it('computes WCAG contrast ratios (symmetric, 1..21)', () => {
    expect(contrast('#000', '#fff')).toBeCloseTo(21, 5);
    expect(contrast('#fff', '#000')).toBeCloseTo(21, 5);
    expect(contrast('#777', '#777')).toBeCloseTo(1, 5);
    // Known reference: #767676 on white is the classic 4.54:1 AA pass.
    expect(contrast('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
  });
});
