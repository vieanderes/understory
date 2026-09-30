/**
 * The script of /sandbox/runner.v1.html. scripts/build-sandbox.ts bundles this file and
 * inlines it, so the runner is one static document with one inline script.
 *
 * The page is served with `Content-Security-Policy: sandbox allow-scripts; default-src
 * 'none'; ...`, so it has an opaque origin: no cookies, no storage, no same-origin
 * access to the app, no network. It is a broker. Learner code never runs on this
 * thread; it runs in a Web Worker that this script can kill: a fresh one per JavaScript
 * run, and one warm Pyodide worker for Python (python-host.ts).
 */
import { HARNESS_V1 } from '@/core/running/harness';
import { LIMITS } from '@/core/running/limits';
import { capLogs, LogBuffer } from '@/core/running/log-buffer';
import { timeoutResult } from '@/core/running/prepare';
import {
  PROTOCOL_VERSION,
  parseParentMessage,
  parseWorkerMessage,
  type DoneMessage,
  type FrameMessage,
  type RunMessage,
} from '@/core/running/protocol';
import { createPythonHost, type ActiveRun } from './python-host';
import { buildWorkerSource } from './worker-source';

let port: MessagePort | null = null;
let active: ActiveRun | null = null;

function send(message: FrameMessage): void {
  port?.postMessage(message);
}

function randomNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

const python = createPythonHost({ send, randomNonce });

type Outcome = Pick<DoneMessage, 'status' | 'tests' | 'logs' | 'error'>;

function startRun(message: RunMessage): void {
  // One run at a time. The parent has already given up on the previous one.
  active?.stop();
  if (message.engine === 'python') {
    active = python.start(message);
    return;
  }

  const { runId, timeoutMs } = message;
  const nonce = randomNonce();
  const logs = new LogBuffer();
  const source = buildWorkerSource({
    harness: HARNESS_V1,
    code: message.code,
    tests: message.tests,
    nonce,
    ...(message.runtime ? { runtime: message.runtime.source } : {}),
  });
  let url: string | null = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  const revoke = (): void => {
    if (url !== null) URL.revokeObjectURL(url);
    url = null;
  };

  let worker: Worker | null = null;
  let stopped = false;

  // Started before the worker exists, so that a slow worker start-up counts against the
  // budget too. The callback runs later, when `finish` below is defined.
  const timer = window.setTimeout(() => {
    const { status, tests, error } = timeoutResult(timeoutMs, 0, []);
    finish({ status, tests, logs: logs.lines(), error });
  }, timeoutMs);

  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    window.clearTimeout(timer);
    if (worker) {
      worker.onmessage = null;
      worker.onerror = null;
      // The first termination layer. Stops a synchronous infinite loop mid-instruction.
      worker.terminate();
    }
    revoke();
    if (active?.runId === runId) active = null;
  };

  const finish = (outcome: Outcome): void => {
    if (stopped) return;
    stop();
    send({ v: PROTOCOL_VERSION, type: 'done', runId, ...outcome });
  };

  const fail = (name: string, text: string): void => {
    finish({
      status: 'error',
      tests: [],
      logs: logs.lines(),
      error: { name, message: text.slice(0, LIMITS.maxMessageLength) },
    });
  };

  active = { runId, stop };

  try {
    worker = new Worker(url);
  } catch (caught) {
    fail('SandboxError', `The worker could not start: ${String(caught)}`);
    return;
  }

  worker.onmessage = (event: MessageEvent<unknown>) => {
    // The worker is the least trusted party: parse, then check the per-run secret.
    const fromWorker = parseWorkerMessage(event.data);
    if (!fromWorker || fromWorker.nonce !== nonce) return;
    switch (fromWorker.type) {
      case 'started':
        revoke();
        return;
      case 'log':
        if (logs.push(fromWorker.line)) {
          send({ v: PROTOCOL_VERSION, type: 'log', runId, line: fromWorker.line });
        }
        return;
      case 'done': {
        const { status, tests, error } = fromWorker.report;
        finish({ status, tests, logs: capLogs(fromWorker.report.logs), error });
        return;
      }
    }
  };

  // An uncaught error outside a test, such as a throwing timer callback, or a worker
  // that ran out of memory. Browsers mute the details for some of these.
  worker.onerror = (event: ErrorEvent) => {
    event.preventDefault();
    fail('Error', event.message || 'The code failed outside a test.');
  };
}

function onPortMessage(event: MessageEvent<unknown>): void {
  const message = parseParentMessage(event.data);
  if (message?.type === 'run') startRun(message);
  else if (message?.type === 'python-assets') python.setAssets(message);
  else if (message?.type === 'python-packages') python.addPackages(message);
}

function onWindowMessage(event: MessageEvent<unknown>): void {
  // Only the embedding page may hand over a port, and only once. Opened as a top-level
  // document the runner has no parent and stays inert.
  if (port !== null || window.parent === window || event.source !== window.parent) return;
  // Served without its sandbox header, the runner would share the app's origin. It then
  // refuses to broker anything, whatever the parent does.
  if (window.origin !== 'null') return;
  const message = parseParentMessage(event.data);
  const received = event.ports[0];
  if (message?.type !== 'init' || !received) return;

  window.removeEventListener('message', onWindowMessage);
  port = received;
  port.onmessage = onPortMessage;
  send({ v: PROTOCOL_VERSION, type: 'ready', runId: message.runId, harnessVersion: 1 });
}

window.addEventListener('message', onWindowMessage);
