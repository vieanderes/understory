// Times are milliseconds, like the numbers Date.now() gives.
export interface Loan {
  id: string;
  dueAt: number;
  returnedAt: number | null;
}

const MS_PER_DAY = 86_400_000;
const FEE_PER_DAY_PENCE = 50;
const MAX_FEE_PENCE = 1000;

// The pure core: the same loans and the same `now` always give the same fees.
export function feesDue(loans: Loan[], now: number): { id: string; fee: number }[] {
  const results = [];
  for (const loan of loans) {
    if (loan.returnedAt !== null) continue;
    const days = Math.floor((now - loan.dueAt) / MS_PER_DAY);
    if (days > 0) {
      results.push({ id: loan.id, fee: Math.min(days * FEE_PER_DAY_PENCE, MAX_FEE_PENCE) });
    }
  }
  return results;
}

// The shell: the only place that reads the clock.
export function overdueFees(loans: Loan[]): { id: string; fee: number }[] {
  return feesDue(loans, Date.now());
}
