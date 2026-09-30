export type RecoveryPoint = { restoreTo: number; lostMinutes: number };

// All times are minutes on one clock. WAL only helps from a base backup onwards.
export function recoveryPoint(
  backupTimes: number[],
  walArchivedTo: number,
  failureAt: number,
): RecoveryPoint | null {
  let base = -1;
  for (const time of backupTimes) {
    if (time <= failureAt && time > base) base = time;
  }
  if (base === -1) return null;
  let restoreTo = base;
  if (walArchivedTo > base) restoreTo = Math.min(walArchivedTo, failureAt);
  return { restoreTo, lostMinutes: failureAt - restoreTo };
}
