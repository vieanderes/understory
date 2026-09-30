/**
 * The frame's side of Python: one warm Pyodide worker, and the runs it serves.
 *
 * The JavaScript path starts a worker per run. Python cannot afford that (a start is a
 * second or more, a run a few milliseconds), so this keeps one interpreter warm and pays
 * the start again only when a run had to be killed: a timeout, a superseded run, or an
 * interpreter that broke. The replacement starts at once, so the next run finds it warm.
 *
 * A run's `timeoutMs` counts from the moment the interpreter says `started`: it is warm
 * and has loaded the run's packages. The frame tells the parent with `started`, so the
 * parent's watchdog can allow for the start and the packages.
 *
 * Package wheels arrive in `python-packages` messages and stay for the frame's life: a
 * replacement interpreter gets them all at its start, so it can load them again.
 */
import { LIMITS } from '@/core/running/limits';
import { capLogs, LogBuffer } from '@/core/running/log-buffer';
import { timeoutResult } from '@/core/running/prepare';
import {
  PROTOCOL_VERSION,
  parsePythonWorkerMessage,
  type DoneMessage,
  type FrameMessage,
  type PythonAssetsMessage,
  type PythonPackagesMessage,
  type PythonWorkerMessage,
  type RunMessage,
} from '@/core/running/protocol';
import { PYTHON_HARNESS_V1 } from '@/core/running/python-harness';
import { buildPythonWorkerSource } from './python-worker-source';

type Outcome = Pick<DoneMessage, 'status' | 'tests' | 'logs' | 'error'>;
type RunMessageFromWorker = Extract<PythonWorkerMessage, { type: 'started' | 'log' | 'done' }>;

interface Interpreter {
  worker: Worker;
  /** null while starting, then true, or the reason it could not start. */
  ready: true | string | null;
  waiting: ((failure: string | null) => void)[];
  onRun: ((message: RunMessageFromWorker) => void) | null;
  onCrash: ((message: string) => void) | null;
}

export interface ActiveRun {
  runId: string;
  stop(): void;
}

export interface PythonHost {
  setAssets(message: PythonAssetsMessage): void;
  addPackages(message: PythonPackagesMessage): void;
  start(message: RunMessage): ActiveRun;
}

export function createPythonHost(deps: {
  send(message: FrameMessage): void;
  randomNonce(): string;
}): PythonHost {
  let assets: PythonAssetsMessage | null = null;
  let current: Interpreter | null = null;
  const wheels: Record<string, ArrayBuffer> = {};

  function spawn(files: PythonAssetsMessage): Interpreter {
    const nonce = deps.randomNonce();
    const source = buildPythonWorkerSource({ harness: PYTHON_HARNESS_V1, nonce });
    const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
    const interpreter: Interpreter = {
      worker: new Worker(url),
      ready: null,
      waiting: [],
      onRun: null,
      onCrash: null,
    };
    const settle = (failure: string | null): void => {
      if (interpreter.ready !== null) return;
      interpreter.ready = failure ?? true;
      URL.revokeObjectURL(url);
      for (const wake of interpreter.waiting.splice(0)) wake(failure);
    };

    interpreter.worker.onmessage = (event: MessageEvent<unknown>) => {
      const message = parsePythonWorkerMessage(event.data);
      if (!message || message.nonce !== nonce) return;
      if (message.type === 'ready') settle(null);
      else if (message.type === 'boot-error') settle(`Python could not start: ${message.message}`);
      else interpreter.onRun?.(message);
    };
    interpreter.worker.onerror = (event: ErrorEvent) => {
      event.preventDefault();
      const text = event.message || 'The Python worker failed.';
      if (interpreter.ready === null) settle(`Python could not start: ${text}`);
      else interpreter.onCrash?.(text);
    };
    // A copy for the worker: the frame keeps its own to start the next interpreter.
    interpreter.worker.postMessage({
      type: 'boot',
      files: {
        loader: files.loader,
        runtime: files.runtime,
        wasm: files.wasm,
        stdlib: files.stdlib,
        lock: files.lock,
      },
    });
    if (Object.keys(wheels).length > 0) {
      interpreter.worker.postMessage({ type: 'packages', files: { ...wheels } });
    }
    return interpreter;
  }

  function replace(): void {
    if (current) {
      current.onRun = null;
      current.onCrash = null;
      current.worker.onmessage = null;
      current.worker.onerror = null;
      current.worker.terminate();
    }
    current = assets ? spawn(assets) : null;
  }

  function start(message: RunMessage): ActiveRun {
    const { runId, timeoutMs } = message;
    const logs = new LogBuffer();
    let stopped = false;
    let handedOver = false;
    const timers: { boot?: number; run?: number } = {};
    const interpreter = current;

    const detach = (): void => {
      stopped = true;
      window.clearTimeout(timers.boot);
      window.clearTimeout(timers.run);
      if (interpreter) {
        interpreter.onRun = null;
        interpreter.onCrash = null;
      }
    };
    const finish = (outcome: Outcome, discard: boolean): void => {
      if (stopped) return;
      detach();
      if (discard) replace();
      deps.send({ v: PROTOCOL_VERSION, type: 'done', runId, ...outcome });
    };
    const fail = (name: string, text: string, discard: boolean): void => {
      finish(
        {
          status: 'error',
          tests: [],
          logs: logs.lines(),
          error: { name, message: text.slice(0, LIMITS.maxMessageLength) },
        },
        discard,
      );
    };

    const run: ActiveRun = {
      runId,
      stop() {
        if (stopped) return;
        detach();
        // An interpreter that is still starting can serve the next run. One that is
        // busy with this run cannot be interrupted, only replaced.
        if (handedOver) replace();
      },
    };

    if (!interpreter) {
      window.setTimeout(() => {
        fail('SandboxError', 'Python is not loaded in the sandbox.', false);
      }, 0);
      return run;
    }

    timers.boot = window.setTimeout(() => {
      fail('SandboxError', 'Python did not load in time. Try again.', true);
    }, LIMITS.pythonBootTimeoutMs);

    const begin = (failure: string | null): void => {
      if (stopped) return;
      if (failure !== null) {
        window.clearTimeout(timers.boot);
        fail('SandboxError', failure, true);
        return;
      }
      // The start allowance runs on while the worker loads the run's packages.
      interpreter.onRun = (fromWorker) => {
        if (fromWorker.runId !== runId) return;
        if (fromWorker.type === 'started') {
          window.clearTimeout(timers.boot);
          deps.send({ v: PROTOCOL_VERSION, type: 'started', runId });
          timers.run = window.setTimeout(() => {
            const { status, tests, error } = timeoutResult(timeoutMs, 0, []);
            finish({ status, tests, logs: logs.lines(), error }, true);
          }, timeoutMs);
          return;
        }
        if (fromWorker.type === 'log') {
          if (logs.push(fromWorker.line)) {
            deps.send({ v: PROTOCOL_VERSION, type: 'log', runId, line: fromWorker.line });
          }
          return;
        }
        const { status, tests, error } = fromWorker.report;
        finish({ status, tests, logs: capLogs(fromWorker.report.logs), error }, fromWorker.fatal);
      };
      interpreter.onCrash = (text) => fail('Error', text, true);
      handedOver = true;
      interpreter.worker.postMessage({
        type: 'run',
        runId,
        code: message.code,
        tests: message.tests,
        packages: message.packages ?? [],
      });
    };

    if (interpreter.ready === null) interpreter.waiting.push(begin);
    else begin(interpreter.ready === true ? null : interpreter.ready);
    return run;
  }

  return {
    setAssets(message) {
      if (assets !== null) return;
      assets = message;
      // Started now, not on the first run, so the start overlaps with whatever the
      // parent does next.
      replace();
    },
    addPackages(message) {
      const fresh: Record<string, ArrayBuffer> = {};
      for (const [name, bytes] of Object.entries(message.files)) {
        if (name in wheels) continue;
        wheels[name] = bytes;
        fresh[name] = bytes;
      }
      if (current && Object.keys(fresh).length > 0) {
        current.worker.postMessage({ type: 'packages', files: fresh });
      }
    },
    start,
  };
}
