import { HttpError, retryWithJitter } from './solution';

// A fake service that fails with each error in `failures`, then answers 'ok'.
function makeService(failures: Error[]) {
  const calls = { count: 0 };
  const fn = async () => {
    const failure = failures[calls.count];
    calls.count += 1;
    if (failure) throw failure;
    return 'ok';
  };
  return { fn, calls };
}

function makeOptions(attempts: number, randomValue = 0.5) {
  const waits: number[] = [];
  const options = {
    attempts,
    baseMs: 100,
    random: () => randomValue,
    sleep: async (ms: number) => void waits.push(ms),
  };
  return { options, waits };
}

function timeout() {
  const error = new Error('The operation timed out');
  error.name = 'TimeoutError';
  return error;
}

async function caught(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  return undefined;
}

test('a first success returns at once, with no wait', async () => {
  const { fn, calls } = makeService([]);
  const { options, waits } = makeOptions(3);
  expect(await retryWithJitter(fn, options)).toBe('ok');
  expect(calls.count).toBe(1);
  expect(waits).toEqual([]);
});

test('a 503 is retried after a random wait', async () => {
  const { fn, calls } = makeService([new HttpError(503)]);
  const { options, waits } = makeOptions(3, 0.25);
  expect(await retryWithJitter(fn, options)).toBe('ok');
  expect(calls.count).toBe(2);
  expect(waits).toEqual([25]);
});

test('429 and timeouts are retried, and the waits double', async () => {
  const { fn } = makeService([new HttpError(429), timeout(), new HttpError(500)]);
  const { options, waits } = makeOptions(4);
  expect(await retryWithJitter(fn, options)).toBe('ok');
  expect(waits).toEqual([50, 100, 200]);
});

test('after the last attempt, the last error is thrown', async () => {
  const last = new HttpError(502);
  const { fn, calls } = makeService([new HttpError(503), new HttpError(503), last]);
  const { options } = makeOptions(3);
  expect(await caught(retryWithJitter(fn, options))).toBe(last);
  expect(calls.count).toBe(3);
});

test('a 400 is thrown at once, never retried', async () => {
  const bad = new HttpError(400);
  const { fn, calls } = makeService([bad]);
  const { options, waits } = makeOptions(3);
  expect(await caught(retryWithJitter(fn, options))).toBe(bad);
  expect(calls.count).toBe(1);
  expect(waits).toEqual([]);
});

test('a bug in your own code is not retried', async () => {
  const { fn, calls } = makeService([new TypeError('reading.map is not a function')]);
  const { options } = makeOptions(3);
  expect(await caught(retryWithJitter(fn, options))).toBeInstanceOf(TypeError);
  expect(calls.count).toBe(1);
});
