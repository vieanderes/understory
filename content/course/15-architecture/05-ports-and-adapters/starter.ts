export type Loan = { id: string; dueDay: number; renewals: number };
export type RenewResult = { ok: true; dueDay: number } | { ok: false; reason: string };

// The port: everything renewLoan may know about storage.
export interface LoanStore {
  find(id: string): Loan | undefined;
  save(loan: Loan): void;
}

// Today the rule reaches straight into this module's own table.
const table = new Map<string, Loan>();

export function renewLoan(loanId: string, today: number): RenewResult {
  const loan = table.get(loanId);
  if (loan === undefined) return { ok: false, reason: 'no such loan' };
  if (today > loan.dueDay) return { ok: false, reason: 'overdue' };
  if (loan.renewals >= 2) return { ok: false, reason: 'renewal limit reached' };
  const renewed = { ...loan, dueDay: loan.dueDay + 14, renewals: loan.renewals + 1 };
  table.set(loan.id, renewed);
  return { ok: true, dueDay: renewed.dueDay };
}

// An in-memory adapter for the port, for tests and demos.
export function memoryLoans(rows: Loan[]): LoanStore {
  throw new Error(`write the adapter for ${rows.length} loans`);
}
