# Retry with exponential backoff

Format: live coding, 30 to 45 minutes. TypeScript.

## The prompt

"A downstream service sometimes returns 503 or times out. Write a `retry` helper. It should
back off exponentially with jitter so a thousand clients do not retry in lockstep, and the
caller must be able to cancel it."

## The contract

Implement two functions in `src/retry.ts`:

- `backoffDelay(retryNumber, { baseMs, maxMs, factor = 2 }, random)` returns the delay
  before retry number `retryNumber` (1 for the first retry). Full jitter:
  `floor(random() * min(maxMs, baseMs * factor ** (retryNumber - 1)))`.
- `retry(fn, options)` calls `fn(attempt, signal)` (attempt starts at 1) until it resolves.
  - `retries` is how many extra attempts after the first. When they are used up, reject
    with the last error.
  - `shouldRetry(error, attempt)` decides whether an error is worth retrying. Default: yes.
    When it says no, reject at once with that error.
  - Before each retry, call `onRetry({ attempt, delayMs, error })` if given, then
    `await sleep(delayMs, signal)`.
  - `signal`: if already aborted, reject with `signal.reason` without calling `fn`. If it
    aborts while waiting, reject with `signal.reason` and do not call `fn` again.
  - `sleep` defaults to a `setTimeout` promise that rejects when the signal aborts.
    `random` defaults to `Math.random`. Both are injected so tests never wait.

## Constraints

- No libraries. No real waiting in tests.

## What the interviewer looks for

- Why jitter: without it, clients that failed together retry together (thundering herd).
  Full jitter spreads them across the whole window.
- Which errors to retry: 429 and 5xx and network errors, not 400 or 404. Only retry
  idempotent operations, or ones with an idempotency key.
- Honouring `Retry-After` when the server sends it (a good extension).
- Cancellation that cleans up its timer and listener. A leaked timer keeps Node alive.
- A cap on total time as well as attempts, and why retries at several layers multiply.

Run: `pnpm kata retry-backoff`. Reference: `pnpm kata retry-backoff --solution`.
