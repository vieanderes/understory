# Promise pool

Format: live coding, 30 to 45 minutes. TypeScript.

## The prompt

"We need to call an API for 5,000 records but it allows only a few requests at a time.
Write a helper that runs async tasks with a concurrency limit and gives back the results in
the same order as the input. Then: sometimes one failure should stop the whole batch, and
sometimes we want every result, good or bad."

## The contract

Implement `runPool` in `src/pool.ts`:

- `runPool(tasks, { concurrency })` behaves like `Promise.all`: resolves with the values in
  input order, or rejects with the first error. This is fail fast, the default.
- `runPool(tasks, { concurrency, failFast: false })` behaves like `Promise.allSettled`:
  resolves with `{ status, value }` or `{ status, reason }` for every task, in input order.
- A task is a function `(signal: AbortSignal) => Promise<T>`. It is not started until a slot
  is free, and never more than `concurrency` run at once.
- On fail fast, start no new tasks after the first failure and abort the signal given to
  tasks still running.
- `concurrency` must be a positive integer, otherwise throw a `RangeError` synchronously.
- A task that throws synchronously counts as a rejection, not a crash.

## Constraints

- No libraries. `Promise.all` over the whole list is not a pool.
- O(n) overall. Do not `shift()` a queue in a loop; keep an index.

## What the interviewer looks for

- Why tasks are functions and not promises: a promise has already started.
- A clear worker model: N workers pulling the next index, or a scheduler that starts a task
  each time one settles. Either is fine if you can say why.
- Order kept by writing into `results[index]`, not by `push`.
- Empty input resolves immediately. Concurrency larger than the list is fine.
- Extension talk: per-task timeout, retries, progress callbacks, a pool that accepts tasks
  over time (a queue with `add`), and backpressure.

Run: `pnpm kata promise-pool`. Reference: `pnpm kata promise-pool --solution`.
