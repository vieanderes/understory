import { sweep, type Rule, type StoredRecord } from './solution';

const policy: Record<string, Rule> = {
  'door-log': { keepDays: 30, requiredByLaw: false, afterwards: 'delete' },
  'injury-note': { keepDays: 180, requiredByLaw: false, afterwards: 'delete' },
  booking: { keepDays: 365, requiredByLaw: false, afterwards: 'anonymise' },
  payment: { keepDays: 3650, requiredByLaw: true, afterwards: 'delete' },
};

const today = '2026-10-01';
const rec = (id: string, kind: string, memberId: string, createdAt: string, legalHold?: boolean): StoredRecord =>
  legalHold ? { id, kind, memberId, createdAt, legalHold } : { id, kind, memberId, createdAt };

test('deletes a door log past 30 days and keeps a recent one', () => {
  const result = sweep([rec('d1', 'door-log', 'm1', '2026-08-01'), rec('d2', 'door-log', 'm1', '2026-09-20')], policy, [], today);
  expect(result).toEqual([
    { id: 'd1', action: 'delete' },
    { id: 'd2', action: 'keep' },
  ]);
});

test('a record exactly keepDays old has expired', () => {
  expect(sweep([rec('d1', 'door-log', 'm1', '2026-09-01')], policy, [], today)).toEqual([{ id: 'd1', action: 'delete' }]);
});

test('an old booking is anonymised, not deleted', () => {
  expect(sweep([rec('b1', 'booking', 'm1', '2025-06-01')], policy, [], today)).toEqual([{ id: 'b1', action: 'anonymise' }]);
});

test('an erasure request clears early what the law does not require, and keeps payments', () => {
  const records = [
    rec('n1', 'injury-note', 'm1', '2026-09-01'),
    rec('b1', 'booking', 'm1', '2026-09-02'),
    rec('p1', 'payment', 'm1', '2026-09-02'),
  ];
  expect(sweep(records, policy, ['m1'], today)).toEqual([
    { id: 'n1', action: 'delete' },
    { id: 'b1', action: 'anonymise' },
    { id: 'p1', action: 'keep' },
  ]);
});

test("another member's records are untouched by someone else's request", () => {
  expect(sweep([rec('n2', 'injury-note', 'm2', '2026-09-01')], policy, ['m1'], today)).toEqual([{ id: 'n2', action: 'keep' }]);
});

test('a legal hold beats both expiry and erasure', () => {
  const records = [rec('d1', 'door-log', 'm1', '2026-01-01', true), rec('n1', 'injury-note', 'm1', '2026-09-01', true)];
  expect(sweep(records, policy, ['m1'], today)).toEqual([
    { id: 'd1', action: 'keep' },
    { id: 'n1', action: 'keep' },
  ]);
});

test('a kind with no rule throws', () => {
  expect(() => sweep([rec('x1', 'body-scan', 'm1', '2026-09-01')], policy, [], today)).toThrow('body-scan');
});
