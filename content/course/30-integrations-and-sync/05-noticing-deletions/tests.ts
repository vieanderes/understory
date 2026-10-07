import { planSweep, type StaffRow } from './solution';

function staff(count: number, lastSeenRun: number, prefix = 's'): StaffRow[] {
  return Array.from({ length: count }, (_, i) => ({ remoteId: `${prefix}-${i}`, lastSeenRun, deletedAt: null }));
}

test('people this run did not see are swept', () => {
  const rows = [...staff(19, 42), { remoteId: 'gone', lastSeenRun: 41, deletedAt: null }];
  expect(planSweep(rows, 42, true)).toEqual({ action: 'sweep', remoteIds: ['gone'] });
});

test('rows already soft-deleted are neither swept again nor counted', () => {
  const rows = [
    ...staff(10, 42),
    { remoteId: 'left-in-may', lastSeenRun: 30, deletedAt: '2026-05-02T02:00:00Z' },
    { remoteId: 'left-today', lastSeenRun: 41, deletedAt: null },
  ];
  expect(planSweep(rows, 42, true)).toEqual({ action: 'sweep', remoteIds: ['left-today'] });
});

test('3,000 staff suddenly missing aborts the sweep', () => {
  expect(planSweep(staff(3000, 41), 42, true)).toEqual({ action: 'abort', reason: 'too-many', wouldDelete: 3000 });
});

test('a pass that stopped early aborts, even for one missing person', () => {
  const rows = [...staff(99, 42), { remoteId: 'unseen', lastSeenRun: 41, deletedAt: null }];
  expect(planSweep(rows, 42, false)).toEqual({ action: 'abort', reason: 'incomplete-pass', wouldDelete: 1 });
});

test('exactly the allowed share is still swept', () => {
  const rows = [...staff(90, 42, 'here'), ...staff(10, 41, 'left')];
  const plan = planSweep(rows, 42, true, 0.1);
  expect(plan.action).toBe('sweep');
  expect(plan.action === 'sweep' ? plan.remoteIds.length : -1).toBe(10);
});

test('nothing missing means an empty sweep', () => {
  expect(planSweep(staff(5, 42), 42, true)).toEqual({ action: 'sweep', remoteIds: [] });
});
