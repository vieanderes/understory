import { singleFlight } from './solution';

// A fake token endpoint. It counts its calls and answers after a short wait.
function makeFetch() {
  const stats = { calls: 0, failing: false };
  async function fetchToken(): Promise<string> {
    stats.calls += 1;
    const call = stats.calls;
    for (let tick = 0; tick < 5; tick++) await Promise.resolve();
    if (stats.failing) throw new Error('token service down');
    return `token-${call}`;
  }
  return { fetchToken, stats };
}

test('one caller gets a token', async () => {
  const { fetchToken } = makeFetch();
  const getToken = singleFlight(fetchToken);
  expect(await getToken()).toBe('token-1');
});

test('100 callers at once share one fetch', async () => {
  const { fetchToken, stats } = makeFetch();
  const getToken = singleFlight(fetchToken);
  const callers = Array.from({ length: 100 }, () => getToken());
  const tokens = await Promise.all(callers);
  expect(stats.calls).toBe(1);
  expect(tokens.every((token) => token === 'token-1')).toBe(true);
});

test('a call after the fetch has finished starts a fresh one', async () => {
  const { fetchToken, stats } = makeFetch();
  const getToken = singleFlight(fetchToken);
  await getToken();
  expect(await getToken()).toBe('token-2');
  expect(stats.calls).toBe(2);
});

test('a failed fetch is not kept: the next call tries again', async () => {
  const { fetchToken, stats } = makeFetch();
  const getToken = singleFlight(fetchToken);
  stats.failing = true;
  const first = await Promise.allSettled([getToken(), getToken()]);
  expect(first.every((result) => result.status === 'rejected')).toBe(true);
  expect(stats.calls).toBe(1);
  stats.failing = false;
  expect(await getToken()).toBe('token-2');
});
