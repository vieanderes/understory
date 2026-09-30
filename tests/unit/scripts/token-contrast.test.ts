import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * WCAG 2.2 AA contrast, checked on the token file itself. Every text colour must reach
 * 4.5:1 on every ground it can sit on, in both themes. A palette tweak that
 * breaks legibility fails here, before any page is rendered.
 */

const css = readFileSync(path.resolve(__dirname, '../../../src/styles/tokens.css'), 'utf8');

function blocks(): { selector: string; vars: Record<string, string> }[] {
  return [...css.matchAll(/([^{}]+)\{([^{}]*--bg:[^{}]*)\}/g)].map((m) => ({
    selector: m[1]!.trim().replace(/\s+/g, ' '),
    vars: Object.fromEntries(
      [...m[2]!.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((v) => [v[1]!, v[2]!]),
    ),
  }));
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT = ['fg', 'muted', 'faint', 'accent', 'success', 'warning', 'danger', 'syntax-keyword'];
// Sunken is the ground of inline code, which sits inside faint and muted text too.
const GROUNDS = ['bg', 'surface', 'sunken'];

describe('token contrast', () => {
  const found = blocks();

  it('finds the light and the dark theme', () => {
    expect(found).toHaveLength(2);
  });

  for (const block of found) {
    describe(block.selector, () => {
      for (const text of TEXT) {
        for (const ground of GROUNDS) {
          it(`${text} on ${ground} reaches 4.5:1`, () => {
            expect(contrast(block.vars[text]!, block.vars[ground]!)).toBeGreaterThanOrEqual(4.5);
          });
        }
      }
      it('accent-fg on accent reaches 4.5:1', () => {
        expect(contrast(block.vars['accent-fg']!, block.vars['accent']!)).toBeGreaterThanOrEqual(
          4.5,
        );
      });
      it('fg on accent-tint reaches 4.5:1', () => {
        expect(contrast(block.vars['fg']!, block.vars['accent-tint']!)).toBeGreaterThanOrEqual(4.5);
      });
    });
  }
});
