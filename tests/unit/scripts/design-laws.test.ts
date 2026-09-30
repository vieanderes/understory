import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/*
 * Drift ratchets for the design system (docs/DESIGN.md). They read the source as text.
 * Cheap, blunt, and they fail in CI before a reviewer has to notice.
 */

const SRC = path.resolve(__dirname, '../../../src');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(tsx?|css)$/.test(name) ? [full] : [];
  });
}

const files = sourceFiles(SRC).map((file) => ({
  file: path.relative(SRC, file),
  text: readFileSync(file, 'utf8'),
}));

const tsx = files.filter((f) => f.file.endsWith('.tsx'));

describe('design laws', () => {
  it('uses no arbitrary Tailwind values: every size, gap and colour comes from a token', () => {
    // Matches utilities such as p-[13px], text-[#fff], grid-cols-[2rem_1fr].
    const arbitrary = /(?<![\w-])[a-z][a-z0-9:-]*-\[[^\]]+\]/g;
    const offenders = tsx.flatMap((f) =>
      (f.text.match(arbitrary) ?? []).map((m) => `${f.file}: ${m}`),
    );
    expect(offenders).toEqual([]);
  });

  it('never writes dark: in a component; themes swap variables underneath', () => {
    const offenders = tsx.filter((f) => /(?<![\w-])dark:/.test(f.text)).map((f) => f.file);
    expect(offenders).toEqual([]);
  });

  it('names no literal colour outside the token file', () => {
    const literal = /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/;
    // Browser chrome (theme-color, the install splash) is painted before any CSS loads,
    // so those two files have to repeat the ground colour as a literal.
    const allowed = new Set(['styles/tokens.css', 'app/layout.tsx', 'app/manifest.ts']);
    const offenders = files
      .filter((f) => !allowed.has(f.file))
      .filter((f) => literal.test(f.text))
      .map((f) => f.file);
    expect(offenders).toEqual([]);
  });

  it('draws no gradients and no glow', () => {
    const offenders = files
      .filter((f) => /gradient\(|bg-gradient|bg-linear|drop-shadow|blur-/.test(f.text))
      .map((f) => f.file);
    expect(offenders).toEqual([]);
  });

  it('keeps exclamation marks and filler words out of interface copy', () => {
    // JSX text only: between > and <, so code such as `!value` is not caught.
    const copy = />([^<>{}]*\b(?:Please|successfully|Oops)\b[^<>{}]*|[^<>{}=]*\w![^<>{}]*)</;
    const offenders = tsx.filter((f) => copy.test(f.text)).map((f) => f.file);
    expect(offenders).toEqual([]);
  });

  it('imports GSAP and Lenis only inside src/features/motion, the one motion gate', () => {
    const library = /from\s+['"](?:gsap|@gsap\/react|lenis)(?:\/[^'"]*)?['"]/;
    const offenders = files
      .filter((f) => !f.file.startsWith(path.join('features', 'motion') + path.sep))
      .filter((f) => library.test(f.text))
      .map((f) => f.file);
    expect(offenders).toEqual([]);
  });

  it('gives GSAP no literal duration or stagger: tempos come from the motion tokens', () => {
    const literal = /\b(?:duration|stagger|delay)\s*:\s*\d/;
    const offenders = files
      .filter((f) => f.file.startsWith(path.join('features', 'motion') + path.sep))
      .filter((f) => !f.file.endsWith('tokens.ts'))
      .filter((f) => literal.test(f.text))
      .map((f) => f.file);
    expect(offenders).toEqual([]);
  });
});
