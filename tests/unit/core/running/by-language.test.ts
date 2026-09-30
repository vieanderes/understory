import { describe, expect, it } from 'vitest';
import type { CodeRunner, RunRequest, RunResult } from '@/core/ports/code-runner';
import { byLanguage } from '@/core/running/by-language';

function named(label: string): CodeRunner & { seen: string[] } {
  const seen: string[] = [];
  return {
    seen,
    run(req) {
      seen.push(req.runId);
      const result: RunResult = {
        status: 'passed',
        tests: [{ name: label, passed: true }],
        logs: [],
      };
      return Promise.resolve(result);
    },
  };
}

const request = (language: RunRequest['language'], runId: string): RunRequest => ({
  runId,
  language,
  code: '',
  tests: '',
  timeoutMs: 1000,
  harnessVersion: 1,
});

describe('byLanguage', () => {
  it('sends Python to the Python runner and the rest to the script runner', async () => {
    const script = named('script');
    const python = named('python');
    const runner = byLanguage({ script, python });
    await runner.run(request('ts', 'a'));
    await runner.run(request('python', 'b'));
    await runner.run(request('js', 'c'));
    expect(script.seen).toEqual(['a', 'c']);
    expect(python.seen).toEqual(['b']);
  });

  it('creates the Python runner only when a Python run arrives', async () => {
    let made = 0;
    const runner = byLanguage({
      script: named('script'),
      python: () => {
        made += 1;
        return named('python');
      },
    });
    await runner.run(request('js', 'a'));
    expect(made).toBe(0);
    await runner.run(request('python', 'b'));
    await runner.run(request('python', 'c'));
    expect(made).toBe(1);
  });
});
