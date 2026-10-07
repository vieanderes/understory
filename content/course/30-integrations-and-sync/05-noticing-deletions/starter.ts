export interface StaffRow {
  remoteId: string; // the HR system's id, unique per connection
  lastSeenRun: number; // the last full sync that saw this person
  deletedAt: string | null; // set by a sweep: a soft delete
}

export type SweepPlan =
  | { action: 'sweep'; remoteIds: string[] }
  | { action: 'abort'; reason: 'incomplete-pass' | 'too-many'; wouldDelete: number };

export function planSweep(rows: StaffRow[], runId: number, passComplete: boolean, maxShare = 0.1): SweepPlan {
  // Sweeps whatever this run didn't see, however much that is.
  const unseen = rows.filter((row) => row.lastSeenRun < runId);
  return { action: 'sweep', remoteIds: unseen.map((row) => row.remoteId) };
}
