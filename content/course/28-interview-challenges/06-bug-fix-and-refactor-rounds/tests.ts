import { freeRooms } from './solution';

test('a room with no bookings is free', () => {
  expect(freeRooms(['A1'], [], 3, 5)).toEqual(['A1']);
});

test('a booking inside the stay takes the room', () => {
  const bookings = [{ room: 'A1', start: 4, end: 6 }];
  expect(freeRooms(['A1', 'B2'], bookings, 3, 8)).toEqual(['B2']);
});

test('a guest checking out on the first day does not clash', () => {
  const bookings = [{ room: 'A1', start: 1, end: 3 }];
  expect(freeRooms(['A1'], bookings, 3, 5)).toEqual(['A1']);
});

test('a guest arriving on the checkout day does not clash', () => {
  const bookings = [{ room: 'A1', start: 5, end: 7 }];
  expect(freeRooms(['A1'], bookings, 3, 5)).toEqual(['A1']);
});

test('the result is sorted and the rooms list is left as it was', () => {
  const rooms = ['C3', 'A1', 'B2'];
  expect(freeRooms(rooms, [], 1, 2)).toEqual(['A1', 'B2', 'C3']);
  expect(rooms).toEqual(['C3', 'A1', 'B2']);
});

test('a booking that covers the whole stay takes the room', () => {
  const bookings = [{ room: 'B2', start: 1, end: 10 }];
  expect(freeRooms(['A1', 'B2'], bookings, 3, 5)).toEqual(['A1']);
});
