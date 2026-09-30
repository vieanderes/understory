import { dayView, exportDay, scopedTo, type Appointment } from './solution';

const all: Appointment[] = [
  { tenantId: 1, patient: 'R. Patel', day: '2026-10-01' },
  { tenantId: 1, patient: 'J. Okafor', day: '2026-10-02' },
  { tenantId: 2, patient: 'M. Silva', day: '2026-10-01' },
  { tenantId: 2, patient: 'T. Nowak', day: '2026-10-03' },
];

test('the scoped store sees one clinic only', () => {
  expect(scopedTo(all, 1).onDay('2026-10-01')).toEqual([
    { tenantId: 1, patient: 'R. Patel', day: '2026-10-01' },
  ]);
});

test('the day view works as before', () => {
  expect(dayView(scopedTo(all, 1), '2026-10-01')).toEqual(['R. Patel']);
  expect(dayView(scopedTo(all, 2), '2026-10-01')).toEqual(['M. Silva']);
});

test('the export no longer leaks another clinic', () => {
  expect(exportDay(scopedTo(all, 1), '2026-10-01')).toBe('R. Patel,2026-10-01');
});

test('the views read only through the store they are given', () => {
  const store = { onDay: () => [{ tenantId: 9, patient: 'A. Test', day: '2026-12-24' }] };
  expect(dayView(store, 'any day')).toEqual(['A. Test']);
  expect(exportDay(store, 'any day')).toBe('A. Test,2026-12-24');
});

test('rows added later are still scoped', () => {
  const rows: Appointment[] = [];
  const store = scopedTo(rows, 1);
  rows.push({ tenantId: 2, patient: 'M. Silva', day: '2026-10-05' });
  rows.push({ tenantId: 1, patient: 'R. Patel', day: '2026-10-05' });
  expect(dayView(store, '2026-10-05')).toEqual(['R. Patel']);
});
