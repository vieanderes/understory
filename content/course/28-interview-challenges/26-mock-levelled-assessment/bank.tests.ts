import { Bank } from './bank.solution';

test('level 1: the example from the statement', () => {
  const bank = new Bank();
  expect(bank.createAccount(1, 'acc1')).toBe(true);
  expect(bank.createAccount(2, 'acc1')).toBe(false);
  expect(bank.createAccount(3, 'acc2')).toBe(true);
  expect(bank.deposit(4, 'acc1', 500)).toBe(500);
  expect(bank.transfer(5, 'acc1', 'acc2', 200)).toBe(300);
  expect(bank.transfer(6, 'acc1', 'acc2', 400)).toBe(null);
});

test('level 2: the example from the statement', () => {
  const bank = new Bank();
  bank.createAccount(1, 'acc1');
  bank.createAccount(2, 'acc2');
  bank.createAccount(3, 'acc3');
  bank.deposit(4, 'acc1', 500);
  bank.deposit(5, 'acc3', 500);
  bank.transfer(6, 'acc1', 'acc2', 100);
  bank.transfer(7, 'acc3', 'acc2', 100);
  expect(bank.topSpenders(8, 2)).toEqual(['acc1(100)', 'acc3(100)']);
});

test('level 3: the example from the statement', () => {
  const bank = new Bank();
  bank.createAccount(1, 'acc1');
  bank.deposit(2, 'acc1', 100);
  expect(bank.schedulePayment(3, 'acc1', 30, 5)).toBe('payment1');
  expect(bank.deposit(7, 'acc1', 10)).toBe(110);
  expect(bank.deposit(8, 'acc1', 10)).toBe(90);
});
