# Sync protocol and iOS contract

**Status: designed, not built.** Version 1 of Understory is local-first with no login. This
file exists so that nothing in version 1 blocks sync or the native iOS app.

## Events

- Events are immutable and carry UUIDv7 ids.
- Envelope: `{id, type, v, at, localDate, deviceId, seq, contentRev, payload}`.
- Merge is a set union by `id`.
- The reducer sorts by `(at, deviceId, seq)`, so it is order-insensitive. Two devices that hold
  the same set of events derive the same state.
- Events record facts only. XP, rank and the weekly run are derived, so a merge cannot
  double-award.
- `review_graded` carries the resulting card state `{due, stability, difficulty, state}`. A
  client never has to replay FSRS, so floating-point differences between TypeScript and Swift
  cannot cause divergence.
- Unknown event types are kept and ignored, so an older client survives a newer one.

## Server table

```sql
events(
  user_id,
  id          primary key,
  device_id,
  seq,
  type,
  v,
  at,
  payload     jsonb,
  server_seq  bigserial
)
```

Row-level security: `user_id = auth.uid()`. The planned host is Supabase/Postgres.

## Endpoints

- `POST /sync/push {events}` is idempotent (`on conflict do nothing`).
- `GET /sync/pull?after=<server_seq>&limit` returns `{events, cursor}`.

## Client state

The client keeps `pullCursor` and `pushedSeq`.

## First login

The device's local log is pushed and adopted. Nothing the learner did before signing in is
lost.

## Clock skew

The server clamps `at` to its receive time plus 5 minutes.

## JSON rules

- Dates are ISO-8601 UTC strings.
- XP is an integer.
- Optional fields are omitted, never `null`.
- The discriminant key is always `type`.

## iOS content contract

- iOS fetches `manifest.json`, then the hashed lesson files under `content/v1/`.
- It decodes with Codable types checked against `contracts/schemas`.
- It runs `harness.v1.js` in JavaScriptCore for JS and TS challenges.
- Markdown is a CommonMark subset with no raw HTML, so `AttributedString` can render it.
- A `lab` step always carries a `fallback` step, so a client without the widget still has a
  lesson.

## iOS reducer

The Swift reducer must pass the same `contracts/fixtures` (events to expected state) that the
TypeScript reducer generated. The `ios/UnderstoryKit` Swift package holds the Codable types and
runs those fixtures under `swift test`.
