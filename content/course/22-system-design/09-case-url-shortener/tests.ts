import { toBase62 } from './solution';

test('0 is "0"', () => {
  expect(toBase62(0)).toBe('0');
});

test('61 is the last single character, "Z"', () => {
  expect(toBase62(61)).toBe('Z');
});

test('62 rolls over to two characters', () => {
  expect(toBase62(62)).toBe('10');
});

test('125 is "21"', () => {
  expect(toBase62(125)).toBe('21');
});

test('a billion fits in six characters', () => {
  expect(toBase62(1_000_000_000)).toBe('15FTGg');
});

test('the largest six-character code', () => {
  expect(toBase62(62 ** 6 - 1)).toBe('ZZZZZZ');
});

test('rejects negative and fractional input', () => {
  expect(() => toBase62(-1)).toThrow();
  expect(() => toBase62(2.5)).toThrow();
});
