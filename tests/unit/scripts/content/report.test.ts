import { describe, expect, it } from 'vitest';
import type { Issue } from '@/core/content/catalog';
import { exitCodeFor, formatReport } from '../../../../scripts/lib/report';

const error: Issue = {
  severity: 'error',
  path: 'content/a/lesson.yaml',
  where: 'predict-total',
  message: 'Exactly one entry needs "correct: true".',
  rule: 'one-correct',
};
const warning: Issue = {
  severity: 'warning',
  path: 'content/a/lesson.yaml',
  where: 'intro',
  message: 'Remove "just".',
  rule: 'style-banned-word',
};
const elsewhere: Issue = { ...error, path: 'content/b/module.yaml', where: undefined };

const plain = { colour: false, strict: false, checked: 3 };

describe('formatReport', () => {
  it('groups issues by file and prints severity, where, message and rule', () => {
    const lines = formatReport([error, elsewhere, warning], plain).split('\n');
    const first = lines.indexOf('content/a/lesson.yaml');
    const second = lines.indexOf('content/b/module.yaml');
    expect(first).toBeGreaterThanOrEqual(0);
    expect(second).toBeGreaterThan(first);
    // Both issues of the first file sit under its heading, errors before warnings.
    expect(lines[first + 1]).toBe(
      '  error    predict-total: Exactly one entry needs "correct: true". [one-correct]',
    );
    expect(lines[first + 2]).toBe('  warning  intro: Remove "just". [style-banned-word]');
    expect(lines[second + 1]).toBe(
      '  error    Exactly one entry needs "correct: true". [one-correct]',
    );
  });

  it('ends with a summary line', () => {
    expect(formatReport([error, elsewhere, warning], plain)).toMatch(
      /3 files checked: 2 errors, 1 warning\.\n$/,
    );
  });

  it('says so when there is nothing to report', () => {
    expect(formatReport([], plain)).toBe('3 files checked: no problems.\n');
  });

  it('uses colour only when asked', () => {
    expect(formatReport([error], plain)).not.toContain('\x1b[');
    expect(formatReport([error], { ...plain, colour: true })).toContain('\x1b[31m');
  });

  it('notes that warnings count in strict mode', () => {
    expect(formatReport([warning], { ...plain, strict: true })).toContain('--strict');
  });
});

describe('exitCodeFor', () => {
  it('fails on any error', () => {
    expect(exitCodeFor([error, warning], false)).toBe(1);
  });

  it('passes on warnings alone', () => {
    expect(exitCodeFor([warning], false)).toBe(0);
  });

  it('fails on warnings in strict mode', () => {
    expect(exitCodeFor([warning], true)).toBe(1);
  });

  it('passes on nothing', () => {
    expect(exitCodeFor([], true)).toBe(0);
  });
});
