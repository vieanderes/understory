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

  // Acknowledged before the work, and a failure is never handled.
  queue.done.push(job.id);
  await handler(job);
  return 'done';
}
