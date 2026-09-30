export type RecoveryPoint = { restoreTo: number; lostMinutes: number };

export function recoveryPoint(
  backupTimes: number[],
  walArchivedTo: number,
  failureAt: number,
): RecoveryPoint | null {
  // Find the newest base backup before the failure, then see how far the WAL carries you.
  return { restoreTo: walArchivedTo, lostMinutes: failureAt - backupTimes.length };
}
