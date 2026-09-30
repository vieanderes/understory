export type Loan = { id: string; dueDay: number; renewals: number };
export type RenewResult = { ok: true; dueDay: number } | { ok: false; reason: string };

// The port: everything renewLoan may know about storage.
export interface LoanStore {
  find(id: string): Loan | undefined;
  save(loan: Loan): void;
}

// The store is handed in, so the caller picks the adapter: Postgres in production, memory in tests.
export function renewLoan(loanId: string, today: number, loans: LoanStore): RenewResult {
  const loan = loans.find(loanId);
  if (loan === undefined) return { ok: false, reason: 'no such loan' };
  if (today > loan.dueDay) return { ok: false, reason: 'overdue' };
  if (loan.renewals >= 2) return { ok: false, reason: 'renewal limit reached' };
  const renewed = { ...loan, dueDay: loan.dueDay + 14, renewals: loan.renewals + 1 };
  loans.save(renewed);
  return { ok: true, dueDay: renewed.dueDay };
}

// An in-memory adapter for the port, for tests and demos.
export function memoryLoans(rows: Loan[]): LoanStore {
  const table = new Map<string, Loan>();
  for (const row of rows) table.set(row.id, row);
  return {
    find: (id) => table.get(id),
    save: (loan) => {
      table.set(loan.id, loan);
    },
  };
}
