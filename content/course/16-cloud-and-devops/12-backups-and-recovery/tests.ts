import { recoveryPoint } from './solution';

test('a nightly backup alone loses everything since it ran', () => {
  expect(recoveryPoint([120], 0, 990)).toEqual({ restoreTo: 120, lostMinutes: 870 });
});

test('archived WAL carries the restore forward from the backup', () => {
  expect(recoveryPoint([120], 985, 990)).toEqual({ restoreTo: 985, lostMinutes: 5 });
});

test('WAL archived past the failure still stops at the failure', () => {
  expect(recoveryPoint([120], 2000, 990)).toEqual({ restoreTo: 990, lostMinutes: 0 });
});

test('the newest backup before the failure is the base, whatever the order', () => {
  expect(recoveryPoint([1560, 120, 3000], 0, 2000)).toEqual({ restoreTo: 1560, lostMinutes: 440 });
});

test('no backup before the failure means nothing to restore', () => {
  expect(recoveryPoint([3000], 5000, 990)).toBe(null);
  expect(recoveryPoint([], 985, 990)).toBe(null);
});

test('WAL that ends before the base backup adds nothing', () => {
  expect(recoveryPoint([1560], 900, 2000)).toEqual({ restoreTo: 1560, lostMinutes: 440 });
});
