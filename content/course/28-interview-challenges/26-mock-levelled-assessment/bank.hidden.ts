import { Bank } from './bank.solution';

describe('level 1', () => {
  test('a missing account or the same account gives null', () => {
    const bank = new Bank();
    expect(bank.deposit(1, 'acc1', 100)).toBe(null);
    bank.createAccount(2, 'acc1');
    expect(bank.transfer(3, 'acc1', 'acc9', 1)).toBe(null);
    expect(bank.transfer(4, 'acc9', 'acc1', 1)).toBe(null);
    bank.deposit(5, 'acc1', 100);
    expect(bank.transfer(6, 'acc1', 'acc1', 50)).toBe(null);
    expect(bank.deposit(7, 'acc1', 1)).toBe(101);
  });

  test('a transfer of the whole balance works, one more does not', () => {
    const bank = new Bank();
    bank.createAccount(1, 'acc1');
    bank.createAccount(2, 'acc2');
    bank.deposit(3, 'acc1', 1_000_000_000);
    expect(bank.transfer(4, 'acc1', 'acc2', 1_000_000_000)).toBe(0);
    expect(bank.transfer(5, 'acc1', 'acc2', 1)).toBe(null);
    expect(bank.deposit(6, 'acc2', 1_000_000_000)).toBe(2_000_000_000);
  });
});

describe('level 2', () => {
  test('ties sort by id, and deposits do not count', () => {
    const bank = new Bank();
    bank.createAccount(1, 'b');
    bank.createAccount(2, 'c');
    bank.createAccount(3, 'a');
    bank.deposit(4, 'c', 1000);
    bank.deposit(5, 'b', 1000);
    bank.transfer(6, 'c', 'a', 50);
    bank.transfer(7, 'b', 'a', 50);
    expect(bank.topSpenders(8, 3)).toEqual(['b(50)', 'c(50)', 'a(0)']);
  });

  test('n larger than the number of accounts returns them all', () => {
    const bank = new Bank();
    bank.createAccount(1, 'acc1');
    bank.createAccount(2, 'acc2');
    bank.deposit(3, 'acc2', 10);
    bank.transfer(4, 'acc2', 'acc1', 7);
    expect(bank.topSpenders(5, 10)).toEqual(['acc2(7)', 'acc1(0)']);
  });

  test('failed transfers add nothing and totals add up', () => {
    const bank = new Bank();
    bank.createAccount(1, 'acc1');
    bank.createAccount(2, 'acc2');
    bank.deposit(3, 'acc1', 100);
    bank.transfer(4, 'acc1', 'acc2', 60);
    bank.transfer(5, 'acc1', 'acc2', 60);
    bank.transfer(6, 'acc1', 'acc2', 40);
    expect(bank.topSpenders(7, 1)).toEqual(['acc1(100)']);
  });
});

describe('level 3', () => {
  test('payments run in due order, then in the order scheduled', () => {
    const bank = new Bank();
    bank.createAccount(1, 'acc1');
    bank.deposit(2, 'acc1', 100);
    expect(bank.schedulePayment(3, 'acc1', 60, 10)).toBe('payment1');
    expect(bank.schedulePayment(4, 'acc1', 50, 8)).toBe('payment2');
    expect(bank.schedulePayment(5, 'acc1', 40, 7)).toBe('payment3');
    // payment2 and payment3 are due at 12 and run in that order. payment1, due at 13,
    // then finds 10 left and is skipped.
    expect(bank.deposit(13, 'acc1', 1)).toBe(11);
    expect(bank.deposit(14, 'acc1', 1)).toBe(12);
    expect(bank.topSpenders(15, 1)).toEqual(['acc1(90)']);
  });

  test('a payment the balance cannot cover is skipped for good', () => {
    const bank = new Bank();
    bank.createAccount(1, 'acc1');
    expect(bank.schedulePayment(2, 'acc1', 50, 3)).toBe('payment1');
    expect(bank.deposit(5, 'acc1', 100)).toBe(100);
    expect(bank.deposit(6, 'acc1', 1)).toBe(101);
    expect(bank.cancelPayment(7, 'acc1', 'payment1')).toBe(false);
  });

  test('cancel works once, only for the owner, only while pending', () => {
    const bank = new Bank();
    bank.createAccount(1, 'acc1');
    bank.createAccount(2, 'acc2');
    bank.deposit(3, 'acc1', 100);
    expect(bank.schedulePayment(4, 'acc1', 10, 10)).toBe('payment1');
    expect(bank.schedulePayment(5, 'acc9', 10, 10)).toBe(null);
    expect(bank.cancelPayment(6, 'acc2', 'payment1')).toBe(false);
    expect(bank.cancelPayment(7, 'acc1', 'payment7')).toBe(false);
    expect(bank.cancelPayment(8, 'acc1', 'payment1')).toBe(true);
    expect(bank.cancelPayment(9, 'acc1', 'payment1')).toBe(false);
    expect(bank.deposit(20, 'acc1', 1)).toBe(101);
  });

  test('a payment runs before an operation at its due time', () => {
    const bank = new Bank();
    bank.createAccount(1, 'acc1');
    bank.createAccount(2, 'acc2');
    bank.deposit(3, 'acc1', 30);
    bank.schedulePayment(4, 'acc1', 30, 6);
    expect(bank.transfer(10, 'acc1', 'acc2', 30)).toBe(null);
    expect(bank.topSpenders(11, 2)).toEqual(['acc1(30)', 'acc2(0)']);
  });
});

describe('level 4', () => {
  test('merging adds balances and totals, removes the second account and refuses bad ids', () => {
    const bank = new Bank();
    bank.createAccount(1, 'acc1');
    bank.createAccount(2, 'acc2');
    bank.createAccount(3, 'acc3');
    bank.deposit(4, 'acc1', 100);
    bank.deposit(5, 'acc2', 100);
    bank.transfer(6, 'acc2', 'acc3', 40);
    expect(bank.mergeAccounts(7, 'acc1', 'acc2')).toBe(true);
    expect(bank.deposit(8, 'acc1', 1)).toBe(161);
    expect(bank.deposit(9, 'acc2', 1)).toBe(null);
    expect(bank.topSpenders(10, 5)).toEqual(['acc1(40)', 'acc3(0)']);
    expect(bank.mergeAccounts(11, 'acc1', 'acc1')).toBe(false);
    expect(bank.mergeAccounts(12, 'acc1', 'acc2')).toBe(false);
    expect(bank.mergeAccounts(13, 'acc9', 'acc1')).toBe(false);
  });

  test('pending payments move to the kept account', () => {
    const bank = new Bank();
    bank.createAccount(1, 'acc1');
    bank.createAccount(2, 'acc2');
    bank.deposit(3, 'acc2', 50);
    bank.schedulePayment(4, 'acc2', 20, 10);
    bank.schedulePayment(5, 'acc2', 5, 10);
    bank.mergeAccounts(6, 'acc1', 'acc2');
    expect(bank.cancelPayment(7, 'acc2', 'payment1')).toBe(false);
    expect(bank.cancelPayment(8, 'acc1', 'payment1')).toBe(true);
    expect(bank.deposit(15, 'acc1', 1)).toBe(46);
    expect(bank.createAccount(16, 'acc2')).toBe(false);
  });

  test('getBalance reads the past, including for a merged-away account', () => {
    const bank = new Bank();
    bank.createAccount(10, 'acc1');
    bank.createAccount(11, 'acc2');
    bank.deposit(12, 'acc1', 100);
    bank.deposit(13, 'acc2', 70);
    bank.schedulePayment(14, 'acc1', 30, 6);
    bank.mergeAccounts(25, 'acc1', 'acc2');
    expect(bank.getBalance(26, 'acc1', 9)).toBe(null);
    expect(bank.getBalance(27, 'acc1', 10)).toBe(0);
    expect(bank.getBalance(28, 'acc1', 19)).toBe(100);
    expect(bank.getBalance(29, 'acc1', 20)).toBe(70);
    expect(bank.getBalance(30, 'acc1', 25)).toBe(140);
    expect(bank.getBalance(31, 'acc2', 24)).toBe(70);
    expect(bank.getBalance(32, 'acc2', 25)).toBe(null);
    expect(bank.getBalance(33, 'acc9', 20)).toBe(null);
  });
});
