import { feesDue } from './solution';

const now = Date.parse('2026-03-10T12:00:00Z');
const loan = (id: string, due: string, returned: string | null = null) => ({
  id,
  dueAt: Date.parse(due),
  returnedAt: returned === null ? null : Date.parse(returned),
});

test('charges nothing before the due date', () => {
  expect(feesDue([loan('a', '2026-03-12T12:00:00Z')], now)).toEqual([]);
});

test('charges 50 pence per full day late', () => {
  expect(feesDue([loan('a', '2026-03-07T12:00:00Z')], now)).toEqual([{ id: 'a', fee: 150 }]);
});

test('ignores a part day', () => {
  expect(feesDue([loan('a', '2026-03-08T00:00:00Z')], now)).toEqual([{ id: 'a', fee: 100 }]);
});

test('caps the fee at 1000 pence', () => {
  expect(feesDue([loan('a', '2026-01-01T12:00:00Z')], now)).toEqual([{ id: 'a', fee: 1000 }]);
});

test('skips returned loans', () => {
  const returned = loan('a', '2026-03-01T12:00:00Z', '2026-03-02T12:00:00Z');
  expect(feesDue([returned], now)).toEqual([]);
});

test('leaves its input unchanged and gives the same answer twice', () => {
  const loans = [loan('a', '2026-03-07T12:00:00Z'), loan('b', '2026-03-20T12:00:00Z')];
  const before = JSON.stringify(loans);
  const first = feesDue(loans, now);
  expect(feesDue(loans, now)).toEqual(first);
  expect(JSON.stringify(loans)).toBe(before);
});
