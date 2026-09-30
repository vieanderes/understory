import { bookRoom, postBooking, importCsv, type Booking } from './solution';

test('the handler still answers 201 for a normal booking', () => {
  const saved: Booking[] = [];
  expect(postBooking({ room: 'oak', guests: 4 }, saved)).toBe(201);
  expect(saved).toEqual([{ room: 'oak', guests: 4 }]);
});

test('the handler still answers 422 for too many guests, and saves nothing', () => {
  const saved: Booking[] = [];
  expect(postBooking({ room: 'oak', guests: 30 }, saved)).toBe(422);
  expect(saved).toHaveLength(0);
});

test('the import refuses a line with 30 guests', () => {
  const saved: Booking[] = [];
  expect(importCsv(['oak,30'], saved)).toEqual(['oak,30']);
  expect(saved).toHaveLength(0);
});

test('the import saves good lines and refuses bad ones', () => {
  const saved: Booking[] = [];
  expect(importCsv(['oak,4', 'ash,0', 'elm,8'], saved)).toEqual(['ash,0']);
  expect(saved).toEqual([
    { room: 'oak', guests: 4 },
    { room: 'elm', guests: 8 },
  ]);
});

test('the rule lives in bookRoom', () => {
  const saved: Booking[] = [];
  expect(bookRoom({ room: 'oak', guests: 9 }, saved).ok).toBe(false);
  expect(bookRoom({ room: 'oak', guests: 1 }, saved)).toEqual({ ok: true });
  expect(saved).toHaveLength(1);
});
