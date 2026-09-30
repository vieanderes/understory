'use client';

import { useEffect, useRef, useState } from 'react';
import { fetchPythonAssets, fetchPythonPackages } from '@/adapters/pyodide/assets';
import { IframeRunner } from '@/adapters/sandbox/iframe-runner';
import { loadTranspiler } from '@/adapters/transpile/sucrase';
import type { RunLanguage, RunResult } from '@/core/ports/code-runner';

const STARTER_CODE = `export function add(a: number, b: number): number {
  return a + b;
}
`;

const STARTER_TESTS = `test('adds two numbers', () => {
  expect(add(1, 2)).toBe(3);
});

test('adds negatives', () => {
  expect(add(-1, -2)).toBe(-3);
});
`;

function toLanguage(value: string): RunLanguage {
  return value === 'js' || value === 'tsx' || value === 'python' ? value : 'ts';
}

const FIELD =
  'bg-surface border-border rounded-control w-full border p-1 font-mono text-sm text-fg';

export function SandboxHarness() {
  const [code, setCode] = useState(STARTER_CODE);
  const [tests, setTests] = useState(STARTER_TESTS);
  const [language, setLanguage] = useState<RunLanguage>('ts');
  const [timeoutMs, setTimeoutMs] = useState(2000);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [runCount, setRunCount] = useState(0);
  const [ticks, setTicks] = useState(0);
  const runnerRef = useRef<IframeRunner | null>(null);

  // The iframe belongs to the runner, not to React. Remove it with the page.
  useEffect(
    () => () => {
      runnerRef.current?.dispose();
      runnerRef.current = null;
    },
    [],
  );

  async function run() {
    runnerRef.current ??= new IframeRunner({
      loadTranspiler,
      loadPythonAssets: () => fetchPythonAssets(),
      loadPythonPackages: (names, have) => fetchPythonPackages(names, have),
    });
    setRunning(true);
    try {
      const outcome = await runnerRef.current.run({
        runId: `bench-${Date.now().toString(36)}`,
        language,
        code,
        tests,
        timeoutMs,
        harnessVersion: 1,
      });
      setResult(outcome);
    } catch (caught) {
      // Only a superseded or disposed run rejects. Show it rather than swallow it.
      setResult({
        status: 'error',
        tests: [],
        logs: [],
        error: { name: 'Aborted', message: caught instanceof Error ? caught.message : 'Aborted' },
        durationMs: 0,
      });
    } finally {
      setRunning(false);
      setRunCount((count) => count + 1);
    }
  }

  return (
    <main id="content" className="frame flex flex-col gap-3 py-4">
      <header className="flex flex-col gap-1">
        <p className="t-label">Development</p>
        <h1 className="t-section">Sandbox bench</h1>
        <p className="text-muted prose-measure">
          Runs the code below against the tests in the sandboxed frame. Used by the end-to-end suite
          and for manual checks.
        </p>
      </header>

      <div className="grid gap-2 md:grid-cols-2">
        <label className="flex flex-col gap-0.5">
          <span className="t-label">Code</span>
          <textarea
            data-testid="code-input"
            className={FIELD}
            rows={12}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="t-label">Tests</span>
          <textarea
            data-testid="tests-input"
            className={FIELD}
            rows={12}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            value={tests}
            onChange={(event) => setTests(event.target.value)}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-0.5">
          <span className="t-label">Language</span>
          <select
            data-testid="language-input"
            className={`${FIELD} min-h-6`}
            value={language}
            onChange={(event) => setLanguage(toLanguage(event.target.value))}
          >
            <option value="ts">TypeScript</option>
            <option value="js">JavaScript</option>
            <option value="tsx">TSX with React</option>
            <option value="python">Python</option>
          </select>
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="t-label">Timeout in ms</span>
          <input
            data-testid="timeout-input"
            className={`${FIELD} min-h-6`}
            type="number"
            min={100}
            max={30000}
            step={100}
            value={timeoutMs}
            onChange={(event) => setTimeoutMs(Number(event.target.value))}
          />
        </label>
        <button
          type="button"
          data-testid="run-button"
          className="bg-accent text-accent-fg rounded-control min-h-6 px-3 font-medium"
          onClick={() => void run()}
        >
          Run
        </button>
        {/* Proves the page still answers clicks while learner code spins in the worker. */}
        <button
          type="button"
          data-testid="tick-button"
          className="border-border rounded-control min-h-6 border px-3"
          onClick={() => setTicks((count) => count + 1)}
        >
          Ticks: <span data-testid="tick-count">{ticks}</span>
        </button>
      </div>

      <section
        aria-label="Results"
        aria-live="polite"
        data-testid="results"
        data-running={running}
        data-run-count={runCount}
        className="rule-t flex flex-col gap-2 pt-2"
      >
        <p className="t-label">
          Status:{' '}
          <span data-testid="run-status">{running ? 'running' : (result?.status ?? 'idle')}</span>
          {result && !running ? (
            <span data-testid="run-duration" className="t-figure">
              {' '}
              in {result.durationMs ?? 0} ms
            </span>
          ) : null}
        </p>

        {result?.error && !running ? (
          <p data-testid="run-error" className="text-danger font-mono text-sm">
            <span data-testid="run-error-name">{result.error.name}</span>:{' '}
            <span data-testid="run-error-message">{result.error.message}</span>
            {result.error.line !== undefined ? (
              <span data-testid="run-error-line"> (line {result.error.line})</span>
            ) : null}
          </p>
        ) : null}

        {result && !running ? (
          <>
            <ul data-testid="test-results" className="flex flex-col gap-0.5">
              {result.tests.map((test, index) => (
                <li
                  key={`${index}-${test.name}`}
                  data-testid="test-result"
                  data-passed={test.passed}
                  className="font-mono text-sm"
                >
                  <span className={test.passed ? 'text-success' : 'text-danger'}>
                    {test.passed ? 'pass' : 'fail'}
                  </span>{' '}
                  <span data-testid="test-name">{test.name}</span>
                  {test.message !== undefined ? (
                    <span data-testid="test-message" className="text-muted block">
                      {test.message}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
            <pre
              data-testid="run-logs"
              data-line-count={result.logs.length}
              tabIndex={0}
              aria-label="Console output"
              className="bg-sunken rounded-control max-h-40 overflow-auto p-1 font-mono text-sm"
            >
              {result.logs.join('\n')}
            </pre>
          </>
        ) : null}
      </section>
    </main>
  );
}
