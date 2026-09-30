import { runInWorker, type WorkerLike } from './solution';

type Reply = { message: unknown } | { error: Error };

// A fake worker that answers straight away, inside `postMessage`.
class FakeWorker implements WorkerLike {
  listeners: Record<string, ((value: unknown) => void)[]> = { message: [], error: [] };
  posted: unknown[] = [];
  terminated = 0;

  constructor(private readonly answer: (job: unknown) => Reply) {}

  on(event: 'message' | 'error', listener: (value: unknown) => void): void {
    this.listeners[event]?.push(listener);
  }

  postMessage(job: unknown): void {
    this.posted.push(job);
    const reply = this.answer(job);
    if ('error' in reply) this.listeners.error?.forEach((listener) => listener(reply.error));
    else this.listeners.message?.forEach((listener) => listener(reply.message));
  }

  terminate(): void {
    this.terminated += 1;
  }
}

// Lets pending promise callbacks run, then says how the promise ended.
async function outcome(promise: Promise<unknown>): Promise<{ state: string; value?: unknown }> {
  let result: { state: string; value?: unknown } = { state: 'still waiting' };
  promise.then(
    (value) => (result = { state: 'resolved', value }),
    (value) => (result = { state: 'rejected', value }),
  );
  for (let turn = 0; turn < 10; turn++) await Promise.resolve();
  return result;
}

test('sends the job to the worker', async () => {
  const worker = new FakeWorker(() => ({ message: 'ok' }));
  await outcome(runInWorker(worker, { month: '2026-09' }));
  expect(worker.posted).toEqual([{ month: '2026-09' }]);
});

test('resolves with the reply, even one sent straight away', async () => {
  const worker = new FakeWorker(() => ({ message: 'report.pdf' }));
  expect(await outcome(runInWorker(worker, { month: '2026-09' }))).toEqual({
    state: 'resolved',
    value: 'report.pdf',
  });
});

test('rejects when the worker throws', async () => {
  const broken = new Error('bad month');
  const worker = new FakeWorker(() => ({ error: broken }));
  const result = await outcome(runInWorker(worker, { month: 'never' }));
  expect(result.state).toBe('rejected');
  expect(result.value).toBe(broken);
});

test('stops the worker after a reply', async () => {
  const worker = new FakeWorker(() => ({ message: 'report.pdf' }));
  await outcome(runInWorker(worker, {}));
  expect(worker.terminated).toBe(1);
});

test('stops the worker after an error too', async () => {
  const worker = new FakeWorker(() => ({ error: new Error('bad month') }));
  await outcome(runInWorker(worker, {}));
  expect(worker.terminated).toBe(1);
});
