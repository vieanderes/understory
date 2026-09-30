import { renewLoan, memoryLoans, type Loan, type LoanStore } from './solution';

// A second adapter, written by the test: it records every save.
function recordingLoans(rows: Loan[]): LoanStore & { saved: Loan[] } {
  const saved: Loan[] = [];
  return {
    saved,
    find: (id) => rows.find((row) => row.id === id),
    save: (loan) => {
      saved.push(loan);
    },
  };
}

test('a loan in good standing gets 14 more days', () => {
  const loans = memoryLoans([{ id: 'l1', dueDay: 100, renewals: 0 }]);
  expect(renewLoan('l1', 95, loans)).toEqual({ ok: true, dueDay: 114 });
});

test('the memory adapter keeps what was saved', () => {
  const loans = memoryLoans([{ id: 'l1', dueDay: 100, renewals: 0 }]);
  renewLoan('l1', 95, loans);
  expect(loans.find('l1')).toEqual({ id: 'l1', dueDay: 114, renewals: 1 });
  expect(loans.find('nope')).toBeUndefined();
});

test('renewLoan uses whichever adapter it is given', () => {
  const loans = recordingLoans([{ id: 'l1', dueDay: 100, renewals: 1 }]);
  renewLoan('l1', 100, loans);
  expect(loans.saved).toEqual([{ id: 'l1', dueDay: 114, renewals: 2 }]);
});

test('the refusals still work, and save nothing', () => {
  const loans = recordingLoans([
    { id: 'late', dueDay: 100, renewals: 0 },
    { id: 'max', dueDay: 100, renewals: 2 },
  ]);
  expect(renewLoan('late', 101, loans)).toEqual({ ok: false, reason: 'overdue' });
  expect(renewLoan('max', 90, loans)).toEqual({ ok: false, reason: 'renewal limit reached' });
  expect(renewLoan('nope', 1, loans)).toEqual({ ok: false, reason: 'no such loan' });
  expect(loans.saved).toHaveLength(0);
});

test('the stored loan object is not changed in place', () => {
  const original = { id: 'l1', dueDay: 100, renewals: 0 };
  renewLoan('l1', 95, memoryLoans([original]));
  expect(original).toEqual({ id: 'l1', dueDay: 100, renewals: 0 });
});
