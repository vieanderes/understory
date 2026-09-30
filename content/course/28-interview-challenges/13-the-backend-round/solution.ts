export type Req = {
  method: string;
  path: string;
  query: Record<string, string>;
  headers: Record<string, string>; // names are lower case
  body: unknown;
};
export type Res = { status: number; headers: Record<string, string>; body: unknown };
export type Booking = { id: number; room: string; date: string; guests: number };
export type Store = { bookings: Booking[]; responses: Map<string, Res> };

// Every failure leaves through this one function, so clients parse a single error shape.
function problem(status: number, title: string, detail: string): Res {
  return {
    status,
    headers: { 'content-type': 'application/problem+json' },
    body: { type: 'about:blank', title, status, detail },
  };
}

function json(status: number, body: unknown): Res {
  return { status, headers: { 'content-type': 'application/json' }, body };
}

// Returns the first thing wrong with the body, or null when it is a valid booking.
function invalidBooking(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) return 'The body must be a JSON object.';
  const { room, date, guests } = body as Record<string, unknown>;
  if (typeof room !== 'string' || room.trim() === '') return 'room must be a non-empty string.';
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'date must be YYYY-MM-DD.';
  if (!Number.isInteger(guests) || (guests as number) < 1 || (guests as number) > 20) {
    return 'guests must be a whole number from 1 to 20.';
  }
  return null;
}

// A positive whole number written in digits, or null.
function positiveInt(text: string): number | null {
  return /^[1-9]\d*$/.test(text) ? Number(text) : null;
}

function create(store: Store, req: Req): Res {
  const key = req.headers['idempotency-key'];
  const earlier = key === undefined ? undefined : store.responses.get(key);
  if (earlier !== undefined) return earlier;

  const detail = invalidBooking(req.body);
  if (detail !== null) return problem(400, 'Invalid request', detail);

  const { room, date, guests } = req.body as Booking;
  const booking: Booking = { id: store.bookings.length + 1, room, date, guests };
  store.bookings.push(booking);
  const res = json(201, booking);
  if (key !== undefined) store.responses.set(key, res);
  return res;
}

function list(store: Store, req: Req): Res {
  const limit = positiveInt(req.query.limit ?? '10');
  if (limit === null || limit > 100) {
    return problem(400, 'Invalid request', 'limit must be a whole number from 1 to 100.');
  }
  let after = 0;
  if (req.query.after !== undefined) {
    const cursor = positiveInt(req.query.after);
    if (cursor === null) return problem(400, 'Invalid request', 'after must be a cursor from nextCursor.');
    after = cursor;
  }
  const rest = store.bookings.filter((booking) => booking.id > after);
  const items = rest.slice(0, limit);
  const last = items.at(-1);
  const nextCursor = rest.length > limit && last !== undefined ? String(last.id) : null;
  return json(200, { items, nextCursor });
}

export function createHandler(store: Store): (req: Req) => Promise<Res> {
  return async (req) => {
    if (req.path !== '/bookings') return problem(404, 'Not found', `No route for ${req.path}.`);
    if (req.method === 'POST') return create(store, req);
    if (req.method === 'GET') return list(store, req);
    return problem(405, 'Method not allowed', `${req.method} is not allowed on /bookings.`);
  };
}
