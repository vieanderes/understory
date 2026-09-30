export interface Booking {
  room: string;
  start: number; // first night, as a day number
  end: number; // the checkout day, which is not a night
}

// Returns the rooms free for every night from start up to, not including, end,
// in alphabetical order.
export function freeRooms(
  rooms: string[],
  bookings: Booking[],
  start: number,
  end: number,
): string[] {
  const taken = new Set<string>();
  for (const booking of bookings) {
    const overlaps = booking.start <= end && booking.end >= start;
    if (overlaps) {
      taken.add(booking.room);
    }
  }
  const free: string[] = [];
  for (const room of rooms.sort()) {
    if (!taken.has(room)) {
      free.push(room);
    }
  }
  return free;
}
