import { largestBanner } from './banner.solution';

test('large: 100,000 ascending heights', () => {
  const H: number[] = [];
  for (let i = 1; i <= 100_000; i++) H.push(i);
  // Height 50,000 across the last 50,001 buildings: 50,000 * 50,001.
  expect(largestBanner(H)).toBe(2_500_050_000);
});

test('large: 100,000 equal heights at the top of the range', () => {
  const H = new Array<number>(100_000).fill(1_000_000_000);
  expect(largestBanner(H)).toBe(100_000_000_000_000);
});

test('large: 100,000 heights in a sawtooth', () => {
  const H: number[] = [];
  for (let i = 0; i < 100_000; i++) H.push(1000 + (i % 100) * 10);
  // Every building is at least 1000 high, so the whole row gives 100,000,000.
  expect(largestBanner(H)).toBe(100_000_000);
});
