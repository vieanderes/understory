test('example from the task', () => {
  const ids = [1, 1, 2, 3, 3];
  const count = removeDuplicates(ids);
  expect(count).toBe(3);
  expect(ids.slice(0, count)).toEqual([1, 2, 3]);
});

test('a long run of one value shrinks to one', () => {
  const ids = [4, 4, 4, 4];
  const count = removeDuplicates(ids);
  expect(count).toBe(1);
  expect(ids.slice(0, count)).toEqual([4]);
});

test('no duplicates leaves the array as it was', () => {
  const ids = [2, 5, 9];
  expect(removeDuplicates(ids)).toBe(3);
  expect(ids).toEqual([2, 5, 9]);
});

test('an empty array gives 0', () => {
  expect(removeDuplicates([])).toBe(0);
});

test('works in place, on the same array', () => {
  const ids = [0, 0, 1, 1, 1, 2, 3, 3];
  const count = removeDuplicates(ids);
  expect(count).toBe(4);
  expect(ids.slice(0, count)).toEqual([0, 1, 2, 3]);
});

test('performance: 1,000,000 ids with many repeats', () => {
  const ids = [];
  for (let i = 0; i < 1000000; i++) ids.push(Math.floor(i / 2));
  const count = removeDuplicates(ids);
  expect(count).toBe(500000);
  expect(ids[499999]).toBe(499999);
});
