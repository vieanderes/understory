import { bestRoute } from './stones.solution';

test('one stone', () => {
  expect(bestRoute([-5], 1)).toBe(-5);
  expect(bestRoute([7], 3)).toBe(7);
});

test('two stones must both count', () => {
  expect(bestRoute([-4, -6], 5)).toBe(-10);
});

test('all negative: jump as far as you can', () => {
  expect(bestRoute([-1, -1, -1, -1, -1, -1, -1], 3)).toBe(-3);
});

test('all equal and positive: land on every stone', () => {
  expect(bestRoute([2, 2, 2, 2], 3)).toBe(8);
});

test('K larger than the path', () => {
  expect(bestRoute([5, -100, -100, 5], 100_000)).toBe(10);
});

test('sorted ascending with negatives', () => {
  expect(bestRoute([-5, -4, -3, -2, -1, 0, 1], 2)).toBe(-8);
});

test('sorted descending', () => {
  expect(bestRoute([10, 5, 0, -5, -10], 2)).toBe(5);
});

test('a big gain behind a wall of losses', () => {
  expect(bestRoute([0, -10_000, -10_000, -10_000, 10_000, 0], 3)).toBe(0);
  expect(bestRoute([0, -10_000, -10_000, -10_000, 10_000, 0], 4)).toBe(10_000);
});

test('duplicates in the window', () => {
  expect(bestRoute([1, 3, 3, -7, 3, 1], 2)).toBe(11);
});

test('a medium input matches the direct calculation', () => {
  const A: number[] = [];
  let seed = 11;
  for (let i = 0; i < 400; i++) {
    seed = (seed * 48271) % 2147483647;
    A.push((seed % 201) - 100);
  }
  const best: number[] = [A[0]!];
  for (let i = 1; i < A.length; i++) {
    let top = -Infinity;
    for (let j = Math.max(0, i - 6); j < i; j++) top = Math.max(top, best[j]!);
    best.push(A[i]! + top);
  }
  expect(bestRoute(A, 6)).toBe(best[A.length - 1]);
});
