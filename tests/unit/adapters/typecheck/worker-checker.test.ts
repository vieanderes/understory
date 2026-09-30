import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkerWorkerUrl, parseManifest } from '@/adapters/typecheck/assets';
import { createNodeProgramChecker } from '@/adapters/typecheck/node';
import { WorkerTypeChecker, type CheckerWorker } from '@/adapters/typecheck/worker-checker';
import { checkRequestSchema } from '@/core/typecheck/protocol';

type Listener = (event: { data?: unknown }) => void;

/** Answers like the real worker, with the real program, unless told otherwise. */
class FakeWorker implements CheckerWorker {
  listeners: Record<'message' | 'error', Listener[]> = { message: [], error: [] };
  terminated = false;
  posted: unknown[] = [];
  reply: 'real' | 'silent' | 'garbage' | 'failure' = 'real';
  private readonly check = createNodeProgramChecker();

  addEventListener(type: 'message' | 'error', listener: Listener): void {
    this.listeners[type].push(listener);
  }

  postMessage(message: unknown): void {
    this.posted.push(message);
    const { id, code, tests } = checkRequestSchema.parse(message);
    queueMicrotask(() => {
      if (this.reply === 'silent') return;
      const data =
        this.reply === 'garbage'
          ? { v: 1, id, diagnostics: 'nope' }
          : this.reply === 'failure'
            ? { v: 1, id, failure: 'boom' }
            : { v: 1, id, diagnostics: this.check({ code, tests }) };
      for (const listener of this.listeners.message) listener({ data });
    });
  }

  fail(): void {
    for (const listener of this.listeners.error) listener({});
  }

  terminate(): void {
    this.terminated = true;
  }
}

const TESTS = "import { f } from './solution';\ntest('f', () => expect(f()).toBe(1));\n";

afterEach(() => {
  vi.useRealTimers();
});

describe('WorkerTypeChecker', () => {
  it("normalises the worker's diagnostics for the learner's code", async () => {
    const worker = new FakeWorker();
    const checker = new WorkerTypeChecker({ createWorker: () => Promise.resolve(worker) });
    const outcome = await checker.check({
      code: 'export const f = (): number => "1";\n',
      tests: TESTS,
    });
    expect(outcome).toMatchObject({
      status: 'checked',
      diagnostics: [
        { line: 1, code: 2322, message: "Type 'string' is not assignable to type 'number'." },
      ],
    });
  });

  it('starts one worker and reuses it', async () => {
    const create = vi.fn(() => Promise.resolve(new FakeWorker()));
    const checker = new WorkerTypeChecker({ createWorker: create });
    await Promise.all([
      checker.check({ code: 'export const f = () => 1;\n', tests: TESTS }),
      checker.check({ code: 'export const f = () => 2;\n', tests: TESTS }),
    ]);
    await checker.check({ code: 'export const f = () => 3;\n', tests: TESTS });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('is unavailable when the worker cannot be created, and tries again next time', async () => {
    const create = vi
      .fn<() => Promise<CheckerWorker>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(new FakeWorker());
    const checker = new WorkerTypeChecker({ createWorker: create });
    expect(await checker.check({ code: '', tests: '' })).toEqual({
      status: 'unavailable',
      reason: 'The type checker did not load.',
    });
    expect(
      (await checker.check({ code: 'export const f = () => 1;\n', tests: TESTS })).status,
    ).toBe('checked');
  });

  it('is unavailable when the worker script fails to load', async () => {
    const worker = new FakeWorker();
    worker.reply = 'silent';
    const checker = new WorkerTypeChecker({ createWorker: () => Promise.resolve(worker) });
    const pending = checker.check({ code: '', tests: '' });
    await Promise.resolve();
    await Promise.resolve();
    worker.fail();
    expect((await pending).status).toBe('unavailable');
    expect(worker.terminated).toBe(true);
  });

  it('gives up on a worker that does not answer in time and starts a fresh one', async () => {
    vi.useFakeTimers();
    const first = new FakeWorker();
    first.reply = 'silent';
    const second = new FakeWorker();
    const create = vi
      .fn<() => Promise<CheckerWorker>>()
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(second);
    const checker = new WorkerTypeChecker({
      createWorker: create,
      timeoutMs: 1000,
      firstTimeoutMs: 1000,
    });
    const pending = checker.check({ code: '', tests: '' });
    await vi.advanceTimersByTimeAsync(1001);
    expect(await pending).toEqual({
      status: 'unavailable',
      reason: 'The type checker did not answer.',
    });
    expect(first.terminated).toBe(true);
    vi.useRealTimers();
    expect(
      (await checker.check({ code: 'export const f = () => 1;\n', tests: TESTS })).status,
    ).toBe('checked');
  });

  it('treats a malformed reply or a compiler failure as unavailable', async () => {
    for (const reply of ['garbage', 'failure'] as const) {
      vi.useFakeTimers();
      const worker = new FakeWorker();
      worker.reply = reply;
      const checker = new WorkerTypeChecker({
        createWorker: () => Promise.resolve(worker),
        timeoutMs: 500,
        firstTimeoutMs: 500,
      });
      const pending = checker.check({ code: '', tests: '' });
      await vi.advanceTimersByTimeAsync(501);
      expect((await pending).status).toBe('unavailable');
      vi.useRealTimers();
    }
  });

  it('refuses code too large to check, without asking the worker', async () => {
    const worker = new FakeWorker();
    const checker = new WorkerTypeChecker({ createWorker: () => Promise.resolve(worker) });
    const outcome = await checker.check({ code: 'x'.repeat(300 * 1024), tests: '' });
    expect(outcome.status).toBe('unavailable');
    expect(worker.posted).toEqual([]);
  });

  it('ends pending checks and the worker on dispose', async () => {
    const worker = new FakeWorker();
    worker.reply = 'silent';
    const checker = new WorkerTypeChecker({ createWorker: () => Promise.resolve(worker) });
    const pending = checker.check({ code: '', tests: '' });
    await Promise.resolve();
    await Promise.resolve();
    checker.dispose();
    expect((await pending).status).toBe('unavailable');
    expect(worker.terminated).toBe(true);
  });
});

describe('the checker manifest', () => {
  it('accepts a hashed file name and nothing else', () => {
    expect(parseManifest({ file: 'checker.0123abcd.js', typescript: '6.0.3' })).toEqual({
      file: 'checker.0123abcd.js',
      typescript: '6.0.3',
    });
    for (const file of [
      '../sw.js',
      'checker.js',
      'https://x.test/checker.0123abcd.js',
      'checker.0123ABCD.js',
    ]) {
      expect(parseManifest({ file, typescript: '6.0.3' })).toBeNull();
    }
    expect(parseManifest(null)).toBeNull();
    expect(parseManifest({ file: 'checker.0123abcd.js' })).toBeNull();
  });

  it('turns the manifest into the worker URL', async () => {
    const fetchFile = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ file: 'checker.0123abcd.js', typescript: '6.0.3' }),
      }),
    );
    await expect(checkerWorkerUrl(fetchFile)).resolves.toBe('/typescript/checker.0123abcd.js');
    expect(fetchFile).toHaveBeenCalledWith('/typescript/checker.json');
  });

  it('rejects when the manifest is missing or wrong', async () => {
    await expect(
      checkerWorkerUrl(() => Promise.resolve({ ok: false, json: () => Promise.resolve(null) })),
    ).rejects.toThrow();
    await expect(
      checkerWorkerUrl(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) })),
    ).rejects.toThrow();
  });
});
