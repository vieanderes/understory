import { createHash, randomUUID } from 'node:crypto';
import { Hono, type Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { z } from 'zod';

export interface Booking {
  id: string;
  roomId: string;
  start: string;
  end: string;
  bookedBy: string;
  createdAt: string;
}

export interface AppDeps {
  now?: () => Date;
  newId?: () => string;
}

const isValidDate = (value: unknown) =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value));

const bookingInput = z
  .object({
    roomId: z.string().trim().min(1),
    start: z.iso.datetime({ offset: true }),
    end: z.iso.datetime({ offset: true }),
    bookedBy: z.string().trim().min(1).max(100),
  })
  // zod still runs this check when a field above failed. Skip it then, so a bad start is
  // reported once, as a bad start, and not also as an end that comes too early.
  .refine(
    (b) => !isValidDate(b.start) || !isValidDate(b.end) || Date.parse(b.end) > Date.parse(b.start),
    {
      path: ['end'],
      message: 'end must be after start',
    },
  );

const listQuery = z.object({
  roomId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

interface Problem {
  type?: string;
  title: string;
  status: number;
  detail?: string;
  errors?: Array<{ path: string; message: string }>;
}

function problem(c: Context, body: Problem): Response {
  return c.body(
    JSON.stringify({ type: 'about:blank', ...body }),
    body.status as ContentfulStatusCode,
    {
      'Content-Type': 'application/problem+json',
    },
  );
}

function validationProblem(c: Context, error: z.ZodError): Response {
  return problem(c, {
    title: 'Invalid request',
    status: 400,
    errors: error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
  });
}

// The cursor encodes a position in creation order. Base64url keeps it opaque, so clients
// do not start doing arithmetic on it and we can change the encoding later.
const encodeCursor = (seq: number) => Buffer.from(String(seq)).toString('base64url');
function decodeCursor(cursor: string): number | undefined {
  const seq = Number(Buffer.from(cursor, 'base64url').toString());
  return Number.isInteger(seq) && seq >= 0 ? seq : undefined;
}

interface StoredResponse {
  bodyHash: string;
  status: number;
  body: unknown;
  headers: Record<string, string>;
}

export function createApp({ now = () => new Date(), newId = randomUUID }: AppDeps = {}): Hono {
  const app = new Hono();
  const bookings: Booking[] = [];
  const byId = new Map<string, Booking>();
  const idempotency = new Map<string, StoredResponse>();

  app.post('/bookings', async (c) => {
    let raw: unknown;
    try {
      raw = await c.req.json();
    } catch {
      return problem(c, {
        title: 'Malformed JSON',
        status: 400,
        detail: 'The body is not valid JSON.',
      });
    }

    const key = c.req.header('Idempotency-Key');
    const bodyHash = createHash('sha256').update(JSON.stringify(raw)).digest('hex');
    if (key) {
      const stored = idempotency.get(key);
      if (stored && stored.bodyHash !== bodyHash) {
        return problem(c, {
          title: 'Idempotency key reused',
          status: 422,
          detail: 'This Idempotency-Key was already used with a different request body.',
        });
      }
      if (stored) {
        return c.json(stored.body, stored.status as ContentfulStatusCode, {
          ...stored.headers,
          'Idempotent-Replayed': 'true',
        });
      }
    }

    const parsed = bookingInput.safeParse(raw);
    if (!parsed.success) return validationProblem(c, parsed.error);
    const input = parsed.data;

    const start = Date.parse(input.start);
    const end = Date.parse(input.end);
    // Half-open intervals: a booking ending at 10:00 and one starting at 10:00 do not clash.
    const clash = bookings.find(
      (b) => b.roomId === input.roomId && Date.parse(b.start) < end && start < Date.parse(b.end),
    );
    if (clash) {
      return problem(c, {
        title: 'Booking conflict',
        status: 409,
        detail: `Room ${input.roomId} is already booked from ${clash.start} to ${clash.end}.`,
      });
    }

    const booking: Booking = { id: newId(), ...input, createdAt: now().toISOString() };
    bookings.push(booking);
    byId.set(booking.id, booking);

    const headers = { Location: `/bookings/${booking.id}` };
    // Only successful creates are stored. Replaying a stored 409 would hide a room that
    // has since become free; a real system would decide this explicitly.
    if (key) idempotency.set(key, { bodyHash, status: 201, body: booking, headers });
    return c.json(booking, 201, headers);
  });

  app.get('/bookings/:id', (c) => {
    const booking = byId.get(c.req.param('id'));
    if (!booking) {
      return problem(c, { title: 'Not found', status: 404, detail: 'No booking with that id.' });
    }
    return c.json(booking);
  });

  app.get('/bookings', (c) => {
    const parsed = listQuery.safeParse(c.req.query());
    if (!parsed.success) return validationProblem(c, parsed.error);
    const { roomId, limit, cursor } = parsed.data;

    let from = 0;
    if (cursor !== undefined) {
      const seq = decodeCursor(cursor);
      if (seq === undefined) {
        return problem(c, {
          title: 'Invalid request',
          status: 400,
          detail: 'The cursor is not valid.',
        });
      }
      from = seq;
    }

    // The store is append-only, so the index in `bookings` is a stable sequence number.
    const items: Booking[] = [];
    let index = from;
    for (; index < bookings.length && items.length < limit; index += 1) {
      const booking = bookings[index]!;
      if (!roomId || booking.roomId === roomId) items.push(booking);
    }
    const more = bookings.slice(index).some((b) => !roomId || b.roomId === roomId);
    return c.json({ items, nextCursor: more ? encodeCursor(index) : null });
  });

  app.notFound((c) => problem(c, { title: 'Not found', status: 404, detail: 'No such route.' }));
  app.onError((error, c) => {
    console.error(error);
    return problem(c, { title: 'Internal error', status: 500 });
  });

  return app;
}
