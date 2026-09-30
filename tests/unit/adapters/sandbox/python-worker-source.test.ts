import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { buildPythonWorkerSource } from '@/adapters/sandbox/frame/python-worker-source';
import { parsePythonWorkerMessage, type PythonWorkerMessage } from '@/core/running/protocol';

/**
 * The bootstrap of the Python worker, against a fake Pyodide in a `vm` context. The real
 * Pyodide in real browsers is covered by tests/e2e/sandbox.spec.ts; this pins the parts
 * that are easy to get wrong unseen: what the fetch stand-in serves and refuses, that
 * the network is blocked before any run, and that every message carries the nonce.
 */

const FAKE_LOADER = String.raw`
globalThis.loadPyodide = async function (options) {
  var lock = await (await fetch(options.indexURL + 'pyodide-lock.json')).text();
  var wasm = await fetch(new URL('pyodide.asm.wasm', options.indexURL));
  var refused = await fetch('https://elsewhere.example/data.json').then(function () { return false; }, function () { return true; });
  globalThis.__boot = { lock: lock, wasmType: wasm.headers.get('content-type'), refused: refused, runtime: typeof _createPyodideModule };
  globalThis.__imported = [];
  globalThis.__entry = null;
  return {
    globals: { get: function () { return function () { return { get: function (name) { globalThis.__entry = name; return function (code, tests, log) {
      log('printed ' + code);
      if (code === 'break the interpreter') throw new Error('wasm stack overflow');
      if (code === 'reject') return Promise.reject(new Error('webloop broke'));
      return Promise.resolve(JSON.stringify({ status: 'passed', tests: [{ name: 'a', passed: true }], logs: ['printed ' + code] }));
    }; } }; }; } },
    // As Pyodide's does: fetch each wheel by name from the index URL, then install it.
    loadPackage: async function (names) {
      for (var i = 0; i < names.length; i++) {
        await (await fetch(options.indexURL + names[i] + '.whl')).arrayBuffer();
      }
    },
    runPython: function (code) { if (code.indexOf('import ') === 0) globalThis.__imported.push(code); }
  };
};`;

const encode = (text: string): ArrayBuffer => new TextEncoder().encode(text).buffer as ArrayBuffer;

function startWorker(nonce = 'n0nce') {
  const messages: PythonWorkerMessage[] = [];
  const raw: unknown[] = [];
  let listener: ((event: { data: unknown }) => void) | null = null;
  const context = vm.createContext({
    __receive: (data: unknown) => {
      raw.push(data);
      const parsed = parsePythonWorkerMessage(JSON.parse(JSON.stringify(data)));
      if (parsed) messages.push(parsed);
    },
    __listen: (fn: (event: { data: unknown }) => void) => {
      listener = fn;
    },
    Response,
    TextDecoder,
    URL,
  });
  vm.runInContext(
    `var self = globalThis;
     Object.setPrototypeOf(globalThis, {
       fetch() { return Promise.resolve('real fetch'); },
       importScripts() { return 'real importScripts'; },
       postMessage: (function (receive) { return function (data) { receive(data); }; })(__receive),
       addEventListener: (function (listen) { return function (type, fn) { if (type === 'message') listen(fn); }; })(__listen),
     });
     delete globalThis.__receive;
     delete globalThis.__listen;
     globalThis.XMLHttpRequest = function XMLHttpRequest() {};
     globalThis.navigator = { sendBeacon() { return true; } };`,
    context,
  );
  vm.runInContext(buildPythonWorkerSource({ harness: 'print("harness")', nonce }), context);
  const post = (data: unknown): void => listener?.({ data });
  return { context, messages, raw, post };
}

const files = {
  loader: encode(FAKE_LOADER),
  runtime: encode('globalThis._createPyodideModule = function () {};'),
  wasm: encode('\0asm'),
  stdlib: encode('zip'),
  lock: encode('{"info":{}}'),
};

async function settle(): Promise<void> {
  for (let i = 0; i < 20; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('the Python worker bootstrap', () => {
  it('serves the three files from memory, refuses everything else, and says ready', async () => {
    const worker = startWorker();
    worker.post({ type: 'boot', files });
    await settle();
    expect(vm.runInContext('globalThis.__boot', worker.context)).toEqual({
      lock: '{"info":{}}',
      wasmType: 'application/wasm',
      refused: true,
      runtime: 'function',
    });
    expect(worker.messages).toEqual([{ type: 'ready', nonce: 'n0nce' }]);
  });

  it('blocks the network before the first run', async () => {
    const worker = startWorker();
    worker.post({ type: 'boot', files });
    await settle();
    const probe = (expression: string): string =>
      vm.runInContext(
        `(function () { try { ${expression}; return 'reachable'; } catch (e) { return e.message; } })()`,
        worker.context,
      ) as string;
    expect(probe('fetch("/x")')).toBe('fetch is not available in the sandbox');
    expect(probe('fetch("https://elsewhere.example/numpy.whl")')).toBe(
      'fetch is not available in the sandbox',
    );
    expect(probe('importScripts("/x")')).toBe('importScripts is not available in the sandbox');
    expect(probe('new XMLHttpRequest()')).toBe('XMLHttpRequest is not available in the sandbox');
    expect(
      vm.runInContext('Object.getPrototypeOf(globalThis).fetch === fetch', worker.context),
    ).toBe(true);
    expect(probe('postMessage({ type: "done" })')).toBe('reachable');
    expect(worker.raw).toHaveLength(1);
  });

  it('answers a run with its logs and report, tagged with the run id and the nonce', async () => {
    const worker = startWorker();
    worker.post({ type: 'boot', files });
    await settle();
    worker.post({ type: 'run', runId: 'r1', code: 'x = 1', tests: '' });
    await settle();
    expect(vm.runInContext('globalThis.__entry', worker.context)).toBe('run_async');
    expect(worker.messages.slice(1)).toEqual([
      { type: 'started', runId: 'r1', nonce: 'n0nce' },
      { type: 'log', runId: 'r1', line: 'printed x = 1', nonce: 'n0nce' },
      {
        type: 'done',
        runId: 'r1',
        nonce: 'n0nce',
        fatal: false,
        report: { status: 'passed', tests: [{ name: 'a', passed: true }], logs: ['printed x = 1'] },
      },
    ]);
  });

  it('marks a run fatal when the interpreter itself throws', async () => {
    const worker = startWorker();
    worker.post({ type: 'boot', files });
    await settle();
    worker.post({ type: 'run', runId: 'r2', code: 'break the interpreter', tests: '' });
    await settle();
    const done = worker.messages.at(-1);
    expect(done).toMatchObject({ type: 'done', fatal: true, runId: 'r2' });
    expect(done?.type === 'done' ? done.report.error : undefined).toEqual({
      name: 'PythonError',
      message: 'wasm stack overflow',
    });
  });

  it('marks a run fatal when the event loop rejects', async () => {
    const worker = startWorker();
    worker.post({ type: 'boot', files });
    await settle();
    worker.post({ type: 'run', runId: 'r3', code: 'reject', tests: '' });
    await settle();
    expect(worker.messages.at(-1)).toMatchObject({ type: 'done', fatal: true, runId: 'r3' });
  });

  it("loads and imports a run's packages from the wheels it was handed, then says started", async () => {
    const worker = startWorker();
    worker.post({ type: 'boot', files });
    await settle();
    worker.post({ type: 'packages', files: { 'numpy.whl': encode('wheel') } });
    worker.post({ type: 'run', runId: 'r4', code: 'x', tests: '', packages: ['numpy'] });
    await settle();
    expect(worker.messages.slice(1).map((m) => m.type)).toEqual(['started', 'log', 'done']);
    worker.post({ type: 'run', runId: 'r5', code: 'x', tests: '', packages: ['numpy'] });
    await settle();
    expect(vm.runInContext('globalThis.__imported', worker.context)).toEqual(['import numpy']);
  });

  it('fails a run whose wheel it never received, and keeps the interpreter', async () => {
    const worker = startWorker();
    worker.post({ type: 'boot', files });
    await settle();
    worker.post({ type: 'run', runId: 'r6', code: 'x', tests: '', packages: ['pandas'] });
    await settle();
    const done = worker.messages.at(-1);
    expect(done).toMatchObject({ type: 'done', fatal: false, runId: 'r6' });
    expect(done?.type === 'done' ? done.report.error?.name : undefined).toBe('SandboxError');
    expect(worker.messages.some((m) => m.type === 'started')).toBe(false);
  });

  it('reports a start that fails, and ignores a run before it is ready', async () => {
    const worker = startWorker();
    worker.post({ type: 'run', runId: 'early', code: '', tests: '' });
    worker.post({
      type: 'boot',
      files: { ...files, loader: encode('throw new Error("bad loader")') },
    });
    await settle();
    expect(worker.messages).toEqual([
      { type: 'boot-error', message: 'bad loader', nonce: 'n0nce' },
    ]);
  });
});
