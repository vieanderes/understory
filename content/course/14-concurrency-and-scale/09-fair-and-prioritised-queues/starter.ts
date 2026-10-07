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
  // One queue in arrival order: the first tenant with jobs always wins.
  for (const tenant of s.tenants) {
    const job = s.queues[tenant]?.shift();
    if (job) return job;
  }
  return undefined;
}
