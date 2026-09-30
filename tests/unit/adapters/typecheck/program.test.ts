import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createNodeProgramChecker, createNodeTypeChecker } from '@/adapters/typecheck/node';
import { CHECKER_COMPILER_OPTIONS } from '@/core/typecheck/options';

const check = createNodeProgramChecker();
const checker = createNodeTypeChecker();
const TESTS =
  "import { total } from './solution';\ntest('adds', () => expect(total([1])).toBe(1));\n";

const codeErrors = (code: string, tests = TESTS) =>
  check({ code, tests }).filter((d) => d.file === 'code' && d.category === 'error');

describe('the checker program', () => {
  it('passes well-typed code', () => {
    expect(
      codeErrors('export function total(xs: number[]): number { return xs.length; }\n'),
    ).toEqual([]);
  });

  it('reports the real compiler message, with its offset', async () => {
    const code = 'export function total(xs: number[]): number {\n  return "none";\n}\n';
    const outcome = await checker.check({ code, tests: TESTS });
    expect(outcome).toEqual({
      status: 'checked',
      diagnostics: [
        {
          from: code.indexOf('return'),
          to: code.indexOf('return') + 'return'.length,
          line: 2,
          column: 3,
          code: 2322,
          message: "Type 'string' is not assignable to type 'number'.",
        },
      ],
    });
  });

  it('is strict, with unchecked index access, as the content config is', () => {
    const implicitAny = codeErrors('export function total(xs) { return xs; }\n');
    expect(implicitAny.map((d) => d.code)).toContain(7006);
    const indexed = codeErrors(
      'export function total(xs: number[]): number { const first: number = xs[0]; return first; }\n',
    );
    expect(indexed.map((d) => d.code)).toContain(2322);
  });

  it('knows the ES2023 library and the sandbox globals, but not the DOM', () => {
    expect(
      codeErrors(
        'export function total(xs: number[]): number {\n  console.log(xs.findLast((x) => x > 0));\n  setTimeout(() => undefined, 1);\n  return xs.toSorted().length;\n}\n',
      ),
    ).toEqual([]);
    expect(codeErrors('export const total = () => document.title;\n').map((d) => d.code)).toEqual([
      2584,
    ]);
  });

  it('treats the file as a module, so a top-level name never meets a global', () => {
    expect(
      codeErrors('const name = 1;\nconst length = 2;\nexport const total = () => name + length;\n'),
    ).toEqual([]);
  });

  it("resolves the tests' relative import to the learner's file, whatever its name", () => {
    const tests =
      "import { total } from './fare.solution';\ntest('x', () => expect(total([])).toBe(0));\n";
    const diagnostics = check(
      { code: 'export const total = (xs: number[]) => xs.length;\n', tests },
      { tests: true },
    );
    expect(diagnostics.filter((d) => d.category === 'error')).toEqual([]);
  });

  it("reports errors in the tests only when asked, and never as the learner's", () => {
    const code = 'export const total = (xs: number[]): string => String(xs.length);\n';
    const tests =
      "import { total } from './solution';\nconst n: number = total([]);\ntest('x', () => expect(n).toBe(0));\n";
    expect(check({ code, tests }).some((d) => d.file === 'tests')).toBe(false);
    const withTests = check({ code, tests }, { tests: true });
    expect(withTests.filter((d) => d.file === 'tests').map((d) => d.code)).toEqual([2322]);
    expect(withTests.some((d) => d.file === 'code')).toBe(false);
  });

  it('flags a package import, which the sandbox cannot load either', () => {
    expect(
      codeErrors("import { z } from 'zod';\nexport const total = z;\n").map((d) => d.code),
    ).toEqual([2307]);
  });

  it('reports syntax errors as well as type errors', () => {
    expect(
      codeErrors('export const total = (xs: number[]) => xs.length +;\n').map((d) => d.code),
    ).toEqual([1109]);
  });

  it('reports an unused @ts-expect-error, the prompt to delete it once the line is fixed', () => {
    const code =
      'export function total(xs: number[]): number {\n  // @ts-expect-error: fix me\n  return xs.length;\n}\n';
    expect(codeErrors(code).map((d) => d.code)).toEqual([2578]);
  });

  it('stays fast once the library is parsed', () => {
    check({ code: 'export const total = 1;\n', tests: TESTS });
    const start = performance.now();
    for (let i = 0; i < 10; i += 1) check({ code: `export const total = ${i};\n`, tests: TESTS });
    expect((performance.now() - start) / 10).toBeLessThan(200);
  });
});

describe('the checker options', () => {
  it('are tsconfig.content.json, plus moduleDetection', () => {
    const raw = readFileSync(path.resolve(__dirname, '../../../../tsconfig.content.json'), 'utf8');
    // The file has comments. Strip whole-line ones and parse the rest.
    const json = JSON.parse(raw.replace(/^\s*\/\/.*$/gm, '')) as {
      compilerOptions: Record<string, unknown>;
    };
    const lower = (value: unknown): unknown =>
      typeof value === 'string'
        ? value.toLowerCase()
        : Array.isArray(value)
          ? value.map(lower)
          : value;
    const expected = Object.fromEntries(
      Object.entries(json.compilerOptions).map(([key, value]) => [key, lower(value)]),
    );
    expect({ ...CHECKER_COMPILER_OPTIONS }).toEqual({ ...expected, moduleDetection: 'force' });
  });
});
