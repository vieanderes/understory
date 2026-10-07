import { afterAttempt, DISABLE_AFTER } from './solution';

const MIN_MS = 60_000;
const HOUR_MS = 60 * MIN_MS;
const NOW = Date.UTC(2026, 9, 7, 9, 0);
const healthy = { consecutiveFailures: 0, disabled: false };

test('a 2xx is delivered and clears the failure count', () => {
  const result = afterAttempt({ consecutiveFailures: 6, disabled: false }, 3, { status: 204 }, NOW);
  expect(result.decision).toEqual({ kind: 'delivered' });
  expect(result.endpoint).toEqual({ consecutiveFailures: 0, disabled: false });
});

test('retries grow along the schedule, from a minute to hours', () => {
  expect(afterAttempt(healthy, 1, { status: 500 }, NOW).decision).toEqual({ kind: 'retry', at: NOW + MIN_MS });
  expect(afterAttempt(healthy, 4, { status: 500 }, NOW).decision).toEqual({ kind: 'retry', at: NOW + 2 * HOUR_MS });
  expect(afterAttempt(healthy, 1, { status: 500 }, NOW).endpoint).toEqual({ consecutiveFailures: 1, disabled: false });
});

test('a timeout and a redirect are failures too', () => {
  expect(afterAttempt(healthy, 2, { error: 'timeout' }, NOW).decision).toEqual({ kind: 'retry', at: NOW + 5 * MIN_MS });
  expect(afterAttempt(healthy, 2, { status: 302 }, NOW).decision).toEqual({ kind: 'retry', at: NOW + 5 * MIN_MS });
});

test('a longer Retry-After wins, and a shorter one never speeds things up', () => {
  const longer = afterAttempt(healthy, 1, { status: 429, retryAfterMs: 10 * MIN_MS }, NOW);
  expect(longer.decision).toEqual({ kind: 'retry', at: NOW + 10 * MIN_MS });
  const shorter = afterAttempt(healthy, 3, { status: 503, retryAfterMs: 1_000 }, NOW);
  expect(shorter.decision).toEqual({ kind: 'retry', at: NOW + 30 * MIN_MS });
});

test('after the last scheduled retry fails, the event gives up and the endpoint stays on', () => {
  const result = afterAttempt({ consecutiveFailures: 6, disabled: false }, 7, { status: 500 }, NOW);
  expect(result.decision).toEqual({ kind: 'give-up' });
  expect(result.endpoint).toEqual({ consecutiveFailures: 7, disabled: false });
});

test('too many failures in a row switch the endpoint off and tell its owner, mid-schedule', () => {
  const almost = { consecutiveFailures: DISABLE_AFTER - 1, disabled: false };
  const result = afterAttempt(almost, 2, { error: 'network' }, NOW);
  expect(result.decision).toEqual({ kind: 'disable', notifyOwner: true });
  expect(result.endpoint).toEqual({ consecutiveFailures: DISABLE_AFTER, disabled: true });
});
