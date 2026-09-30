import { largestSeason } from './seasons.solution';

test('large: 100,000 episodes of 10,000 minutes in 3 seasons', () => {
  const A = new Array<number>(100_000).fill(10_000);
  // 33,334 episodes in the longest season.
  expect(largestSeason(3, A)).toBe(333_340_000);
});

test('large: 100,000 varied episodes in 7 seasons', () => {
  const A: number[] = [];
  for (let i = 0; i < 100_000; i++) A.push((i * 7919) % 10_001);
  expect(largestSeason(7, A)).toBe(71_431_010);
});

test('large: as many seasons as episodes', () => {
  const A: number[] = [];
  for (let i = 0; i < 100_000; i++) A.push(i % 10_001);
  expect(largestSeason(100_000, A)).toBe(10_000);
});
