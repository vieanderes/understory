import { describe, expect, it } from 'vitest';
import { LIMITS } from '@/core/running/limits';
import {
  parseFrameMessage,
  parseHarnessReport,
  parseParentMessage,
  parsePythonWorkerMessage,
  parseWorkerMessage,
} from '@/core/running/protocol';

const run = {
  v: 1,
  type: 'run',
  engine: 'js',
  runId: 'r1',
  code: 'const a = 1;',
  tests: "test('t', () => {});",
  timeoutMs: 2000,
  harnessVersion: 1,
};

const done = {
  v: 1,
  type: 'done',
  runId: 'r1',
  status: 'failed',
  tests: [
    { name: 'a', passed: true },
    { name: 'b', passed: false, message: 'Expected 1, received 2' },
  ],
  logs: ['hello'],
};

describe('parent to frame', () => {
  it('carries the React runtime with a tsx run, within its own size bound', () => {
    const withRuntime = { ...run, runtime: { name: 'react', source: 'var React = {};' } };
    expect(parseParentMessage(withRuntime)).toEqual(withRuntime);
    expect(parseParentMessage({ ...run, runtime: { name: 'vue', source: '' } })).toBeNull();
    const huge = 'x'.repeat(LIMITS.maxRuntimeBytes + 1);
    expect(parseParentMessage({ ...run, runtime: { name: 'react', source: huge } })).toBeNull();
  });

  it('accepts init and run', () => {
    expect(parseParentMessage({ v: 1, type: 'init', runId: 'init-1' })).toEqual({
      v: 1,
      type: 'init',
      runId: 'init-1',
    });
    expect(parseParentMessage(run)).toEqual(run);
  });

  it.each([
    ['another version', { ...run, v: 2 }],
    ['no version', { type: 'init', runId: 'x' }],
    ['no runId', { v: 1, type: 'init' }],
    ['an empty runId', { v: 1, type: 'init', runId: '' }],
    ['an oversized runId', { v: 1, type: 'init', runId: 'x'.repeat(LIMITS.maxRunIdLength + 1) }],
    ['an unknown type', { v: 1, type: 'eval', runId: 'x' }],
    ['an unknown key', { ...run, origin: 'https://evil.example' }],
    ['a frame message', done],
    ['code that is not a string', { ...run, code: 1 }],
    ['oversized code', { ...run, code: 'x'.repeat(LIMITS.maxSourceBytes + 1) }],
    ['a timeout below the floor', { ...run, timeoutMs: 1 }],
    ['a timeout above the ceiling', { ...run, timeoutMs: LIMITS.maxTimeoutMs + 1 }],
    ['a fractional timeout', { ...run, timeoutMs: 1000.5 }],
    ['another harness version', { ...run, harnessVersion: 2 }],
    ['null', null],
    ['a string', 'run'],
  ])('rejects %s', (_, message) => {
    expect(parseParentMessage(message)).toBeNull();
  });
});

describe('frame to parent', () => {
  it('accepts ready, log and done', () => {
    const ready = { v: 1, type: 'ready', runId: 'init-1', harnessVersion: 1 };
    const log = { v: 1, type: 'log', runId: 'r1', line: 'hello' };
    expect(parseFrameMessage(ready)).toEqual(ready);
    expect(parseFrameMessage(log)).toEqual(log);
    expect(parseFrameMessage(done)).toEqual(done);
    const failed = {
      ...done,
      status: 'error',
      tests: [],
      error: { name: 'E', message: 'm', line: 3 },
    };
    expect(parseFrameMessage(failed)).toEqual(failed);
    expect(parseFrameMessage({ ...done, status: 'timeout', tests: [] })).not.toBeNull();
  });

  it.each([
    ['a parent message', run],
    ['an unknown status', { ...done, status: 'cheated' }],
    ['a test without a verdict', { ...done, tests: [{ name: 'a' }] }],
    ['a test with extra keys', { ...done, tests: [{ name: 'a', passed: true, html: '<b>' }] }],
    [
      'too many tests',
      {
        ...done,
        tests: Array.from({ length: LIMITS.maxTests + 1 }, () => ({ name: 'a', passed: true })),
      },
    ],
    [
      'too many log lines',
      { ...done, logs: Array.from({ length: LIMITS.maxLogLines + 2 }, () => 'x') },
    ],
    [
      'an oversized log line',
      { v: 1, type: 'log', runId: 'r1', line: 'x'.repeat(LIMITS.maxLogLineLength + 1) },
    ],
    [
      'an oversized message',
      {
        ...done,
        tests: [{ name: 'a', passed: false, message: 'x'.repeat(LIMITS.maxMessageLength + 1) }],
      },
    ],
    [
      'a line that is not a positive integer',
      { ...done, error: { name: 'E', message: 'm', line: 0 } },
    ],
    ['undefined', undefined],
  ])('rejects %s', (_, message) => {
    expect(parseFrameMessage(message)).toBeNull();
  });
});

describe('worker to frame', () => {
  const report = { status: 'passed', tests: [{ name: 'a', passed: true }], logs: [] };

  it('accepts started, log and done with a nonce', () => {
    expect(parseWorkerMessage({ nonce: 'n', type: 'started' })).not.toBeNull();
    expect(parseWorkerMessage({ nonce: 'n', type: 'log', line: 'x' })).not.toBeNull();
    expect(parseWorkerMessage({ nonce: 'n', type: 'done', report })).toEqual({
      nonce: 'n',
      type: 'done',
      report,
    });
  });

  it('rejects a message without a nonce, and a report that claims a timeout', () => {
    expect(parseWorkerMessage({ type: 'done', report })).toBeNull();
    expect(
      parseWorkerMessage({ nonce: 'n', type: 'done', report: { ...report, status: 'timeout' } }),
    ).toBeNull();
    expect(parseWorkerMessage({ nonce: '', type: 'started' })).toBeNull();
  });
});

describe('Python messages', () => {
  const bytes = (n: number): ArrayBuffer => new ArrayBuffer(n);
  const assets = {
    v: 1,
    type: 'python-assets',
    runId: 'r1',
    version: '0.29.5',
    loader: bytes(4),
    runtime: bytes(4),
    wasm: bytes(4),
    stdlib: bytes(4),
    lock: bytes(4),
  };

  it('accepts a Python run and the Pyodide files as bytes', () => {
    expect(parseParentMessage({ ...run, engine: 'python' })?.type).toBe('run');
    expect(parseParentMessage(assets)?.type).toBe('python-assets');
  });

  it('rejects a run without an engine, files as text, and a file past the cap', () => {
    expect(parseParentMessage({ ...run, engine: undefined })).toBeNull();
    expect(parseParentMessage({ ...assets, wasm: 'AGFzbQ==' })).toBeNull();
    expect(
      parseParentMessage({ ...assets, wasm: bytes(LIMITS.maxPythonAssetBytes + 1) }),
    ).toBeNull();
    expect(parseParentMessage({ ...assets, version: 'latest' })).toBeNull();
  });

  it('carries the packages a Python run needs, and only those the runners ship', () => {
    const python = { ...run, engine: 'python' };
    expect(parseParentMessage({ ...python, packages: ['numpy', 'pandas'] })?.type).toBe('run');
    expect(parseParentMessage({ ...python, packages: ['scipy'] })).toBeNull();
    expect(parseParentMessage({ ...python, packages: 'numpy' })).toBeNull();
  });

  it('accepts package wheels as bytes, named as wheels, a bounded number of them', () => {
    const wheels = {
      v: 1,
      type: 'python-packages',
      runId: 'r1',
      files: { 'numpy-2.2.5-cp313-cp313-pyemscripten_2025_0_wasm32.whl': bytes(4) },
    };
    expect(parseParentMessage(wheels)?.type).toBe('python-packages');
    expect(
      parseParentMessage({ ...wheels, files: { '../pyodide.asm.wasm': bytes(4) } }),
    ).toBeNull();
    expect(parseParentMessage({ ...wheels, files: { 'six.whl': 'text' } })).toBeNull();
    const many = Object.fromEntries(
      Array.from({ length: LIMITS.maxPythonPackageFiles + 1 }, (_, i) => [`p${i}.whl`, bytes(1)]),
    );
    expect(parseParentMessage({ ...wheels, files: many })).toBeNull();
  });

  it('lets the frame tell the parent that the budget starts now', () => {
    expect(parseFrameMessage({ v: 1, type: 'started', runId: 'r1' })?.type).toBe('started');
  });

  it('accepts what the Python worker sends, each with its nonce and run', () => {
    const report = { status: 'passed', tests: [{ name: 't', passed: true }], logs: [] };
    expect(parsePythonWorkerMessage({ nonce: 'n', type: 'ready' })?.type).toBe('ready');
    expect(parsePythonWorkerMessage({ nonce: 'n', type: 'boot-error', message: 'x' })?.type).toBe(
      'boot-error',
    );
    expect(
      parsePythonWorkerMessage({ nonce: 'n', type: 'log', runId: 'r1', line: 'hi' })?.type,
    ).toBe('log');
    expect(
      parsePythonWorkerMessage({ nonce: 'n', type: 'done', runId: 'r1', report, fatal: false })
        ?.type,
    ).toBe('done');
    expect(parsePythonWorkerMessage({ nonce: 'n', type: 'started', runId: 'r1' })?.type).toBe(
      'started',
    );
    expect(parsePythonWorkerMessage({ type: 'ready' })).toBeNull();
    expect(parsePythonWorkerMessage({ nonce: 'n', type: 'done', runId: 'r1', report })).toBeNull();
  });
});

describe('harness report', () => {
  it('parses a report and rejects anything else', () => {
    expect(parseHarnessReport({ status: 'passed', tests: [], logs: [] })).not.toBeNull();
    expect(parseHarnessReport({ status: 'passed', tests: [] })).toBeNull();
    expect(parseHarnessReport('passed')).toBeNull();
  });
});
