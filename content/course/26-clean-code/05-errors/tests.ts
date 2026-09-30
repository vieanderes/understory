import { InvalidAgeError, parseAge } from './solution';

function errorFrom(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  return undefined;
}

test('returns a whole-number age', () => {
  expect(parseAge('42')).toBe(42);
  expect(parseAge('0')).toBe(0);
});

test('throws InvalidAgeError for text, with the input in the message', () => {
  const error = errorFrom(() => parseAge('abc'));
  expect(error instanceof InvalidAgeError).toBe(true);
  expect(() => parseAge('abc')).toThrow('abc');
});

test('throws for negative, fractional and impossible ages', () => {
  for (const input of ['-3', '12.5', '200']) {
    expect(errorFrom(() => parseAge(input)) instanceof InvalidAgeError).toBe(true);
  }
});

test('throws for empty input instead of reading it as 0', () => {
  expect(errorFrom(() => parseAge('  ')) instanceof InvalidAgeError).toBe(true);
});

test('names the error so logs show what failed', () => {
  const error = errorFrom(() => parseAge('abc'));
  expect(error instanceof Error && error.name).toBe('InvalidAgeError');
});
