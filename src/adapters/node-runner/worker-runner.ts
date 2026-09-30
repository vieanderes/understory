import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Worker } from 'node:worker_threads';
import type {
  CodeRunner,
  RunRequest,
  RunResult,
  RunRuntime,
  RunSignal,
  Transpiler,
} from '@/core/ports/code-runner';
import { HARNESS_V1 } from '@/core/running/harness';
import { LogBuffer } from '@/core/running/log-buffer';
import { errorResult, prepareRun, reportToResult, timeoutResult } from '@/core/running/prepare';
import { parseHarnessReport } from '@/core/running/protocol';
import { NODE_WORKER_SOURCE } from './worker-source';

/**
 * Runs lesson code in CI with the same harness string and the same transpiler as the
 * browser, so "the reference solution passes" means the same thing in both places.
 *
 * One worker thread per run. A thread is the unit Node can kill: `terminate()` stops a
 * `while (true) {}` that no in-thread timer could interrupt.
 */

/** Generous for a lesson, small enough that a runaway allocation dies fast. */
const RESOURCE_LIMITS = {
  maxOldGenerationSizeMb: 128,
  maxYoungGenerationSizeMb: 32,
  stackSizeMb: 4,
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

const runtimeCache = new Map<RunRuntime, Promise<string>>();

/**
 * The committed browser bundle, read from disk, so the gate runs the very bytes a
 * learner's browser runs. Resolved from the working directory like the other scripts.
 */
export function readCommittedRuntime(name: RunRuntime): Promise<string> {
  let pending = runtimeCache.get(name);
  if (!pending) {
    pending = readFile(path.join(process.cwd(), 'public/sandbox/react-runtime.v1.js'), 'utf8');
    runtimeCache.set(name, pending);
  }
  return pending;
}

export interface NodeWorkerRunnerOptions {
  /** The text of a runtime a tsx run needs. Defaults to the committed bundle. */
  loadRuntime?: (name: RunRuntime) => Promise<string>;
}

export class NodeWorkerRunner implements CodeRunner {
  constructor(
    private readonly transpiler: Transpiler,
    private readonly options: NodeWorkerRunnerOptions = {},
  ) {}

  async run(req: RunRequest, signal?: RunSignal): Promise<RunResult> {
    const startedAt = performance.now();
    const elapsed = (): number => Math.round(performance.now() - startedAt);

    if (signal?.aborted) throw abortReason(signal);
    const prepared = prepareRun(req, this.transpiler);
    if (!prepared.ok) return errorResult(prepared.error, elapsed());

    let runtime: string | undefined;
    if (prepared.run.runtime) {
      try {
        runtime = await (this.options.loadRuntime ?? readCommittedRuntime)(prepared.run.runtime);
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : String(caught);
        return errorResult(
          { name: 'RunnerError', message: `No React runtime: ${message}` },
          elapsed(),
        );
      }
    }
    if (signal?.aborted) throw abortReason(signal);

    return new Promise<RunResult>((resolve, reject) => {
      const logs = new LogBuffer();
      const worker = new Worker(NODE_WORKER_SOURCE, {
        eval: true,
        workerData: {
          harness: HARNESS_V1,
          code: prepared.run.code,
          tests: prepared.run.tests,
          ...(runtime === undefined ? {} : { runtime }),
        },
        resourceLimits: RESOURCE_LIMITS,
        // Lesson code has no business reading CI secrets or the parent's loader flags.
        env: {},
        execArgv: [],
        // Piped and never read: nothing a lesson prints can reach the CI log directly.
        stdout: true,
        stderr: true,
      });

      let settled = false;
      const finish = (settle: () => void): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal?.removeEventListener?.('abort', onAbort);
        worker.removeAllListeners();
        // terminate() resolves once the thread is gone; a failure here has no remedy.
        void worker.terminate().catch(() => undefined);
        settle();
      };

      const timer = setTimeout(() => {
        finish(() => resolve(timeoutResult(req.timeoutMs, elapsed(), logs.lines())));
      }, req.timeoutMs);

      const onAbort = (): void => finish(() => reject(abortReason(signal)));
      signal?.addEventListener?.('abort', onAbort, { once: true });

      worker.on('message', (message: unknown) => {
        if (!isRecord(message)) return;
        if (message.type === 'log' && typeof message.line === 'string') {
          logs.push(message.line);
          return;
        }
        if (message.type === 'done') {
          const report = parseHarnessReport(message.report);
          finish(() =>
            resolve(
              report
                ? reportToResult(report, elapsed())
                : errorResult(
                    { name: 'ProtocolError', message: 'The harness returned a malformed report.' },
                    elapsed(),
                    logs.lines(),
                  ),
            ),
          );
          return;
        }
        if (message.type === 'crash') {
          const text = typeof message.message === 'string' ? message.message : 'Unknown failure';
          finish(() =>
            resolve(errorResult({ name: 'RunnerError', message: text }, elapsed(), logs.lines())),
          );
        }
      });

      // Out of memory and uncaught errors outside a test (a throwing timer callback).
      worker.on('error', (error: Error) => {
        finish(() =>
          resolve(
            errorResult({ name: error.name, message: error.message }, elapsed(), logs.lines()),
          ),
        );
      });

      worker.on('exit', () => {
        finish(() =>
          resolve(
            errorResult(
              { name: 'RunnerError', message: 'The run ended without a result.' },
              elapsed(),
              logs.lines(),
            ),
          ),
        );
      });
    });
  }
}

function abortReason(signal: RunSignal | undefined): unknown {
  return signal?.reason ?? new DOMException('The run was aborted.', 'AbortError');
}
