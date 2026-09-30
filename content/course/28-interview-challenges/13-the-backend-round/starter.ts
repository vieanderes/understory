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

export function createHandler(store: Store): (req: Req) => Promise<Res> {
  return async (req) => {
    // POST /bookings: replay a known idempotency key, validate, store, answer 201.
    // GET /bookings: check limit and after, return { items, nextCursor }.
    if (req.method === 'POST') {
      const booking = { id: store.bookings.length + 1, ...(req.body as object) } as Booking;
      store.bookings.push(booking);
      return json(201, booking);
    }
    return problem(404, 'Not found', `No route for ${req.path}.`);
  };
}
