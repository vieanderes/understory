import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DURATION, EASE } from '@/features/motion/tokens';

/*
 * The motion tokens live in CSS and are mirrored in TypeScript for GSAP. This keeps the
 * two in step, so a tempo changed in tokens.css cannot silently leave GSAP behind.
 */
const css = readFileSync(path.resolve(__dirname, '../../../src/styles/tokens.css'), 'utf8');

function cssValue(name: string): string {
  const match = new RegExp(`--${name}:\\s*([^;]+);`).exec(css);
  if (!match?.[1]) throw new Error(`--${name} is missing from tokens.css`);
  return match[1].trim();
}

describe('motion tokens', () => {
  it.each(Object.entries(DURATION))('--dur-%s matches its GSAP value', (name, seconds) => {
    expect(cssValue(`dur-${name}`)).toBe(`${Math.round(seconds * 1000)}ms`);
  });

  it.each(Object.entries(EASE))('--ease-%s matches its GSAP ease', (name, ease) => {
    expect(cssValue(`ease-${name}`)).toBe(ease.css);
  });

  it('keeps the interaction tempo under 300 ms', () => {
    expect(DURATION.press).toBeLessThan(0.3);
    expect(DURATION.answer).toBeLessThan(0.3);
  });
});
