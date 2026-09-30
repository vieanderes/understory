import { exactTotal } from './solution';

test('example from the task', () => {
  expect(exactTotal([150, 250, -100])).toBe(300n);
});

test('no payments total 0', () => {
  expect(exactTotal([])).toBe(0n);
});

test('refunds can make the total negative', () => {
  expect(exactTotal([500, -700])).toBe(-200n);
});

test('a total just past 2^53', () => {
  expect(exactTotal([Number.MAX_SAFE_INTEGER, 2])).toBe(9007199254740993n);
});

test('large payments and a small one', () => {
  const max = Number.MAX_SAFE_INTEGER;
  expect(exactTotal([max, max, 1])).toBe(18014398509481983n);
});

test('performance: 1,000,000 payments past 2^53 in total', () => {
  const amounts: number[] = [];
  for (let i = 0; i < 1_000_000; i++) amounts.push(90_000_000_001 + (i % 3));
  expect(exactTotal(amounts)).toBe(90_000_000_001_999_999n);
});
