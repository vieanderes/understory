import type { PythonPackage } from '../running/python-packages';

/**
 * The code-runner contract shared by the browser sandbox and the Node CI gate
 * (docs/ARCHITECTURE.md "Code runner port"). Grading (src/core/grading) only needs
 * `RunResult`; `src/core/running` needs the rest to prepare and report a run. Both are
 * declared here so neither folder duplicates the shape.
 *
 * One request shape and one result shape serve every runtime: the sandboxed iframe in
 * the browser, worker_threads in CI and, later, JavaScriptCore on iOS or a remote
 * runner for languages a browser cannot execute. Python is the exception that runs in the
 * browser: Pyodide in the same sandbox frame (docs/SANDBOX.md, "Python").
 */

/** `tsx` is TypeScript with JSX, run with React and a worker DOM (docs/SANDBOX.md). */
export type RunnerLanguage = 'js' | 'ts' | 'tsx' | 'python';
/** The languages the transpiler reads. Python runs as written, through Pyodide. */
export type ScriptLanguage = Exclude<RunnerLanguage, 'python'>;
/**
 * Extra code a run evaluates before the harness. Only `tsx` needs one: React, a DOM and
 * Testing Library, loaded on the first such run.
 */
export type RunRuntime = 'react';
/** Alias kept for the sandbox milestone's own modules. */
export type RunLanguage = RunnerLanguage;

export interface RunRequest {
  /** Chosen by the caller. Every wire message of the run echoes it. */
  runId: string;
  language: RunnerLanguage;
  /** Learner code, as typed. Treated as hostile by every runner. */
  code: string;
  /** Test source in the same language. Shares one scope with the learner code. */
  tests: string;
  /** Budget for the whole run: load, every test and all awaited work. */
  timeoutMs: number;
  harnessVersion: 1;
  /**
   * Python only: packages to load before the run, beside those the code and tests import
   * (src/core/running/python-packages.ts). A lesson names them, so a learner who has not
   * typed the import yet still gets them.
   */
  packages?: readonly PythonPackage[];
}

/**
 * What a run is waiting for before its budget starts. `loading` names what is being
 * fetched or started, in the order a learner would say it ("Python", "numpy"); empty
 * means the code is running.
 */
export interface RunProgress {
  runId: string;
  loading: readonly string[];
}

export interface RunError {
  name: string;
  message: string;
  /** 1-based line in the learner's code, when the failure points at one. */
  line?: number;
}

export interface TestResult {
  name: string;
  passed: boolean;
  message?: string;
}

export type RunStatus = 'passed' | 'failed' | 'timeout' | 'error';

export interface RunResult {
  status: RunStatus;
  tests: TestResult[];
  logs: string[];
  error?: RunError;
  /** Always set by the runners. Optional so that grading fixtures need not invent one. */
  durationMs?: number;
}

/**
 * Strips TypeScript syntax to plain JavaScript and rewrites `import` and `export` so
 * the code runs as a script. Implemented with Sucrase, in both the browser and Node, so
 * the two runtimes see the same source. Throws `TranspileError`
 * (src/core/running/transpile-error.ts) when the source does not parse.
 */
export interface Transpiler {
  strip(src: string, lang: ScriptLanguage): string;
}

/**
 * The part of a DOM `AbortSignal` a runner uses. Declared structurally because core is
 * compiled without the DOM library; a real `AbortSignal` satisfies it, and so does a
 * bare `{ aborted }` flag checked once before the run starts.
 */
export interface RunSignal {
  readonly aborted: boolean;
  readonly reason?: unknown;
  addEventListener?(type: 'abort', listener: () => void, options?: { once?: boolean }): void;
  removeEventListener?(type: 'abort', listener: () => void): void;
}

export interface CodeRunner {
  /**
   * Resolves for every outcome of the learner's code, including timeouts and crashes.
   * Rejects only when the caller aborts through `signal` or a newer run replaces this one.
   */
  run(req: RunRequest, signal?: RunSignal): Promise<RunResult>;
}
