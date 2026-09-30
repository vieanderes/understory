test('a flat list adds up', () => {
  expect(sumNested([1, 2, 3])).toBe(6);
});

test('an empty list is 0', () => {
  expect(sumNested([])).toBe(0);
});

test('one level of nesting is included', () => {
  expect(sumNested([1, [2, 3], 4])).toBe(10);
});

test('lists inside lists inside lists are included', () => {
  expect(sumNested([1, [2, [3, [4]]], 5])).toBe(15);
});

test('empty inner lists add nothing', () => {
  expect(sumNested([[], [[]], 7])).toBe(7);
});

test('the input is left unchanged', () => {
  const list = [1, [2, 3]];
  sumNested(list);
  expect(list).toEqual([1, [2, 3]]);
});
