import { processNext, type Job, type Queue } from './solution';

function makeQueue(jobs: Job[]): Queue {
  return { waiting: jobs, done: [], dead: [], maxAttempts: 3, baseDelayMs: 1000 };
}
const job = (id: string, runAt = 0): Job => ({ id, attempts: 0, runAt });
const works = async () => {};
const fails = async () => {
  throw new Error('model API unavailable');
};

test('with nothing due, it does nothing', async () => {
  const queue = makeQueue([job('a', 5000)]);
  expect(await processNext(queue, works, 0)).toBe('idle');
  expect(queue.waiting).toHaveLength(1);
});

test('a job that works is acknowledged', async () => {
  const queue = makeQueue([job('a')]);
  expect(await processNext(queue, works, 0)).toBe('done');
  expect(queue.done).toEqual(['a']);
  expect(queue.waiting).toHaveLength(0);
});

test('it takes the first due job and leaves one that is not due', async () => {
  const queue = makeQueue([job('later', 9000), job('now', 0)]);
  await processNext(queue, works, 100);
  expect(queue.done).toEqual(['now']);
  expect(queue.waiting.map((j) => j.id)).toEqual(['later']);
});

test('a failed job is not acknowledged and waits the base delay', async () => {
  const queue = makeQueue([job('a')]);
  expect(await processNext(queue, fails, 100)).toBe('retry');
  expect(queue.done).toEqual([]);
  expect(queue.waiting).toEqual([{ id: 'a', attempts: 1, runAt: 1100 }]);
});

test('the second failure waits twice as long', async () => {
  const queue = makeQueue([{ id: 'a', attempts: 1, runAt: 0 }]);
  await processNext(queue, fails, 2000);
  expect(queue.waiting).toEqual([{ id: 'a', attempts: 2, runAt: 4000 }]);
});

test('the last allowed failure moves the job to the dead-letter queue', async () => {
  const queue = makeQueue([{ id: 'a', attempts: 2, runAt: 0 }]);
  expect(await processNext(queue, fails, 0)).toBe('dead');
  expect(queue.waiting).toHaveLength(0);
  expect(queue.done).toEqual([]);
  expect(queue.dead.map((j) => j.id)).toEqual(['a']);
});
