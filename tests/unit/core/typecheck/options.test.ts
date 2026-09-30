import { describe, expect, it } from 'vitest';
import { CHECKER_COMPILER_OPTIONS, CHECKER_FILES, SANDBOX_GLOBALS } from '@/core/typecheck/options';

describe('the checker program', () => {
  it('is strict, has no DOM, and treats the learner file as a module', () => {
    expect(CHECKER_COMPILER_OPTIONS).toMatchObject({
      strict: true,
      noUncheckedIndexedAccess: true,
      lib: ['es2023'],
      moduleDetection: 'force',
    });
  });

  it('gives every file its own name, with the library in a folder of its own', () => {
    const names = [
      CHECKER_FILES.code,
      CHECKER_FILES.tests,
      CHECKER_FILES.harness,
      CHECKER_FILES.sandbox,
    ];
    expect(new Set(names).size).toBe(names.length);
    expect(names.some((name) => name.startsWith(CHECKER_FILES.libDir))).toBe(false);
  });

  it('declares what the sandbox adds to the language', () => {
    for (const name of [
      'console',
      'setTimeout',
      'clearTimeout',
      'queueMicrotask',
      'structuredClone',
    ]) {
      expect(SANDBOX_GLOBALS).toContain(name);
    }
  });
});
