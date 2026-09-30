export type Booking = { room: string; guests: number };
export type Result = { ok: true } | { ok: false; reason: string };

// The domain: put the rule here, once.
export function bookRoom(booking: Booking, saved: Booking[]): Result {
  saved.push(booking);
  return { ok: true };
}

// A handler: POST /bookings
export function postBooking(body: Booking, saved: Booking[]): number {
  if (body.guests < 1 || body.guests > 8) return 422;
  saved.push({ room: body.room, guests: body.guests });
  return 201;
}

// A second entry point: a bulk upload of "room,guests" lines
export function importCsv(lines: string[], saved: Booking[]): string[] {
  const refused: string[] = [];
  for (const line of lines) {
    const [room = '', guests = ''] = line.split(',');
    saved.push({ room, guests: Number(guests) });
  }
  return refused;
}
