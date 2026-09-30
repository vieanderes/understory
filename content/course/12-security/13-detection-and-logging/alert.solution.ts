export interface Event {
  type: string;
  user: string;
  at: number;
}

export function accountsToAlert(events: Event[], threshold: number, windowMs: number, now: number): string[] {
  const counts: Record<string, number> = {};
  const order: string[] = [];
  for (const event of events) {
    if (event.type !== 'login_failed') continue;
    if (now - event.at > windowMs || event.at > now) continue;
    const seen = counts[event.user] ?? 0;
    if (seen === 0) order.push(event.user);
    counts[event.user] = seen + 1;
  }
  return order.filter((user) => (counts[user] ?? 0) >= threshold);
}
