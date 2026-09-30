import { createRequire } from 'node:module';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import type { CodeRunner, RunRequest, RunResult, RunSignal } from '@/core/ports/code-runner';
import { LIMITS } from '@/core/running/limits';
import { LogBuffer } from '@/core/running/log-buffer';
import { errorResult, prepareRun, reportToResult, timeoutResult } from '@/core/running/prepare';
import { parseHarnessReport } from '@/core/running/protocol';
import { PYTHON_HARNESS_V1 } from '@/core/running/python-harness';
import type { PythonPackage } from '@/core/running/python-packages';
import { ensureWheels, wheelCacheDir } from '../pyodide/wheels';
import { NODE_PYODIDE_WORKER_SOURCE } from './pyodide-worker-source';

/**
 * Runs Python lesson code in CI with the Pyodide build the browser loads and the same
 * harness string, so the gate and the learner agree on a verdict.
 *
 * One warm worker thread. A cold Pyodide start is about 1.5 s and a run a few
 * milliseconds, so a thread per run (as NodeWorkerRunner does for JavaScript) would make
 * the gate spend nearly all its time starting interpreters. Runs queue, one at a time.
 * The budget of a run starts when the warm interpreter receives it, so neither the start
 * nor the queue counts against it. A run that overstays is a timeout, and its thread is
 * terminated and replaced.
 *
 * Packages (numpy, pandas, pydantic) are fetched into the wheel cache once, checked
 * against the lock file, and loaded by the thread before the run's budget starts, as in
 * the browser: the thread says `started` when the code is about to run.
 */

export interface NodePyodideRunnerOptions {
  /** The `pyodide` package entry. Resolved from the working directory by default. */
  pyodidePath?: string;
  /** How long an interpreter may take to start, and a run's packages to load. */
  bootTimeoutMs?: number;
  /** Where the wheels are. Defaults to the cache that `ensureWheels` fills. */
  packageDir?: string;
  /** Puts the wheels a run needs into `packageDir`. Replaced in tests. */
  ensurePackages?: (names: readonly PythonPackage[]) => Promise<unknown>;
}

interface Job {
  req: RunRequest;
  code: string;
  tests: string;
  packages: PythonPackage[];
  signal: RunSignal | undefined;
  startedAt: number;
  resolve(result: RunResult): void;
  reject(reason: unknown): void;
}

interface Thread {
  worker: Worker;
  ready: Promise<void>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function defaultPyodidePath(): string {
  return createRequire(path.join(process.cwd(), 'package.json')).resolve('pyodide');
}

export class NodePyodideRunner implements CodeRunner {
  private thread: Thread | null = null;
  private readonly queue: Job[] = [];
  private busy = false;
  private readonly pyodidePath: string;
  private readonly bootTimeoutMs: number;
  private readonly packageDir: string;
  private readonly ensurePackages: (names: readonly PythonPackage[]) => Promise<unknown>;
  /** Packages whose wheels are known to be on disk. */
  private readonly onDisk = new Set<PythonPackage>();

  constructor(options: NodePyodideRunnerOptions = {}) {
    this.pyodidePath = options.pyodidePath ?? defaultPyodidePath();
    this.bootTimeoutMs = options.bootTimeoutMs ?? LIMITS.pythonBootTimeoutMs;
    this.packageDir = options.packageDir ?? wheelCacheDir();
    this.ensurePackages = options.ensurePackages ?? ((names) => ensureWheels(names));
  }

  run(req: RunRequest, signal?: RunSignal): Promise<RunResult> {
    const startedAt = performance.now();
    if (signal?.aborted) return Promise.reject(abortReason(signal));
    const prepared = prepareRun(req, null);
    if (!prepared.ok) return Promise.resolve(errorResult(prepared.error, 0));
    if (prepared.run.engine !== 'python') {
      return Promise.resolve(
        errorResult({ name: 'InvalidRequest', message: 'This runner runs Python only.' }, 0),
      );
    }
    return new Promise<RunResult>((resolve, reject) => {
      this.queue.push({
        req,
        code: prepared.run.code,
        tests: prepared.run.tests,
        packages: prepared.run.packages ?? [],
        signal,
        startedAt,
        resolve,
        reject,
      });
      void this.next();
    });
  }

  /** Ends the thread. Queued runs are rejected. */
  dispose(): void {
    for (const job of this.queue.splice(0)) job.reject(new Error('The runner was disposed.'));
    this.kill();
  }

  private spawn(): Thread {
    const worker = new Worker(NODE_PYODIDE_WORKER_SOURCE, {
      eval: true,
      workerData: {
        pyodidePath: this.pyodidePath,
        packageDir: this.packageDir,
        harness: PYTHON_HARNESS_V1,
      },
      env: {},
      execArgv: [],
      stdout: true,
      stderr: true,
    });
    // A warm interpreter waiting for work must not keep the gate's process alive.
    worker.unref();
    const ready = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Pyodide did not start in time.')),
        this.bootTimeoutMs,
      );
      const onMessage = (message: unknown): void => {
        if (!isRecord(message)) return;
        if (message.type === 'ready') {
          clearTimeout(timer);
          worker.off('message', onMessage);
          resolve();
        } else if (message.type === 'boot-error') {
          clearTimeout(timer);
          reject(new Error(`Pyodide could not start: ${String(message.message)}`));
        }
      };
      worker.on('message', onMessage);
      worker.once('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
    ready.catch(() => undefined);
    return { worker, ready };
  }

  private kill(): void {
    const thread = this.thread;
    this.thread = null;
    if (!thread) return;
    thread.worker.removeAllListeners();
    void thread.worker.terminate().catch(() => undefined);
  }

  private async next(): Promise<void> {
    if (this.busy) return;
    const job = this.queue.shift();
    if (!job) return;
    this.busy = true;
    try {
      job.resolve(await this.execute(job));
    } catch (caught) {
      job.reject(caught);
    } finally {
      this.busy = false;
      void this.next();
    }
  }

  private async execute(job: Job): Promise<RunResult> {
    const elapsed = (): number => Math.round(performance.now() - job.startedAt);
    if (job.signal?.aborted) throw abortReason(job.signal);

    const missing = job.packages.filter((name) => !this.onDisk.has(name));
    if (missing.length > 0) {
      try {
        await this.ensurePackages(missing);
        for (const name of missing) this.onDisk.add(name);
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : String(caught);
        return errorResult({ name: 'SandboxError', message }, elapsed());
      }
    }

    this.thread ??= this.spawn();
    const thread = this.thread;
    try {
      await thread.ready;
    } catch (caught) {
      this.kill();
      const message = caught instanceof Error ? caught.message : String(caught);
      return errorResult({ name: 'SandboxError', message }, elapsed());
    }

    return new Promise<RunResult>((resolve, reject) => {
      const logs = new LogBuffer();
      const { worker } = thread;
      let settled = false;

      const finish = (settle: () => void, replace: boolean): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        job.signal?.removeEventListener?.('abort', onAbort);
        worker.off('message', onMessage);
        worker.off('error', onError);
        worker.off('exit', onExit);
        if (replace) this.kill();
        settle();
      };

      // Until the thread says `started` it is loading packages, which has its own allowance.
      let timer = setTimeout(() => {
        finish(
          () =>
            resolve(
              errorResult(
                { name: 'SandboxError', message: 'The packages did not load in time.' },
                elapsed(),
              ),
            ),
          true,
        );
      }, this.bootTimeoutMs);

      const onAbort = (): void => finish(() => reject(abortReason(job.signal)), true);
      job.signal?.addEventListener?.('abort', onAbort, { once: true });

      const onMessage = (message: unknown): void => {
        if (!isRecord(message) || message.runId !== job.req.runId) return;
        if (message.type === 'started') {
          clearTimeout(timer);
          timer = setTimeout(() => {
            finish(() => resolve(timeoutResult(job.req.timeoutMs, elapsed(), logs.lines())), true);
          }, job.req.timeoutMs);
          return;
        }
        if (message.type === 'log' && typeof message.line === 'string') {
          logs.push(message.line);
          return;
        }
        if (message.type !== 'done') return;
        const report = parseHarnessReport(message.report);
        const outcome = report
          ? reportToResult(report, elapsed())
          : errorResult(
              { name: 'ProtocolError', message: 'The harness returned a malformed report.' },
              elapsed(),
              logs.lines(),
            );
        finish(() => resolve(outcome), message.fatal === true);
      };
      const onError = (error: Error): void => {
        finish(
          () =>
            resolve(
              errorResult({ name: error.name, message: error.message }, elapsed(), logs.lines()),
            ),
          true,
        );
      };
      const onExit = (): void => {
        finish(
          () =>
            resolve(
              errorResult(
                { name: 'RunnerError', message: 'The run ended without a result.' },
                elapsed(),
                logs.lines(),
              ),
            ),
          true,
        );
      };

      worker.on('message', onMessage);
      worker.on('error', onError);
      worker.on('exit', onExit);
      worker.postMessage({
        runId: job.req.runId,
        code: job.code,
        tests: job.tests,
        packages: job.packages,
      });
    });
  }
}

function abortReason(signal: RunSignal | undefined): unknown {
  return signal?.reason ?? new DOMException('The run was aborted.', 'AbortError');
}
