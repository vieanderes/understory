import { isOlder } from './solution';

test('2.8.5 is older than 2.9.0', () => {
  expect(isOlder('2.8.5', '2.9.0')).toBe(true);
});

test('2.10.0 is newer than 2.9.0, though it sorts first as text', () => {
  expect(isOlder('2.10.0', '2.9.0')).toBe(false);
});

test('10.0.0 is newer than 9.9.9', () => {
  expect(isOlder('10.0.0', '9.9.9')).toBe(false);
});

test('the same version is not older', () => {
  expect(isOlder('2.9.0', '2.9.0')).toBe(false);
});

test('the last number decides when the others match', () => {
  expect(isOlder('2.9.1', '2.9.10')).toBe(true);
});

test('something that is not a version throws', () => {
  expect(() => isOlder('two', '2.9.0')).toThrow();
});
