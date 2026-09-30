import { HttpError, TimeoutError, callWithRetry } from './retry.solution';
import type { ModelCall, RetryOptions, Signal } from './retry.solution';

const TIMEOUT_MS = 30000;

// Backoff waits resolve at once and are recorded. The timeout timer fires only as many
// times as the test allows, and otherwise never.
function fakeTime(timeoutsThatFire = 0) {
  const waits: number[] = [];
  let fires = timeoutsThatFire;
  const sleep = (ms: number): Promise<void> => {
    if (ms !== TIMEOUT_MS) {
      waits.push(ms);
      return Promise.resolve();
    }
    if (fires === 0) return new Promise<void>(() => {});
    fires -= 1;
    return Promise.resolve();
  };
  return { waits, sleep };
}

function options(sleep: (ms: number) => Promise<void>): RetryOptions {
  return { timeoutMs: TIMEOUT_MS, retries: 3, baseMs: 100, sleep, random: () => 0.5 };
}

// Throws each given error in turn, then answers.
function flaky(errors: unknown[]) {
  const prompts: string[] = [];
  const call: ModelCall = async (prompt) => {
    prompts.push(prompt);
    const error = errors[prompts.length - 1];
    if (error !== undefined) throw error;
    return 'Tuesday';
  };
  return { call, prompts };
}

// A hung call: it answers only after many turns of the event loop, later than any
// timeout that fires. Code with no timeout gets this stale answer instead of hanging.
async function tooLate(): Promise<string> {
  for (let turn = 0; turn < 50; turn++) await Promise.resolve();
  return 'too late';
}

async function failure(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('Expected the call to fail, but it answered');
}

test('a first answer comes back at once, with no waits', async () => {
  const time = fakeTime();
  const { call, prompts } = flaky([]);
  expect(await callWithRetry(call, 'Which day is bin day?', options(time.sleep))).toBe('Tuesday');
  expect(prompts).toEqual(['Which day is bin day?']);
  expect(time.waits).toEqual([]);
});

test('a 503 and a 429 are retried, with growing, jittered waits', async () => {
  const time = fakeTime();
  const { call, prompts } = flaky([new HttpError(503), new HttpError(429)]);
  expect(await callWithRetry(call, 'Which day is bin day?', options(time.sleep))).toBe('Tuesday');
  expect(prompts).toHaveLength(3);
  expect(time.waits).toEqual([50, 100]);
});

test('a 400 fails at once, because asking again gets the same answer', async () => {
  const time = fakeTime();
  const { call, prompts } = flaky([new HttpError(400)]);
  const error = await failure(callWithRetry(call, 'Which day is bin day?', options(time.sleep)));
  expect(error).toBeInstanceOf(HttpError);
  expect((error as HttpError).status).toBe(400);
  expect(prompts).toHaveLength(1);
  expect(time.waits).toEqual([]);
});

test('a bug in our own code is not retried', async () => {
  const time = fakeTime();
  const { call, prompts } = flaky([new TypeError('prompt.trim is not a function')]);
  const error = await failure(callWithRetry(call, 'Which day is bin day?', options(time.sleep)));
  expect(error).toBeInstanceOf(TypeError);
  expect(prompts).toHaveLength(1);
});

test('after the last retry it gives up and throws the last error', async () => {
  const time = fakeTime();
  const { call, prompts } = flaky([new HttpError(500), new HttpError(502), new HttpError(503), new HttpError(504)]);
  const error = await failure(callWithRetry(call, 'Which day is bin day?', options(time.sleep)));
  expect((error as HttpError).status).toBe(504);
  expect(prompts).toHaveLength(4);
  expect(time.waits).toEqual([50, 100, 200]);
});

test('a hung call times out, is told to stop, and is retried', async () => {
  const time = fakeTime(1);
  const signals: Signal[] = [];
  const call: ModelCall = (_prompt, signal) => {
    signals.push(signal);
    // The first attempt hangs. The second answers at once.
    return signals.length === 1 ? tooLate() : Promise.resolve('Tuesday');
  };
  expect(await callWithRetry(call, 'Which day is bin day?', options(time.sleep))).toBe('Tuesday');
  expect(signals).toHaveLength(2);
  expect(signals[0]?.aborted).toBe(true);
  expect(signals[1]?.aborted).toBe(false);
  expect(time.waits).toEqual([50]);
});

test('a call that always hangs ends in a TimeoutError', async () => {
  const time = fakeTime(4);
  const call: ModelCall = () => tooLate();
  const error = await failure(callWithRetry(call, 'Which day is bin day?', options(time.sleep)));
  expect(error).toBeInstanceOf(TimeoutError);
  expect(time.waits).toEqual([50, 100, 200]);
});
