import { waitUntilHealthy } from './solution';

// A fake /health that gives these answers in turn. 'down' means nothing answered.
function health(answers: Array<boolean | 'down'>) {
  const calls = { checks: 0, pauses: 0 };
  const check = async () => {
    const answer = answers[calls.checks] ?? false;
    calls.checks++;
    if (answer === 'down') throw new Error('connect ECONNREFUSED');
    return answer;
  };
  const pause = async () => {
    calls.pauses++;
  };
  return { check, pause, calls };
}

test('healthy at once: true, with no pause', async () => {
  const h = health([true]);
  expect(await waitUntilHealthy(h.check, 5, h.pause)).toBe(true);
  expect(h.calls.checks).toBe(1);
  expect(h.calls.pauses).toBe(0);
});

test('keeps asking until the app is healthy', async () => {
  const h = health([false, false, true]);
  expect(await waitUntilHealthy(h.check, 5, h.pause)).toBe(true);
  expect(h.calls.checks).toBe(3);
});

test('an app that is not listening yet counts as unhealthy, not a crash', async () => {
  const h = health(['down', 'down', true]);
  expect(await waitUntilHealthy(h.check, 5, h.pause)).toBe(true);
});

test('pauses between tries', async () => {
  const h = health([false, true]);
  await waitUntilHealthy(h.check, 5, h.pause);
  expect(h.calls.pauses).toBe(1);
});

test('gives up after the last attempt, without a pause after it', async () => {
  const h = health([false, false, false, false]);
  expect(await waitUntilHealthy(h.check, 3, h.pause)).toBe(false);
  expect(h.calls.checks).toBe(3);
  expect(h.calls.pauses).toBe(2);
});
