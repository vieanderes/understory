import { can } from './solution';

const ana = { id: 1, role: 'customer' as const };
const staff = { id: 9, role: 'staff' as const };
const admin = { id: 10, role: 'admin' as const };
const anasOrder = { id: 6, ownerId: 1 };
const bensOrder = { id: 7, ownerId: 2 };

test('a customer may read their own order', () => {
  expect(can(ana, 'read', anasOrder)).toBe(true);
});

test('a customer may not read someone else\'s order', () => {
  expect(can(ana, 'read', bensOrder)).toBe(false);
});

test('staff may read any order', () => {
  expect(can(staff, 'read', bensOrder)).toBe(true);
});

test('an action nobody granted is denied', () => {
  expect(can(ana, 'delete', anasOrder)).toBe(false);
  expect(can(staff, 'delete', bensOrder)).toBe(false);
});

test('a permission with :own never covers another owner', () => {
  expect(can(ana, 'cancel', anasOrder)).toBe(true);
  expect(can(ana, 'cancel', bensOrder)).toBe(false);
});

test('an unknown action is denied, not thrown', () => {
  expect(can(admin, 'teleport', anasOrder)).toBe(false);
});
