const hasText = (list) => list.some((amount) => typeof amount === 'string');

test('finds the one amount that breaks the scaler', () => {
  expect(shrink([200, 'a pinch', 3], hasText)).toEqual(['a pinch']);
});

test('keeps two items that only fail together, in order', () => {
  const both = (list) => list.includes('eggs') && list.includes('milk');
  expect(shrink(['flour', 'eggs', 'sugar', 'milk', 'salt'], both)).toEqual(['eggs', 'milk']);
});

test('returns an empty list when the bug needs no items at all', () => {
  expect(shrink([1, 2, 3], () => true)).toEqual([]);
});

test('leaves a list alone when nothing can go', () => {
  expect(shrink(['a pinch'], hasText)).toEqual(['a pinch']);
});

test('does not change the original list', () => {
  const items = [200, 'a pinch', 3, 'to taste'];
  shrink(items, hasText);
  expect(items).toEqual([200, 'a pinch', 3, 'to taste']);
});

test('tries an earlier removal again after a later one', () => {
  // Fails with "salt" alone, or with "a pinch" and "salt" together, but not "a pinch" alone.
  const fails = (list) => list.includes('salt') && (list.length === 1 || list.includes('a pinch'));
  expect(shrink(['a pinch', 'salt', 3], fails)).toEqual(['salt']);
});
