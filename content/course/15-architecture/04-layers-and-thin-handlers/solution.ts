export type Booking = { room: string; guests: number };
export type Result = { ok: true } | { ok: false; reason: string };

// The domain: the one place the guest rule lives, so every entry point passes it.
export function bookRoom(booking: Booking, saved: Booking[]): Result {
  if (booking.guests < 1 || booking.guests > 8) {
    return { ok: false, reason: 'a room takes 1 to 8 guests' };
  }
  saved.push(booking);
  return { ok: true };
}

// A handler: POST /bookings
export function postBooking(body: Booking, saved: Booking[]): number {
  const result = bookRoom({ room: body.room, guests: body.guests }, saved);
  return result.ok ? 201 : 422;
}

// A second entry point: a bulk upload of "room,guests" lines
export function importCsv(lines: string[], saved: Booking[]): string[] {
  const refused: string[] = [];
  for (const line of lines) {
    const [room = '', guests = ''] = line.split(',');
    const result = bookRoom({ room, guests: Number(guests) }, saved);
    if (!result.ok) refused.push(line);
  }
  return refused;
}
