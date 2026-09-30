# Bookings API

Format: live coding or a short take-home, 60 to 90 minutes. TypeScript with Hono and zod.

## The prompt

"Build the API for booking shared rooms. Clients create bookings and list them. Mobile
clients retry on flaky networks, so a retried create must not book twice. Keep errors
consistent so the front end can show them."

## The contract

Implement `createApp(deps?)` in `src/app.ts`. It returns a Hono app. Tests call it with
`app.request(...)`, so no port is opened.

`POST /bookings` with JSON `{ roomId, start, end, bookedBy }`:

- `roomId`: non-empty string. `start`, `end`: ISO 8601 date-times with an offset or `Z`,
  and `end` after `start`. `bookedBy`: 1 to 100 characters.
- 201 with the booking `{ id, roomId, start, end, bookedBy, createdAt }` and a `Location`
  header of `/bookings/<id>`.
- 409 if it overlaps another booking for the same room. Touching ends do not overlap.
- An optional `Idempotency-Key` header. The same key with the same body returns the stored
  response again, status and body, with `Idempotent-Replayed: true`. The same key with a
  different body is a 422.

`GET /bookings/:id`: 200 with the booking, or 404.

`GET /bookings?roomId=&limit=&cursor=`:

- Bookings in creation order, optionally for one room.
- `limit` 1 to 100, default 20. Response `{ items, nextCursor }`; `nextCursor` is `null` on
  the last page. The cursor is opaque to clients.

Every error, including invalid JSON and unknown routes, is `application/problem+json`
(RFC 9457): `{ type, title, status, detail? }`, and for validation errors an `errors` array
of `{ path, message }`.

`deps` may supply `now()` and `newId()` so tests are deterministic.

## Constraints

- In-memory storage behind a small interface is fine. Say what you would use in production.

## What the interviewer looks for

- Validation at the edge with one schema, and errors that name the field.
- Status codes chosen on purpose: 400 vs 422, 404, 409, 201 with `Location`.
- Cursor pagination that stays stable when rows are inserted, unlike offset pagination.
- Idempotency keyed on the key and a hash of the body, stored with the response.
- Talk: the race between two concurrent creates (a unique constraint or an exclusion
  constraint in Postgres), key expiry, auth and per-tenant scoping, rate limiting.

Run: `pnpm kata bookings-api`. Reference: `pnpm kata bookings-api --solution`.
