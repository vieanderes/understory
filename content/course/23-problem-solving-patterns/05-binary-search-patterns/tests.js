test('example from the task', () => {
  expect(minShipCapacity([3, 2, 2, 4, 1, 4], 3)).toBe(6);
});

test('works on a longer list', () => {
  expect(minShipCapacity([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5)).toBe(15);
});

test('never goes below the heaviest parcel', () => {
  expect(minShipCapacity([10, 1, 1], 3)).toBe(10);
});

test('one day means shipping everything at once', () => {
  expect(minShipCapacity([4, 5, 6], 1)).toBe(15);
});

test('more days than parcels needs only the heaviest', () => {
  expect(minShipCapacity([4, 5, 6], 10)).toBe(6);
});

test('no parcels needs no capacity', () => {
  expect(minShipCapacity([], 2)).toBe(0);
});

test('performance: 500,000 parcels', () => {
  const weights = [];
  for (let i = 0; i < 500000; i++) weights.push((i % 1000) + 1);
  expect(minShipCapacity(weights, 1000)).toBe(250278);
  expect(minShipCapacity(weights, 1)).toBe(250250000);
});
