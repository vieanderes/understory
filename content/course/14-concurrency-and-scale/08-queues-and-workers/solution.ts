export interface Job {
  id: string;
  attempts: number; // failed attempts so far
  runAt: number; // not before this time, in ms
}

export interface Queue {
  waiting: Job[];
  done: string[]; // ids of acknowledged jobs
  dead: Job[]; // the dead-letter queue
  maxAttempts: number;
  baseDelayMs: number;
}

export type Outcome = 'idle' | 'done' | 'retry' | 'dead';

export async function processNext(
  queue: Queue,
  handler: (job: Job) => Promise<void>,
  now: number,
): Promise<Outcome> {
  const index = queue.waiting.findIndex((job) => job.runAt <= now);
  if (index === -1) return 'idle';
  const job = queue.waiting.splice(index, 1)[0]!;

  try {
    await handler(job);
  } catch {
    job.attempts += 1;
    if (job.attempts >= queue.maxAttempts) {
      queue.dead.push(job);
      return 'dead';
    }
    // The wait doubles after each failure: base, twice the base, four times...
    job.runAt = now + queue.baseDelayMs * 2 ** (job.attempts - 1);
    queue.waiting.push(job);
    return 'retry';
  }
  // Acknowledged only once the work has finished.
  queue.done.push(job.id);
  return 'done';
}
