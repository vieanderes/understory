import { countPeriods } from './periods.solution';

test('one element that does not match', () => {
  expect(countPeriods([4], 5)).toBe(0);
});

test('K is zero and every change is zero', () => {
  // 4 + 3 + 2 + 1 periods.
  expect(countPeriods([0, 0, 0, 0], 0)).toBe(10);
});

test('all equal positive changes', () => {
  expect(countPeriods([2, 2, 2, 2], 4)).toBe(3);
});

test('all negative changes with a negative K', () => {
  expect(countPeriods([-1, -1, -1], -2)).toBe(2);
});

test('periods that cancel out', () => {
  expect(countPeriods([1, -1, 1, -1], 0)).toBe(4);
});

test('sorted and reverse sorted', () => {
  expect(countPeriods([1, 2, 3, 4, 5], 5)).toBe(2);
  expect(countPeriods([5, 4, 3, 2, 1], 5)).toBe(2);
});

test('no period matches', () => {
  expect(countPeriods([1, 2, 3], 100)).toBe(0);
});

test('extremes of the value range', () => {
  expect(countPeriods([10_000, -10_000, 10_000], 10_000)).toBe(3);
  expect(countPeriods([-10_000, -10_000], -1_000_000_000)).toBe(0);
});

test('the whole array is the only match', () => {
  expect(countPeriods([3, 4, -2, 6], 11)).toBe(1);
});

test('a medium mixed input matches a direct count', () => {
  const A: number[] = [];
  let seed = 7;
  for (let i = 0; i < 300; i++) {
    seed = (seed * 48271) % 2147483647;
    A.push((seed % 7) - 3);
  }
  let expected = 0;
  for (let p = 0; p < A.length; p++) {
    let sum = 0;
    for (let q = p; q < A.length; q++) {
      sum += A[q]!;
      if (sum === 1) expected += 1;
    }
  }
  expect(countPeriods(A, 1)).toBe(expected);
});
