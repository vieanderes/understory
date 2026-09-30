import { testDeclineSendsNothing, testSuccessChargesAndSends, type Mail, type Order, type Payments } from './solution';

type Checkout = (order: Order, payments: Payments, mail: Mail) => Promise<{ paid: boolean }>;

// Your code and these checks run as one script, so this is your `checkout`. Each check
// swaps in a broken copy, runs your tests, then puts the real one back.
declare let checkout: Checkout;
const real = checkout;
const yours = [testDeclineSendsNothing, testSuccessChargesAndSends];

async function failureOf(version: Checkout, check: () => Promise<void>): Promise<string | null> {
  checkout = version;
  try {
    await check();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  } finally {
    checkout = real;
  }
}

async function expectCaught(version: Checkout, hint: string) {
  for (const check of yours) if ((await failureOf(version, check)) !== null) return;
  throw new Error(`Both tests still pass. ${hint}`);
}

test('your tests pass on the real checkout', async () => {
  for (const check of yours) {
    const failure = await failureOf(real, check);
    if (failure !== null) throw new Error(`${check.name} fails on working code: ${failure}`);
  }
});

test('they catch a checkout that emails before the charge is checked', async () => {
  await expectCaught(async (order, payments, mail) => {
    await mail.send(order.email, 'Thanks for your order');
    const result = await payments.charge(order.totalPence);
    return { paid: result.ok };
  }, 'After a decline, what should have been sent?');
});

test('they catch a checkout that says paid after a decline', async () => {
  await expectCaught(async (order, payments, mail) => {
    const result = await payments.charge(order.totalPence);
    if (result.ok) await mail.send(order.email, 'Thanks for your order');
    return { paid: true };
  }, 'Check what checkout returns after a decline.');
});

test('they catch a checkout that never sends the receipt', async () => {
  await expectCaught(async (order, payments) => {
    const result = await payments.charge(order.totalPence);
    return { paid: result.ok };
  }, 'After a success, who should have got mail?');
});

test('they catch a checkout that charges pounds, not pence', async () => {
  await expectCaught(async (order, payments, mail) => {
    const result = await payments.charge(order.totalPence / 100);
    if (!result.ok) return { paid: false };
    await mail.send(order.email, 'Thanks for your order');
    return { paid: true };
  }, 'A stub that ignores its argument can\'t see the amount. Record it.');
});
