test('example from the task', () => {
  expect(longestStreak([12000, 9000, 11000, 13000, 10500], 10000)).toBe(3);
});

test('no days give 0', () => {
  expect(longestStreak([], 10000)).toBe(0);
});

test('no good days give 0', () => {
  expect(longestStreak([4000, 9999], 10000)).toBe(0);
});

test('exactly the goal counts', () => {
  expect(longestStreak([10000, 10000], 10000)).toBe(2);
});

test('a run that reaches the last day', () => {
  expect(longestStreak([12000, 500, 11000, 11000, 11000], 10000)).toBe(3);
});

test('every day on target', () => {
  expect(longestStreak([10500, 12000, 15000], 10000)).toBe(3);
});

test('the list is left as it was', () => {
  const steps = [12000, 3000];
  longestStreak(steps, 10000);
  expect(steps).toEqual([12000, 3000]);
});

test('performance: 200,000 days, all on target', () => {
  const steps = [];
  for (let i = 0; i < 200000; i++) steps.push(10000 + (i % 500));
  expect(longestStreak(steps, 10000)).toBe(200000);
});
