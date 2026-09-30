import { bestRoute } from './stones.solution';

// A small seeded generator, so every run builds the same input.
function stones(n: number, seed: number): number[] {
  const A: number[] = [];
  let state = seed;
  for (let i = 0; i < n; i++) {
    state = (state * 48271) % 2147483647;
    A.push((state % 20_001) - 10_000);
  }
  return A;
}

test('large: 100,000 stones with jumps of up to 50,000', () => {
  expect(bestRoute(stones(100_000, 5), 50_000)).toBe(248_788_806);
});

test('large: 100,000 negative stones with jumps of up to 100,000', () => {
  const A = new Array<number>(100_000).fill(-10_000);
  expect(bestRoute(A, 100_000)).toBe(-20_000);
});

test('large: 100,000 stones with short jumps', () => {
  expect(bestRoute(stones(100_000, 17), 3)).toBe(229_514_566);
});
