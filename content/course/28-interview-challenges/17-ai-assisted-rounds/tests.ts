import { mergeBookings } from './solution';

test('the example from the task', () => {
  expect(
    mergeBookings([
      [540, 600],
      [570, 660],
      [720, 780],
    ]),
  ).toEqual([
    [540, 660],
    [720, 780],
  ]);
});

test('no bookings give no blocks', () => {
  expect(mergeBookings([])).toEqual([]);
});

test('bookings in any order come out sorted by start', () => {
  expect(
    mergeBookings([
      [1020, 1080],
      [540, 600],
      [90, 120],
    ]),
  ).toEqual([
    [90, 120],
    [540, 600],
    [1020, 1080],
  ]);
});

test('a booking inside a longer one after a touch keeps the longer end', () => {
  expect(
    mergeBookings([
      [540, 600],
      [600, 900],
      [660, 720],
    ]),
  ).toEqual([[540, 900]]);
});

test('bookings that touch join into one block', () => {
  expect(
    mergeBookings([
      [600, 660],
      [660, 720],
    ]),
  ).toEqual([[600, 720]]);
});

test('a booking inside a longer one keeps the longer end', () => {
  expect(
    mergeBookings([
      [480, 1020],
      [540, 600],
    ]),
  ).toEqual([[480, 1020]]);
});

test('the input array is not changed', () => {
  const bookings: [number, number][] = [
    [720, 780],
    [540, 600],
  ];
  mergeBookings(bookings);
  expect(bookings).toEqual([
    [720, 780],
    [540, 600],
  ]);
});

test('large: 100,000 overlapping bookings in reverse order', () => {
  const bookings: [number, number][] = [];
  for (let i = 99999; i >= 0; i--) bookings.push([i * 2, i * 2 + 3]);
  expect(mergeBookings(bookings)).toEqual([[0, 200001]]);
});
