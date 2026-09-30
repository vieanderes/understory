import { scoreboard } from './counters.solution';

test('large: 100,000 counters, every other operation a reset', () => {
  const N = 100_000;
  const A: number[] = [];
  for (let i = 0; i < 100_000; i++) A.push(i % 2 === 0 ? (i % N) + 1 : N + 1);
  const result = scoreboard(N, A);
  expect(result).toHaveLength(N);
  expect(result[0]).toBe(50_000);
  expect(result[N - 1]).toBe(50_000);
});

test('large: 100,000 counters, all resets but one point', () => {
  const N = 100_000;
  const A = new Array<number>(100_000).fill(N + 1);
  A[0] = 7;
  const result = scoreboard(N, A);
  expect(result[6]).toBe(1);
  expect(result[0]).toBe(1);
});

test('large: 100,000 points on one counter', () => {
  const N = 100_000;
  const A = new Array<number>(100_000).fill(1);
  const result = scoreboard(N, A);
  expect(result[0]).toBe(100_000);
  expect(result[1]).toBe(0);
});
