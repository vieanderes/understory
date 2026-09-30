import { countPeriods } from './periods.solution';

// A small seeded generator, so every run builds the same input.
function changes(n: number, seed: number, spread: number): number[] {
  const A: number[] = [];
  let state = seed;
  for (let i = 0; i < n; i++) {
    state = (state * 48271) % 2147483647;
    A.push((state % (2 * spread + 1)) - spread);
  }
  return A;
}

test('large: 100,000 small changes between -3 and 3', () => {
  expect(countPeriods(changes(100_000, 42, 3), 5)).toBe(11_691_656);
});

test('large: 100,000 changes across the whole range', () => {
  expect(countPeriods(changes(100_000, 9, 10_000), 10_000)).toBe(2103);
});

test('large: 100,000 zeros give more than a billion periods', () => {
  const A = new Array<number>(100_000).fill(0);
  expect(countPeriods(A, 0)).toBe(-1);
});
