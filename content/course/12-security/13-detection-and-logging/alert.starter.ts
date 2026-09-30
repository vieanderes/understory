export interface Event {
  type: string;
  user: string;
  at: number;
}

export function accountsToAlert(events: Event[], threshold: number, windowMs: number, now: number): string[] {
  // Replace this. It alerts on nobody, so a brute-force attack goes unnoticed.
  return [];
}
