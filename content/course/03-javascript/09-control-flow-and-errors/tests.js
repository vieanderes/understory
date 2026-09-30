function countCalls() {
  let made = 0;
  return {
    release: () => {
      made = made + 1;
    },
    calls: () => made,
  };
}

function thrownBy(run) {
  try {
    run();
  } catch (thrown) {
    return thrown;
  }
  return undefined;
}

function declined(message) {
  const error = new Error(message);
  error.code = 'card_declined';
  return error;
}

test('returns the receipt and releases the seats once', () => {
  const lock = countCalls();
  expect(settleOrder(() => 'R-1001', lock.release)).toEqual({ status: 'paid', receipt: 'R-1001' });
  expect(lock.calls()).toBe(1);
});

test('turns a declined card into an outcome, not an error', () => {
  const lock = countCalls();
  const outcome = settleOrder(() => {
    throw declined('insufficient funds');
  }, lock.release);
  expect(outcome).toEqual({ status: 'declined', reason: 'insufficient funds' });
  expect(lock.calls()).toBe(1);
});

test('wraps an unexpected error and keeps it as the cause', () => {
  const lock = countCalls();
  const timeout = new TypeError('gateway timed out');
  const thrown = thrownBy(() =>
    settleOrder(() => {
      throw timeout;
    }, lock.release),
  );
  expect(thrown instanceof Error).toBe(true);
  expect(thrown.message).toBe('checkout failed');
  expect(thrown.cause).toBe(timeout);
  expect(lock.calls()).toBe(1);
});

test('wraps a thrown string as well', () => {
  const lock = countCalls();
  const thrown = thrownBy(() =>
    settleOrder(() => {
      throw 'card number missing';
    }, lock.release),
  );
  expect(thrown instanceof Error).toBe(true);
  expect(thrown.message).toBe('checkout failed');
  expect(thrown.cause).toBe('card number missing');
  expect(lock.calls()).toBe(1);
});

test('never reports a failed charge as paid', () => {
  const thrown = thrownBy(() =>
    settleOrder(() => {
      throw new RangeError('amount is negative');
    }, () => undefined),
  );
  expect(thrown instanceof RangeError).toBe(false);
  expect(thrown.message).toBe('checkout failed');
});
