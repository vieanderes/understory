import { TxStore } from './solution';

test('set, get, delete and count work outside a transaction', () => {
  const store = new TxStore();
  store.set('room-1', 'booked');
  store.set('room-2', 'booked');
  store.set('room-3', 'free');
  expect(store.get('room-1')).toBe('booked');
  expect(store.count('booked')).toBe(2);
  expect(store.delete('room-1')).toBe(true);
  expect(store.delete('room-1')).toBe(false);
  expect(store.get('room-1')).toBe(undefined);
  expect(store.count('booked')).toBe(1);
  expect(store.count('closed')).toBe(0);
});

test('commit and rollback with nothing open say so', () => {
  const store = new TxStore();
  expect(store.commit()).toBe('NO TRANSACTION');
  expect(store.rollback()).toBe('NO TRANSACTION');
});

test('rollback restores changed, added and deleted keys', () => {
  const store = new TxStore();
  store.set('a', '10');
  store.set('b', '20');
  store.begin();
  store.set('a', '11');
  store.set('a', '12');
  store.set('c', '30');
  store.delete('b');
  expect(store.rollback()).toBe('OK');
  expect(store.get('a')).toBe('10');
  expect(store.get('b')).toBe('20');
  expect(store.get('c')).toBe(undefined);
  expect(store.count('10')).toBe(1);
  expect(store.count('12')).toBe(0);
  expect(store.rollback()).toBe('NO TRANSACTION');
});

test('an inner rollback undoes only the inner changes', () => {
  const store = new TxStore();
  store.begin();
  store.set('seat', 'held');
  store.begin();
  store.set('seat', 'sold');
  expect(store.rollback()).toBe('OK');
  expect(store.get('seat')).toBe('held');
  expect(store.rollback()).toBe('OK');
  expect(store.get('seat')).toBe(undefined);
});

test('an inner commit folds into the outer transaction', () => {
  const store = new TxStore();
  store.set('seat', 'free');
  store.begin();
  store.set('seat', 'held');
  store.begin();
  store.set('seat', 'sold');
  store.set('row', 'b');
  expect(store.commit()).toBe('OK');
  expect(store.get('seat')).toBe('sold');
  expect(store.rollback()).toBe('OK');
  expect(store.get('seat')).toBe('free');
  expect(store.get('row')).toBe(undefined);
});

test('a committed transaction stays after the last commit', () => {
  const store = new TxStore();
  store.begin();
  store.set('seat', 'sold');
  expect(store.commit()).toBe('OK');
  expect(store.rollback()).toBe('NO TRANSACTION');
  expect(store.get('seat')).toBe('sold');
  expect(store.count('sold')).toBe(1);
});

test('large: 100,000 writes and 100,000 counts stay fast', () => {
  const store = new TxStore();
  store.begin();
  for (let i = 0; i < 100000; i++) store.set(`key-${i}`, `v${i % 10}`);
  let total = 0;
  for (let i = 0; i < 100000; i++) total += store.count(`v${i % 10}`);
  expect(total).toBe(1000000000);
  expect(store.rollback()).toBe('OK');
  expect(store.count('v3')).toBe(0);
});
