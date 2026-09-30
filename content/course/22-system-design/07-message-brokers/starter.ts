export type Payment = { id: string; account: string; amount: number };

// At-least-once delivery: the same message id can arrive more than once.
export function applyOnce(messages: Payment[], processed: Set<string>): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const m of messages) {
    totals[m.account] = (totals[m.account] ?? 0) + m.amount;
  }
  return totals;
}
