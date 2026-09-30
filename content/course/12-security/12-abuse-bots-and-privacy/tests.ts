import { take } from './solution';

test('a request with a token through', () => {
  const r = take({ tokens: 3, last: 0 }, 0, 5, 1);
  expect(r.ok).toBe(true);
  expect(r.bucket.tokens).toBe(2);
});

test('an empty bucket refuses', () => {
  const r = take({ tokens: 0, last: 0 }, 0, 5, 1);
  expect(r.ok).toBe(false);
});

test('tokens refill over time, one per second', () => {
  const r = take({ tokens: 0, last: 0 }, 1000, 5, 1);
  expect(r.ok).toBe(true);
  expect(r.bucket.tokens).toBe(0);
});

test('refill never passes the capacity', () => {
  const r = take({ tokens: 5, last: 0 }, 100000, 5, 1);
  expect(r.bucket.tokens).toBe(4);
});

test('a burst of six on a bucket of five leaves the sixth refused', () => {
  let bucket = { tokens: 5, last: 0 };
  const results: boolean[] = [];
  for (let i = 0; i < 6; i++) {
    const r = take(bucket, 0, 5, 1);
    bucket = r.bucket;
    results.push(r.ok);
  }
  expect(results).toEqual([true, true, true, true, true, false]);
});
