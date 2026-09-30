test('no keys means no bucket holds anything', () => {
  expect(fullestBucket([], 4)).toBe(0);
});

test('keys of different lengths spread out', () => {
  expect(fullestBucket(['li', 'ana', 'zara'], 4)).toBe(1);
});

test('keys of one length all collide', () => {
  expect(fullestBucket(['ana', 'ben', 'kim'], 4)).toBe(3);
});

test('lengths that differ by the bucket count collide too', () => {
  expect(fullestBucket(['li', 'oliver', 'ana'], 4)).toBe(2);
});

test('a single bucket takes every key', () => {
  expect(fullestBucket(['li', 'ana', 'zara', 'oliver'], 1)).toBe(4);
});
