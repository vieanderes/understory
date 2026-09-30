import type {
  CodeRunner,
  RunProgress,
  RunRequest,
  RunResult,
  RunRuntime,
  RunSignal,
  Transpiler,
} from '@/core/ports/code-runner';
import { LIMITS } from '@/core/running/limits';
import { capLogs, LogBuffer } from '@/core/running/log-buffer';
import { errorResult, prepareRun, timeoutResult, type PreparedRun } from '@/core/running/prepare';
import { PROTOCOL_VERSION, type FrameMessage, type RunMessage } from '@/core/running/protocol';
import type { PythonPackage } from '@/core/running/python-packages';
import type { PythonAssets } from '../pyodide/assets';
import { openFrameSession, type FrameSession } from './frame-session';
import { loadRuntime } from './runtime-loader';

export const RUNNER_URL = '/sandbox/runner.v1.html';

export interface IframeRunnerOptions {
  /** Usually `loadTranspiler` from adapters/transpile, which lazy-loads sucrase. */
  loadTranspiler: () => Promise<Transpiler>;
  /** The text of a runtime a tsx run needs. Defaults to fetching it from /sandbox/. */
  loadRuntime?: (name: RunRuntime) => Promise<string>;
  /**
   * Usually `fetchPythonAssets` from adapters/pyodide. Called on the first Python run
   * only, so nobody downloads Pyodide for JavaScript. Without it Python runs fail.
   */
  loadPythonAssets?: () => Promise<PythonAssets>;
  /**
   * Usually `fetchPythonPackages` from adapters/pyodide: the wheels the packages need,
   * by file name, except those in `have`. Called when a run first imports a package.
   */
  loadPythonPackages?: (
    names: readonly PythonPackage[],
    have: ReadonlySet<string>,
  ) => Promise<Record<string, ArrayBuffer>>;
  /** What a run is loading before its budget starts, for a status line. */
  onProgress?: (progress: RunProgress) => void;
  runnerUrl?: string;
  /** Where the hidden iframe is attached. Defaults to `document.body`. */
  container?: HTMLElement;
  /** Live output, line by line, for a console that fills while the code runs. */
  onLog?: (runId: string, line: string) => void;
}

interface OpenSession {
  ready: Promise<FrameSession>;
  destroy(): void;
  /** Set once this frame has been handed the Pyodide files. */
  hasPython: boolean;
  /** The packages, and the wheel files, this frame has been handed. */
  packages: Set<PythonPackage>;
  wheels: Set<string>;
}

/**
 * Runs learner code in the sandbox frame.
 *
 * Trust runs one way. The app trusts neither the learner's code nor, in the end, the
 * frame that brokers it: every message is parsed against the protocol schemas, logs are
 * capped again on arrival, and a frame that stops answering is removed by the watchdog.
 *
 * One run at a time. Starting a run while another is live rejects the older promise
 * with an AbortError; the frame terminates the older worker when the new `run` arrives.
 */
export class IframeRunner implements CodeRunner {
  private session: OpenSession | null = null;
  /** Kept for the runner's life: a frame replaced by the watchdog needs them again. */
  private pythonAssets: Promise<PythonAssets> | null = null;
  private cancelActive: ((reason: unknown) => void) | null = null;
  private disposed = false;

  constructor(private readonly options: IframeRunnerOptions) {}

  async run(req: RunRequest, signal?: RunSignal): Promise<RunResult> {
    if (this.disposed) throw new Error('This runner has been disposed.');
    if (signal?.aborted) throw signal.reason ?? abortError('The run was aborted.');
    const startedAt = performance.now();
    const elapsed = (): number => Math.round(performance.now() - startedAt);

    this.cancelActive?.(abortError('A newer run replaced this one.'));

    // From here on this run is the active one. Each await below may be cut short by a
    // newer run, an abort or dispose(), all of which arrive through `cancelled`.
    const cancellation: { reason?: unknown; happened: boolean } = { happened: false };
    let rejectCancelled: (reason: unknown) => void = () => undefined;
    const cancelled = new Promise<never>((_, reject) => {
      rejectCancelled = reject;
    });
    // Without a handler, a cancellation that loses every race below would surface as an
    // unhandled rejection.
    cancelled.catch(() => undefined);
    const cancel = (reason: unknown): void => {
      if (cancellation.happened) return;
      cancellation.happened = true;
      cancellation.reason = reason;
      rejectCancelled(reason);
    };
    this.cancelActive = cancel;
    const onAbort = (): void => {
      cancel(signal?.reason ?? abortError('The run was aborted.'));
      // The worker may be mid-loop. Removing the frame is the one sure way to stop it.
      this.dropSession();
    };
    signal?.addEventListener?.('abort', onAbort, { once: true });

    try {
      let transpiler: Transpiler | null = null;
      if (req.language !== 'python') {
        try {
          transpiler = await Promise.race([this.options.loadTranspiler(), cancelled]);
        } catch {
          if (cancellation.happened) throw cancellation.reason;
          return errorResult(
            { name: 'SandboxError', message: 'The code tools could not be loaded. Try again.' },
            elapsed(),
          );
        }
      }

      const prepared = prepareRun(req, transpiler);
      if (!prepared.ok) return errorResult(prepared.error, elapsed());

      let runtime: RunMessage['runtime'];
      if (prepared.run.runtime) {
        const name = prepared.run.runtime;
        try {
          const source = await Promise.race([
            (this.options.loadRuntime ?? loadRuntime)(name),
            cancelled,
          ]);
          runtime = { name, source };
        } catch {
          if (cancellation.happened) throw cancellation.reason;
          return errorResult(
            { name: 'SandboxError', message: 'The React tools could not be loaded. Try again.' },
            elapsed(),
          );
        }
      }

      const open = this.ensureSession();
      let session: FrameSession;
      try {
        session = await Promise.race([open.ready, cancelled]);
      } catch (caught) {
        if (cancellation.happened) throw cancellation.reason;
        this.dropSession();
        const message = caught instanceof Error ? caught.message : String(caught);
        return errorResult({ name: 'SandboxError', message }, elapsed());
      }

      const needsPython = prepared.run.engine === 'python' && !open.hasPython;
      const missing = (prepared.run.packages ?? []).filter((name) => !open.packages.has(name));
      if (needsPython || missing.length > 0) {
        this.options.onProgress?.({
          runId: req.runId,
          loading: [...(needsPython ? ['Python'] : []), ...missing],
        });
      }

      if (needsPython) {
        try {
          const assets = await Promise.race([this.loadPython(), cancelled]);
          // Replaced by the watchdog of another run while the files were loading.
          if (this.session !== open) throw new Error('The sandbox was closed. Try again.');
          session.send({ v: PROTOCOL_VERSION, type: 'python-assets', runId: req.runId, ...assets });
          open.hasPython = true;
        } catch (caught) {
          if (cancellation.happened) throw cancellation.reason;
          const message = caught instanceof Error ? caught.message : String(caught);
          return errorResult({ name: 'SandboxError', message }, elapsed());
        }
      }

      if (missing.length > 0) {
        try {
          const files = await Promise.race([this.loadPackages(missing, open.wheels), cancelled]);
          if (this.session !== open) throw new Error('The sandbox was closed. Try again.');
          session.send({ v: PROTOCOL_VERSION, type: 'python-packages', runId: req.runId, files });
          for (const name of Object.keys(files)) open.wheels.add(name);
          for (const name of missing) open.packages.add(name);
        } catch (caught) {
          if (cancellation.happened) throw cancellation.reason;
          const message = caught instanceof Error ? caught.message : String(caught);
          return errorResult({ name: 'SandboxError', message }, elapsed());
        }
      }

      const exchange = this.exchange(session, req, prepared.run, runtime, elapsed);
      try {
        return await Promise.race([exchange.result, cancelled]);
      } finally {
        exchange.release();
      }
    } finally {
      signal?.removeEventListener?.('abort', onAbort);
      if (this.cancelActive === cancel) this.cancelActive = null;
    }
  }

  /** Removes the frame and rejects a live run. The runner cannot be used afterwards. */
  dispose(): void {
    this.disposed = true;
    this.cancelActive?.(abortError('The runner was disposed.'));
    this.cancelActive = null;
    this.dropSession();
  }

  private loadPython(): Promise<PythonAssets> {
    const load = this.options.loadPythonAssets;
    if (!load) return Promise.reject(new Error('Python could not be loaded (not configured).'));
    this.pythonAssets ??= load().catch((caught: unknown) => {
      // A failed download is retried by the next run, not remembered.
      this.pythonAssets = null;
      throw caught instanceof Error ? caught : new Error(String(caught));
    });
    return this.pythonAssets;
  }

  private loadPackages(
    names: readonly PythonPackage[],
    have: ReadonlySet<string>,
  ): Promise<Record<string, ArrayBuffer>> {
    const load = this.options.loadPythonPackages;
    if (!load)
      return Promise.reject(new Error('Python packages could not be loaded (not configured).'));
    return load(names, have);
  }

  private exchange(
    session: FrameSession,
    req: RunRequest,
    run: PreparedRun,
    runtime: RunMessage['runtime'],
    elapsed: () => number,
  ): { result: Promise<RunResult>; release(): void } {
    let watchdog: number | undefined;
    // Called on every exit, including cancellation, so no timer or listener outlives a run.
    const release = (): void => {
      window.clearTimeout(watchdog);
      session.listen(null);
    };

    const result = new Promise<RunResult>((resolve) => {
      const logs = new LogBuffer();

      const settle = (outcome: RunResult): void => {
        release();
        resolve(outcome);
      };

      // Second termination layer. The frame enforces `timeoutMs` itself; this fires only
      // when the frame is wedged or hostile, and then the frame is not reused. A Python
      // run's budget starts after Pyodide has started, which the frame reports.
      const arm = (ms: number): void => {
        window.clearTimeout(watchdog);
        watchdog = window.setTimeout(() => {
          this.dropSession();
          settle(timeoutResult(req.timeoutMs, elapsed(), logs.lines()));
        }, ms);
      };
      const budget = req.timeoutMs + LIMITS.watchdogGraceMs;
      arm(run.engine === 'python' ? LIMITS.pythonBootTimeoutMs + budget : budget);

      session.listen((message: FrameMessage) => {
        // A late message of a superseded run must not leak into this one.
        if (message.runId !== req.runId) return;
        if (message.type === 'started') {
          arm(budget);
          this.options.onProgress?.({ runId: req.runId, loading: [] });
          return;
        }
        if (message.type === 'log') {
          if (logs.push(message.line)) this.options.onLog?.(req.runId, message.line);
          return;
        }
        if (message.type === 'done') {
          const outcome: RunResult = {
            status: message.status,
            tests: message.tests,
            logs: capLogs(message.logs),
            durationMs: elapsed(),
          };
          if (message.error) outcome.error = message.error;
          settle(outcome);
        }
      });

      session.send({
        v: PROTOCOL_VERSION,
        type: 'run',
        engine: run.engine,
        runId: req.runId,
        code: run.code,
        tests: run.tests,
        timeoutMs: req.timeoutMs,
        harnessVersion: 1,
        ...(runtime ? { runtime } : {}),
        ...(run.packages ? { packages: run.packages } : {}),
      });
    });

    return { result, release };
  }

  private ensureSession(): OpenSession {
    this.session ??= {
      ...openFrameSession({
        url: this.options.runnerUrl ?? RUNNER_URL,
        container: this.options.container ?? document.body,
      }),
      hasPython: false,
      packages: new Set(),
      wheels: new Set(),
    };
    return this.session;
  }

  private dropSession(): void {
    this.session?.destroy();
    this.session = null;
  }
}

function abortError(message: string): DOMException {
  return new DOMException(message, 'AbortError');
}
