import { Bank } from './bank.solution';

test('large: 20,000 pending payments while 25,000 transfers run', () => {
  const bank = new Bank();
  let time = 0;
  const accounts = 1000;
  for (let i = 0; i < accounts; i++) {
    bank.createAccount(++time, `acc${i}`);
    bank.deposit(++time, `acc${i}`, 1_000_000);
  }
  // Due long after the transfers, so each one waits in the queue the whole time.
  for (let i = 0; i < 20_000; i++) {
    bank.schedulePayment(++time, `acc${(i * 7) % accounts}`, 1 + (i % 50), 100_000);
  }
  for (let i = 0; i < 20_000; i += 4) bank.cancelPayment(++time, `acc${(i * 7) % accounts}`, `payment${i + 1}`);
  for (let i = 0; i < 25_000; i++) {
    bank.transfer(++time, `acc${(i * 13) % accounts}`, `acc${(i * 17 + 1) % accounts}`, 1 + (i % 100));
  }
  expect(bank.topSpenders(time + 200_000, 3)).toEqual(['acc187(3340)', 'acc287(3340)', 'acc387(3340)']);
});

test('large: 25,000 deposits, then 25,000 balance lookups', () => {
  const bank = new Bank();
  bank.createAccount(1, 'acc1');
  for (let t = 2; t <= 25_001; t++) bank.deposit(t, 'acc1', 1);
  // After the deposit at time t the balance is t - 1.
  let time = 25_001;
  let wrong = 0;
  for (let i = 0; i < 25_000; i++) {
    const timeAt = 1 + ((i * 7919) % 25_001);
    if (bank.getBalance(++time, 'acc1', timeAt) !== timeAt - 1) wrong += 1;
  }
  expect(wrong).toBe(0);
});
