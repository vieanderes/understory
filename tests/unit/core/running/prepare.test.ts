import { describe, expect, it } from 'vitest';
import type { RunRequest, Transpiler } from '@/core/ports/code-runner';
import { LIMITS, LOG_TRUNCATION_NOTICE } from '@/core/running/limits';
import { errorResult, prepareRun, reportToResult, timeoutResult } from '@/core/running/prepare';
import { TranspileError } from '@/core/running/transpile-error';

const request: RunRequest = {
  runId: 'r1',
  language: 'ts',
  code: 'CODE',
  tests: 'TESTS',
  timeoutMs: 1000,
  harnessVersion: 1,
};

const upper: Transpiler = { strip: (src, lang) => `${lang}:${src.toLowerCase()}` };

function failingOn(marker: string, error: unknown): Transpiler {
  return {
    strip(src) {
      if (src === marker) throw error;
      return src;
    },
  };
}

describe('prepareRun', () => {
  it('marks a tsx run as needing the React runtime, and only a tsx run', () => {
    expect(prepareRun({ ...request, language: 'tsx' }, upper)).toEqual({
      ok: true,
      run: { engine: 'js', code: 'tsx:code', tests: 'tsx:tests', runtime: 'react' },
    });
    const plain = prepareRun({ ...request, language: 'js' }, upper);
    expect(plain.ok && 'runtime' in plain.run).toBe(false);
  });

  it('transpiles the code and the tests with the language of the request', () => {
    expect(prepareRun(request, upper)).toEqual({
      ok: true,
      run: { engine: 'js', code: 'ts:code', tests: 'ts:tests' },
    });
  });

  it('passes Python through untouched, for Pyodide, without the transpiler', () => {
    const never: Transpiler = {
      strip() {
        throw new Error('A Python run must not reach the transpiler');
      },
    };
    expect(
      prepareRun({ ...request, language: 'python', code: 'def f():\n    pass' }, never),
    ).toEqual({ ok: true, run: { engine: 'python', code: 'def f():\n    pass', tests: 'TESTS' } });
  });

  it('lists the packages a Python run imports, with those the request names', () => {
    const run = prepareRun(
      {
        ...request,
        language: 'python',
        code: 'import numpy as np\n',
        tests: 'from pandas import DataFrame\n',
        packages: ['pydantic', 'numpy'],
      },
      null,
    );
    expect(run.ok && run.run.packages).toEqual(['numpy', 'pandas', 'pydantic']);
    const plain = prepareRun({ ...request, language: 'python', code: 'import json\n' }, null);
    expect(plain.ok && 'packages' in plain.run).toBe(false);
  });

  it('refuses a package the runners do not ship', () => {
    const bad = { ...request, language: 'python', packages: ['scipy'] } as unknown as RunRequest;
    const prepared = prepareRun(bad, null);
    expect(prepared.ok).toBe(false);
    expect(!prepared.ok && prepared.error.name).toBe('InvalidRequest');
  });

  it('accepts a Python run with no transpiler at all', () => {
    expect(prepareRun({ ...request, language: 'python' }, null).ok).toBe(true);
    expect(prepareRun(request, null)).toEqual({
      ok: false,
      error: { name: 'SandboxError', message: 'The code tools could not be loaded. Try again.' },
    });
  });

  it('turns a syntax error in the code into an error with a line', () => {
    const prepared = prepareRun(
      request,
      failingOn('CODE', new TranspileError('Unexpected token', 4)),
    );
    expect(prepared).toEqual({
      ok: false,
      error: { name: 'SyntaxError', message: 'Unexpected token', line: 4 },
    });
  });

  it('omits the line when the transpiler has none', () => {
    const prepared = prepareRun(request, failingOn('CODE', new TranspileError('Bad')));
    expect(prepared).toEqual({ ok: false, error: { name: 'SyntaxError', message: 'Bad' } });
  });

  it('keeps `line` for the learner: a test-file line goes into the message', () => {
    const withLine = prepareRun(
      request,
      failingOn('TESTS', new TranspileError('Unexpected token', 2)),
    );
    expect(withLine).toEqual({
      ok: false,
      error: { name: 'SyntaxError', message: 'Unexpected token (tests, line 2)' },
    });
    const without = prepareRun(request, failingOn('TESTS', 'plain string'));
    expect(without).toEqual({ ok: false, error: { name: 'SyntaxError', message: 'plain string' } });
  });

  it.each([
    ['an empty runId', { ...request, runId: '' }, 'runId'],
    ['a timeout that is too long', { ...request, timeoutMs: LIMITS.maxTimeoutMs + 1 }, 'timeoutMs'],
    ['oversized code', { ...request, code: 'x'.repeat(LIMITS.maxSourceBytes + 1) }, 'code'],
  ])('rejects %s before transpiling', (_, bad, field) => {
    const prepared = prepareRun(bad, upper);
    expect(prepared.ok).toBe(false);
    if (!prepared.ok) {
      expect(prepared.error.name).toBe('InvalidRequest');
      expect(prepared.error.message).toContain(field);
    }
  });
});

describe('results', () => {
  it('builds an error result', () => {
    expect(errorResult({ name: 'E', message: 'm' }, 12)).toEqual({
      status: 'error',
      tests: [],
      logs: [],
      error: { name: 'E', message: 'm' },
      durationMs: 12,
    });
    expect(errorResult({ name: 'E', message: 'm' }, 1, ['kept']).logs).toEqual(['kept']);
  });

  it('builds a timeout result that says what to look for', () => {
    const result = timeoutResult(1500, 1510, ['before']);
    expect(result.status).toBe('timeout');
    expect(result.logs).toEqual(['before']);
    expect(result.error?.name).toBe('Timeout');
    expect(result.error?.message).toContain('1500 ms');
  });

  it('adds the duration to a harness report and caps its logs again', () => {
    const passed = reportToResult(
      { status: 'passed', tests: [{ name: 'a', passed: true }], logs: ['x'] },
      7,
    );
    expect(passed).toEqual({
      status: 'passed',
      tests: [{ name: 'a', passed: true }],
      logs: ['x'],
      durationMs: 7,
    });

    const flooded = reportToResult(
      {
        status: 'error',
        tests: [],
        logs: Array.from({ length: 300 }, () => 'x'),
        error: { name: 'E', message: 'm', line: 2 },
      },
      1,
    );
    expect(flooded.logs).toHaveLength(LIMITS.maxLogLines + 1);
    expect(flooded.logs.at(-1)).toBe(LOG_TRUNCATION_NOTICE);
    expect(flooded.error).toEqual({ name: 'E', message: 'm', line: 2 });
  });
});
