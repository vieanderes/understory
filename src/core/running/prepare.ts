import * as z from 'zod';
import type {
  RunError,
  RunRequest,
  RunResult,
  RunRuntime,
  RunnerLanguage,
  Transpiler,
} from '../ports/code-runner';
import { LIMITS } from './limits';
import { capLogs } from './log-buffer';
import { importedPythonPackages, PYTHON_PACKAGES, type PythonPackage } from './python-packages';
import type { HarnessReport } from './protocol';
import { TranspileError } from './transpile-error';

/**
 * The steps every runner shares: check the request, transpile both sources, and turn
 * what came back into a `RunResult`. Keeping them here is what makes the browser and
 * the CI gate agree on a verdict.
 */

const runRequestSchema = z.object({
  runId: z.string().min(1).max(LIMITS.maxRunIdLength),
  language: z.enum(['js', 'ts', 'tsx', 'python']),
  code: z.string().max(LIMITS.maxSourceBytes),
  tests: z.string().max(LIMITS.maxSourceBytes),
  timeoutMs: z.number().int().min(LIMITS.minTimeoutMs).max(LIMITS.maxTimeoutMs),
  harnessVersion: z.literal(1),
  packages: z.array(z.enum(PYTHON_PACKAGES)).max(PYTHON_PACKAGES.length).optional(),
});

export interface PreparedRun {
  /** Which worker the frame starts: the JavaScript harness or Pyodide. */
  engine: 'js' | 'python';
  code: string;
  tests: string;
  /**
   * Set when the run needs a runtime before the harness. Such a run also evaluates code
   * and tests in separate scopes: they are two modules that meet through imports.
   */
  runtime?: RunRuntime;
  /** Python only, and only when not empty: packages to load before the run starts. */
  packages?: PythonPackage[];
}

export function runtimeFor(language: RunnerLanguage): RunRuntime | undefined {
  return language === 'tsx' ? 'react' : undefined;
}

export type Prepared = { ok: true; run: PreparedRun } | { ok: false; error: RunError };

export function errorResult(error: RunError, durationMs: number, logs: string[] = []): RunResult {
  return { status: 'error', tests: [], logs, error, durationMs };
}

export function timeoutResult(timeoutMs: number, durationMs: number, logs: string[]): RunResult {
  return {
    status: 'timeout',
    tests: [],
    logs,
    error: {
      name: 'Timeout',
      message: `The run did not finish within ${timeoutMs} ms. Look for a loop that never ends.`,
    },
    durationMs,
  };
}

/**
 * `transpiler` may be null for a Python run: the browser then never downloads Sucrase for
 * a learner who only writes Python.
 */
export function prepareRun(req: RunRequest, transpiler: Transpiler | null): Prepared {
  const checked = runRequestSchema.safeParse(req);
  if (!checked.success) {
    const first = checked.error.issues[0];
    const where = first ? `${first.path.join('.')}: ${first.message}` : 'unknown field';
    return {
      ok: false,
      error: { name: 'InvalidRequest', message: `Invalid run request (${where})` },
    };
  }

  // Python syntax errors come from the interpreter itself, with their line.
  if (req.language === 'python') {
    const wanted = new Set<PythonPackage>([
      ...importedPythonPackages(req.code, req.tests),
      ...(req.packages ?? []),
    ]);
    const packages = PYTHON_PACKAGES.filter((name) => wanted.has(name));
    const run: PreparedRun = { engine: 'python', code: req.code, tests: req.tests };
    return { ok: true, run: packages.length > 0 ? { ...run, packages } : run };
  }
  if (transpiler === null) {
    return {
      ok: false,
      error: { name: 'SandboxError', message: 'The code tools could not be loaded. Try again.' },
    };
  }

  let code: string;
  try {
    code = transpiler.strip(req.code, req.language);
  } catch (caught) {
    return { ok: false, error: syntaxError(caught, 'code') };
  }
  let tests: string;
  try {
    tests = transpiler.strip(req.tests, req.language);
  } catch (caught) {
    return { ok: false, error: syntaxError(caught, 'tests') };
  }
  const runtime = runtimeFor(req.language);
  return {
    ok: true,
    run: runtime ? { engine: 'js', code, tests, runtime } : { engine: 'js', code, tests },
  };
}

function syntaxError(caught: unknown, where: 'code' | 'tests'): RunError {
  const message = caught instanceof Error ? caught.message : String(caught);
  const line = caught instanceof TranspileError ? caught.line : undefined;
  if (where === 'code') {
    return line === undefined
      ? { name: 'SyntaxError', message }
      : { name: 'SyntaxError', message, line };
  }
  // `line` always means a line of the learner's code, so a test-file line goes in the text.
  const at = line === undefined ? '' : ` (tests, line ${line})`;
  return { name: 'SyntaxError', message: `${message}${at}` };
}

/** Adds what only the host knows (the clock) and re-applies the log cap. */
export function reportToResult(report: HarnessReport, durationMs: number): RunResult {
  const result: RunResult = {
    status: report.status,
    tests: report.tests,
    logs: capLogs(report.logs),
    durationMs,
  };
  if (report.error) result.error = report.error;
  return result;
}
