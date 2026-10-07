export type Priority = 'high' | 'low';

export interface Job {
  id: string;
  priority: Priority;
  enqueuedAt: number; // ms
}

export interface Scheduler {
  tenants: string[]; // the round-robin order
  queues: Record<string, Job[]>; // each tenant's jobs, oldest first
  running: Record<string, number>; // jobs in progress per tenant
  cursor: number; // index in tenants of who goes next
  maxRunningPerTenant: number;
  maxWaitMs: number; // a low job this old counts as high
}

export function pickNext(s: Scheduler, now: number): Job | undefined {
  const urgent = (job: Job) => job.priority === 'high' || now - job.enqueuedAt >= s.maxWaitMs;
  // First pass looks only for urgent work; the second takes anything.
  for (const onlyUrgent of [true, false]) {
    for (let i = 0; i < s.tenants.length; i++) {
      const index = (s.cursor + i) % s.tenants.length;
      const tenant = s.tenants[index]!;
      // A tenant at its cap waits, however much it has queued.
      if ((s.running[tenant] ?? 0) >= s.maxRunningPerTenant) continue;
      const queue = s.queues[tenant] ?? [];
      const at = onlyUrgent ? queue.findIndex(urgent) : queue.length > 0 ? 0 : -1;
      if (at === -1) continue;
      const job = queue.splice(at, 1)[0]!;
      s.running[tenant] = (s.running[tenant] ?? 0) + 1;
      s.cursor = (index + 1) % s.tenants.length;
      return job;
    }
  }
  return undefined;
}
