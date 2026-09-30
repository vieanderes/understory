import { mergeBookings } from './solution';

test('no bookings give no blocks', () => {
  expect(mergeBookings([])).toEqual([]);
});

test('example from the task', () => {
  expect(mergeBookings([[8, 10], [1, 3], [2, 6]])).toEqual([[1, 6], [8, 10]]);
});

test('touching bookings merge into one block', () => {
  expect(mergeBookings([[3, 5], [1, 3]])).toEqual([[1, 5]]);
});

test('a booking inside another keeps the longer end', () => {
  expect(mergeBookings([[1, 10], [2, 3], [4, 6]])).toEqual([[1, 10]]);
});

test('separate bookings stay apart and the input is untouched', () => {
  const input: [number, number][] = [[5, 6], [1, 2]];
  expect(mergeBookings(input)).toEqual([[1, 2], [5, 6]]);
  expect(input).toEqual([[5, 6], [1, 2]]);
});

test('performance: 200,000 bookings in reverse order', () => {
  const input: [number, number][] = [];
  for (let i = 99999; i >= 0; i--) {
    input.push([i * 10, i * 10 + 5]);
    input.push([i * 10 + 3, i * 10 + 8]);
  }
  const result = mergeBookings(input);
  expect(result).toHaveLength(100000);
  expect(result[0]).toEqual([0, 8]);
  expect(result[99999]).toEqual([999990, 999998]);
});
