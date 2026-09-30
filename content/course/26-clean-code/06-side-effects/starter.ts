// Times are milliseconds, like the numbers Date.now() gives.
export interface Loan {
  id: string;
  dueAt: number;
  returnedAt: number | null;
}

const MS_PER_DAY = 86_400_000;

// Reads the clock itself, so nobody can pin "today" to check it. Split out a pure core.
export function overdueFees(loans: Loan[]): { id: string; fee: number }[] {
  const results = [];
  for (const loan of loans) {
    if (loan.returnedAt !== null) continue;
    const days = Math.floor((Date.now() - loan.dueAt) / MS_PER_DAY);
    if (days > 0) results.push({ id: loan.id, fee: Math.min(days * 50, 1000) });
  }
  return results;
}
