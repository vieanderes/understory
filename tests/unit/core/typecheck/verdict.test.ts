import { describe, expect, it } from 'vitest';
import type { RunResult } from '@/core/ports/code-runner';
import type { TypeDiagnostic } from '@/core/ports/type-checker';
import { NO_TYPE_ERRORS, TYPE_ERRORS, typecheckOf, withTypeCheck } from '@/core/typecheck/verdict';

const passed: RunResult = {
  status: 'passed',
  tests: [{ name: 'adds', passed: true }],
  logs: [],
};

const error: TypeDiagnostic = {
  from: 10,
  to: 20,
  line: 3,
  column: 5,
  code: 2345,
  message: "Argument of type 'string' is not assignable to parameter of type 'number'.",
};

describe('typecheckOf', () => {
  it('checks TypeScript challenges unless the step says otherwise', () => {
    expect(typecheckOf({ language: 'ts' })).toBe(true);
    expect(typecheckOf({ language: 'ts', typecheck: false })).toBe(false);
    expect(typecheckOf({ language: 'ts', typecheck: true })).toBe(true);
  });

  it('never checks a TypeScript step that names .js files: they are plain JavaScript', () => {
    expect(typecheckOf({ language: 'ts', starter: 'starter.js' })).toBe(false);
    expect(typecheckOf({ language: 'ts', starter: 'total.starter.ts' })).toBe(true);
  });

  it('never checks JavaScript, Python or tsx, whatever the step says', () => {
    expect(typecheckOf({ language: 'js' })).toBe(false);
    expect(typecheckOf({ language: 'python', typecheck: true })).toBe(false);
    expect(typecheckOf({ language: 'tsx', typecheck: true })).toBe(false);
  });
});

describe('withTypeCheck', () => {
  it('fails a run whose tests pass when the code has type errors', () => {
    const result = withTypeCheck(passed, { status: 'checked', diagnostics: [error] });
    expect(result.status).toBe('failed');
    expect(result.tests[0]).toEqual({
      name: TYPE_ERRORS,
      passed: false,
      message: `Line 3: ${error.message}`,
    });
    expect(result.tests.slice(1)).toEqual(passed.tests);
  });

  it('adds a passing check when the code is clean', () => {
    const result = withTypeCheck(passed, { status: 'checked', diagnostics: [] });
    expect(result.status).toBe('passed');
    expect(result.tests[0]).toEqual({ name: NO_TYPE_ERRORS, passed: true });
    expect(result.tests).toHaveLength(2);
  });

  it('keeps a failing, crashed or timed-out run as it was, with the check added', () => {
    for (const status of ['failed', 'error', 'timeout'] as const) {
      const run: RunResult = { ...passed, status };
      const result = withTypeCheck(run, { status: 'checked', diagnostics: [error] });
      expect(result.status).toBe(status);
      expect(result.tests[0]?.name).toBe(TYPE_ERRORS);
    }
  });

  it('leaves the run alone when the checker could not answer: the tests decide', () => {
    const result = withTypeCheck(passed, { status: 'unavailable', reason: 'offline' });
    expect(result).toBe(passed);
  });

  it('does not change the run it was given', () => {
    const run: RunResult = { ...passed, tests: [...passed.tests] };
    withTypeCheck(run, { status: 'checked', diagnostics: [error] });
    expect(run).toEqual(passed);
  });
});
