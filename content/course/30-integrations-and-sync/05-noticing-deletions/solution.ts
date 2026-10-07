export interface StaffRow {
  remoteId: string; // the HR system's id, unique per connection
  lastSeenRun: number; // the last full sync that saw this person
  deletedAt: string | null; // set by a sweep: a soft delete
}

export type SweepPlan =
  | { action: 'sweep'; remoteIds: string[] }
  | { action: 'abort'; reason: 'incomplete-pass' | 'too-many'; wouldDelete: number };

export function planSweep(rows: StaffRow[], runId: number, passComplete: boolean, maxShare = 0.1): SweepPlan {
  const active = rows.filter((row) => row.deletedAt === null);
  const unseen = active.filter((row) => row.lastSeenRun < runId);
  // A pass that stopped halfway hasn't seen everyone, so absence proves nothing.
  if (!passComplete) return { action: 'abort', reason: 'incomplete-pass', wouldDelete: unseen.length };
  // A big drop is far more often a permissions change than real departures.
  if (unseen.length > active.length * maxShare) {
    return { action: 'abort', reason: 'too-many', wouldDelete: unseen.length };
  }
  return { action: 'sweep', remoteIds: unseen.map((row) => row.remoteId) };
}
