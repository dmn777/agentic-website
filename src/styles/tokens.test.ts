// Design-token contract: every text colour must stay readable on every surface it is used
// on, in both themes. Parses tokens.css (the single source of truth) and the Shiki themes.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { contrast } from '../lib/color';
import { plateLight, plateDark } from './shiki-themes';

const css = fs.readFileSync(path.resolve(__dirname, 'tokens.css'), 'utf8');
const tokens: Record<string, [string, string]> = {};
for (const m of css.matchAll(/--([\w-]+):\s*light-dark\(\s*(#[0-9a-fA-F]{3,6})\s*,\s*(#[0-9a-fA-F]{3,6})\s*\)/g)) tokens[m[1]] = [m[2], m[3]];

const TEXT = ['ink', 'ink-2', 'ink-3', 'accent-ink', 'teal-ink', 'ochre-ink'];
const SURFACES = ['paper', 'paper-raised', 'paper-sunk'];
const GRAPHIC = ['accent', 'teal', 'ochre', 'rule-strong'];

describe('tokens.css', () => {
  it('defines every required token as light-dark(#hex, #hex)', () => {
    for (const t of [...TEXT, ...SURFACES, ...GRAPHIC, 'rule', 'code-bg', 'focus']) expect(tokens[t], t).toBeDefined();
  });
  for (const [mode, i] of [['light', 0], ['dark', 1]] as const) {
    it(`text tokens reach 4.5:1 on all surfaces (${mode})`, () => {
      for (const t of TEXT) for (const s of SURFACES)
        expect(contrast(tokens[t][i], tokens[s][i]), `${t} on ${s}`).toBeGreaterThanOrEqual(4.5);
    });
    it(`graphic pens and focus reach 3:1 on all surfaces (${mode})`, () => {
      for (const t of [...GRAPHIC, 'focus']) for (const s of SURFACES)
        expect(contrast(tokens[t][i], tokens[s][i]), `${t} on ${s}`).toBeGreaterThanOrEqual(3);
    });
    it(`paper-coloured text on ink buttons reaches 4.5:1 (${mode})`, () => {
      expect(contrast(tokens.paper[i], tokens.ink[i])).toBeGreaterThanOrEqual(4.5);
    });
  }
});

describe('code themes', () => {
  for (const [name, theme, i] of [['light', plateLight, 0], ['dark', plateDark, 1]] as const) {
    it(`every token colour reaches 4.5:1 on code-bg (${name})`, () => {
      const bg = tokens['code-bg'][i];
      expect(theme.colors?.['editor.background']?.toLowerCase()).toBe(bg.toLowerCase());
      const fgs = [theme.colors?.['editor.foreground'], ...(theme.tokenColors ?? []).map((t) => t.settings.foreground)].filter(Boolean) as string[];
      expect(fgs.length).toBeGreaterThan(8);
      for (const fg of fgs) expect(contrast(fg, bg), fg).toBeGreaterThanOrEqual(4.5);
    });
  }
});
