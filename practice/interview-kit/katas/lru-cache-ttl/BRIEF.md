# LRU cache with TTL

Format: live coding, 45 minutes. TypeScript. An assistant may or may not be allowed; ask.

## The prompt

"Our service calls a slow pricing API. Build an in-memory cache in front of it. It holds at
most `capacity` entries and throws out the least recently used one when full. Each entry
also expires after a time to live, either the cache default or one passed to `set`."

## The contract

Implement `LruCache<K, V>` in `src/lru-cache.ts`:

- `new LruCache({ capacity, defaultTtlMs?, clock? })`. `capacity` is a positive integer,
  otherwise throw a `RangeError`. `defaultTtlMs` defaults to `Infinity`. `clock.now()`
  returns milliseconds and defaults to `Date.now`.
- `get(key)` returns the value, or `undefined` when missing or expired. A hit makes the
  entry the most recently used. An expired entry is removed.
- `set(key, value, { ttlMs }?)` inserts or replaces, and makes the entry the most recently
  used. When full, evict expired entries first, then the least recently used.
- `has(key)` answers without changing recency.
- `delete(key)` returns whether a live entry was removed.
- `size` counts live entries only.

## Constraints

- `get` and `set` in O(1) average time. Evicting expired entries may be amortised.
- No timers. Expiry is checked lazily against the injected clock, so tests never sleep.

## What the interviewer looks for

- You ask whether `has` should refresh recency, and whether expired entries count as full.
- You use a `Map`, which keeps insertion order, and delete then re-insert to mark use. Or
  you explain the doubly linked list plus hash map and why a `Map` is enough here.
- An injected clock, so time is testable. A senior candidate proposes it before being asked.
- Edge cases: capacity 1, replacing an existing key at capacity (no eviction needed),
  a TTL of 0, re-setting an expired key.
- Extension talk: size by bytes rather than count, stale-while-revalidate, and single-flight
  so ten concurrent misses make one upstream call.

Run: `pnpm kata lru-cache-ttl`. Reference: `pnpm kata lru-cache-ttl --solution`.
