import { describe, expect, it } from 'vitest';
import { LIMITS, LOG_TRUNCATION_NOTICE } from '@/core/running/limits';
import { PYTHON_HARNESS_V1 } from '@/core/running/python-harness';

/*
 * The harness itself runs under Pyodide in tests/unit/adapters/node-runner/
 * pyodide-runner.test.ts. Here: what can be checked on the text alone.
 */

function constant(name: string): string | undefined {
  return new RegExp(`^${name} = (.+)$`, 'm').exec(PYTHON_HARNESS_V1)?.[1];
}

describe('the Python harness text', () => {
  it('repeats the limits of limits.ts', () => {
    expect(constant('MAX_LOG_LINES')).toBe(String(LIMITS.maxLogLines));
    expect(constant('MAX_LOG_BYTES')).toBe(String(LIMITS.maxLogBytes));
    expect(constant('MAX_LOG_LINE_LENGTH')).toBe(String(LIMITS.maxLogLineLength));
    expect(constant('MAX_TESTS')).toBe(String(LIMITS.maxTests));
    expect(constant('MAX_NAME_LENGTH')).toBe(String(LIMITS.maxTestNameLength));
    expect(constant('MAX_MESSAGE_LENGTH')).toBe(String(LIMITS.maxMessageLength));
    expect(constant('TRUNCATION_NOTICE')).toBe(`'${LOG_TRUNCATION_NOTICE}'`);
  });

  it('reads the directive that evaluate.ts writes', () => {
    expect(PYTHON_HARNESS_V1).toContain(
      String.raw`_ONLY = _re.compile(r'\A__only = (-?\d+)\r?\n')`,
    );
  });

  it('indents with spaces only, as Python needs', () => {
    expect(PYTHON_HARNESS_V1).not.toMatch(/\t/);
  });

  it('defines the entry point the hosts call', () => {
    expect(PYTHON_HARNESS_V1).toMatch(/^def run\(code, tests, host_log=None\):$/m);
  });
});
