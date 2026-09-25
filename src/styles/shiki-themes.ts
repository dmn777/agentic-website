// Custom Shiki themes drawn from the Plates palette. Stock themes failed WCAG AA on the
// plate paper (mostly comments), so the code blocks get their own pair; tokens.test.ts
// holds every colour here to ≥ 4.5:1 on --code-bg. Keep the backgrounds in sync with
// --code-bg in tokens.css (the test enforces it).
import type { ThemeRegistration } from 'shiki';

interface Pens { bg: string; fg: string; comment: string; keyword: string; string: string; number: string; fn: string; type: string; punct: string; tag: string; attr: string; }

function theme(name: string, type: 'light' | 'dark', p: Pens): ThemeRegistration {
  return {
    name,
    type,
    colors: { 'editor.background': p.bg, 'editor.foreground': p.fg },
    tokenColors: [
      { scope: ['comment', 'punctuation.definition.comment'], settings: { foreground: p.comment, fontStyle: 'italic' } },
      { scope: ['keyword', 'storage', 'storage.type', 'keyword.operator.new', 'keyword.control'], settings: { foreground: p.keyword } },
      { scope: ['keyword.operator', 'punctuation', 'meta.brace'], settings: { foreground: p.punct } },
      { scope: ['string', 'string.template', 'punctuation.definition.string'], settings: { foreground: p.string } },
      { scope: ['constant.numeric', 'constant.language', 'constant.character', 'support.constant'], settings: { foreground: p.number } },
      { scope: ['entity.name.function', 'support.function', 'meta.function-call'], settings: { foreground: p.fn } },
      { scope: ['entity.name.type', 'entity.name.class', 'support.type', 'support.class', 'entity.other.inherited-class'], settings: { foreground: p.type } },
      { scope: ['variable', 'variable.other', 'meta.definition.variable'], settings: { foreground: p.fg } },
      { scope: ['variable.parameter'], settings: { foreground: p.fg, fontStyle: 'italic' } },
      { scope: ['entity.name.tag', 'meta.tag'], settings: { foreground: p.tag } },
      { scope: ['entity.other.attribute-name'], settings: { foreground: p.attr } },
      { scope: ['markup.heading'], settings: { foreground: p.keyword, fontStyle: 'bold' } },
      { scope: ['markup.italic'], settings: { fontStyle: 'italic' } },
      { scope: ['markup.bold'], settings: { fontStyle: 'bold' } },
      { scope: ['markup.inline.raw', 'markup.fenced_code'], settings: { foreground: p.string } },
      { scope: ['markup.inserted'], settings: { foreground: p.string } },
      { scope: ['markup.deleted'], settings: { foreground: p.keyword } },
      { scope: ['support.type.property-name', 'meta.object-literal.key'], settings: { foreground: p.attr } },
      { scope: ['variable.other.constant', 'variable.language'], settings: { foreground: p.number } },
    ],
  };
}

export const plateLight = theme('plate-light', 'light', {
  bg: '#f8f5ee', fg: '#191d28', comment: '#63666e', keyword: '#a82e18', string: '#17656a',
  number: '#7f5610', fn: '#2a4f9b', type: '#6a3d8f', punct: '#4a4f5c', tag: '#a82e18', attr: '#7f5610',
});

export const plateDark = theme('plate-dark', 'dark', {
  bg: '#141e28', fg: '#ece6d9', comment: '#9aa1aa', keyword: '#ff8f74', string: '#7fd3d7',
  number: '#e8c27a', fn: '#a4c0f7', type: '#cfb0f0', punct: '#b9bdc3', tag: '#ff8f74', attr: '#e8c27a',
});
