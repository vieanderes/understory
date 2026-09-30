import { percentile } from './solution';

const latencies = [102, 101, 103, 101, 209, 102, 101, 104, 102, 825];

test('p50 is the middle of the sorted samples', () => {
  expect(percentile(latencies, 50)).toBe(102);
});

test('p95 shows the tail the mean hides', () => {
  expect(percentile(latencies, 95)).toBe(825);
});

test('p90 sits below the single worst sample', () => {
  expect(percentile(latencies, 90)).toBe(209);
});

test('p100 is the maximum', () => {
  expect(percentile(latencies, 100)).toBe(825);
});

test('a low percentile never goes below the first sample', () => {
  expect(percentile(latencies, 1)).toBe(101);
});

test('the input is left unsorted', () => {
  const copy = [...latencies];
  percentile(latencies, 95);
  expect(latencies).toEqual(copy);
});

test('no samples gives null', () => {
  expect(percentile([], 95)).toBe(null);
});
