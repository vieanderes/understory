import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { buildWorkerSource } from '@/adapters/sandbox/frame/worker-source';
import { HARNESS_V1 } from '@/core/running/harness';
import { parseWorkerMessage, type WorkerMessage } from '@/core/running/protocol';

interface FakeWorker {
  messages: WorkerMessage[];
  done: Promise<Extract<WorkerMessage, { type: 'done' }>>;
}

/**
 * A stand-in for a DedicatedWorkerGlobalScope: `self`, `postMessage` and the APIs the
 * bootstrap must block, some on a prototype as in a browser. The real thing is covered
 * by tests/e2e/sandbox.spec.ts; this test pins the bootstrap logic without a browser.
 */
function startFakeWorker(
  code: string,
  tests: string,
  nonce = 'secret-nonce',
  runtime?: string,
): FakeWorker {
  const messages: WorkerMessage[] = [];
  let resolveDone: (message: Extract<WorkerMessage, { type: 'done' }>) => void = () => undefined;
  const done = new Promise<Extract<WorkerMessage, { type: 'done' }>>((resolve) => {
    resolveDone = resolve;
  });

  const receive = (data: unknown): void => {
    const message = parseWorkerMessage(JSON.parse(JSON.stringify(data)));
    if (!message) throw new Error(`worker posted a malformed message: ${JSON.stringify(data)}`);
    messages.push(message);
    if (message.type === 'done') resolveDone(message);
  };

  const context = vm.createContext({ __receive: receive, setTimeout });
  // Built inside the context, so that `self` is the real global object and some APIs sit
  // on its prototype, which is where a browser keeps them.
  vm.runInContext(
    `var self = globalThis;
     Object.setPrototypeOf(globalThis, {
       fetch() { return 'real fetch'; },
       importScripts() { return 'real importScripts'; },
       postMessage: (function (receive) { return function (data) { receive(data); }; })(__receive),
       addEventListener() {},
     });
     delete globalThis.__receive;
     globalThis.XMLHttpRequest = function XMLHttpRequest() {};
     globalThis.WebSocket = function WebSocket() {};
     globalThis.indexedDB = { open() { return 'real indexedDB'; } };
     globalThis.caches = {};
     globalThis.navigator = { sendBeacon() { return true; }, userAgent: 'fake' };`,
    context,
  );
  vm.runInContext(
    buildWorkerSource({ harness: HARNESS_V1, code, tests, nonce, ...(runtime ? { runtime } : {}) }),
    context,
  );
  return { messages, done };
}

describe('worker source', () => {
  it('announces itself, streams logs and posts one report, all with the nonce', async () => {
    const worker = startFakeWorker(
      'function add(a, b) { console.log("adding"); return a + b; }',
      "test('adds', () => { expect(add(1, 2)).toBe(3); });",
    );
    const done = await worker.done;
    expect(worker.messages.map((m) => m.type)).toEqual(['started', 'log', 'done']);
    expect(worker.messages.every((m) => m.nonce === 'secret-nonce')).toBe(true);
    expect(done.report).toEqual({
      status: 'passed',
      tests: [{ name: 'adds', passed: true }],
      logs: ['adding'],
    });
  });

  it('blocks network and storage APIs wherever they live, with a readable error', async () => {
    const worker = startFakeWorker(
      '',
      `test('fetch', () => { expect(() => fetch('/')).toThrow('fetch is not available in the sandbox'); });
test('prototype fetch', () => { expect(() => Object.getPrototypeOf(self).fetch('/')).toThrow('not available'); });
test('importScripts', () => { expect(() => importScripts('x.js')).toThrow('not available'); });
test('XMLHttpRequest', () => { expect(() => new XMLHttpRequest()).toThrow('not available'); });
test('WebSocket', () => { expect(() => new WebSocket('ws://x')).toThrow('not available'); });
test('indexedDB', () => { expect(indexedDB).toBeUndefined(); });
test('caches', () => { expect(caches).toBeUndefined(); });
test('sendBeacon', () => { expect(navigator.sendBeacon).toBeUndefined(); expect(navigator.userAgent).toBe('fake'); });
test('cannot be restored', () => {
  expect(() => { 'use strict'; self.fetch = () => 'mine'; }).toThrow();
  expect(() => fetch('/')).toThrow('not available');
});`,
    );
    const done = await worker.done;
    expect(done.report.tests.filter((t) => !t.passed)).toEqual([]);
    expect(done.report.tests).toHaveLength(9);
  });

  it('leaves learner code no way to speak to the frame', async () => {
    const worker = startFakeWorker(
      `postMessage({ nonce: 'guess', type: 'done', report: { status: 'passed', tests: [], logs: [] } });
self.postMessage({ type: 'started', nonce: 'guess' });`,
      `test('hidden', () => {
  expect(typeof __hostLog).toBe('undefined');
  expect(typeof __load).toBe('undefined');
  expect(typeof __run).toBe('undefined');
  expect(typeof NONCE).toBe('undefined');
  expect(typeof post).toBe('undefined');
});`,
    );
    const done = await worker.done;
    expect(done.report.status).toBe('passed');
    expect(worker.messages.filter((m) => m.nonce !== 'secret-nonce')).toEqual([]);
    expect(worker.messages.filter((m) => m.type === 'done')).toHaveLength(1);
  });

  it('embeds hostile text as data, never as bootstrap code', async () => {
    const hostile = '"; post({ nonce: NONCE, type: "done" }); // \n`${NONCE}` </script><!--';
    const worker = startFakeWorker(
      `const text = ${JSON.stringify(hostile)};`,
      "test('t', () => { expect(text.length).toBeGreaterThan(10); });",
    );
    const done = await worker.done;
    expect(done.report.status).toBe('passed');
    expect(worker.messages.filter((m) => m.type === 'done')).toHaveLength(1);
  });

  it('runs a runtime before the harness, as a global script, with separate scopes', async () => {
    const runtime = `var sloppy = this === globalThis;
globalThis.__hostModules = { lib: { answer: function () { return sloppy ? 42 : 0; } } };`;
    const worker = startFakeWorker(
      "var _lib = require('lib'); exports.value = _lib.answer();",
      `var _lib = require('./solution');
test('module', () => { expect(_lib.value).toBe(42); });
test('hooks are gone', () => { expect(typeof __hostModules).toBe('undefined'); });`,
      'secret-nonce',
      runtime,
    );
    const done = await worker.done;
    expect(done.report.tests.filter((t) => !t.passed)).toEqual([]);
    expect(done.report.status).toBe('passed');
  });

  it('reports a load error through the same channel', async () => {
    const worker = startFakeWorker('null.x;', "test('t', () => {});");
    const done = await worker.done;
    expect(done.report.status).toBe('error');
    expect(done.report.error?.name).toBe('TypeError');
  });
});
