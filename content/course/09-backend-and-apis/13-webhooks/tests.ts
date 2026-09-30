import { receive } from './solution';

function slowWork() {
  const paid: string[] = [];
  return {
    paid,
    async markPaid(orderId: string) {
      await Promise.resolve();
      paid.push(orderId);
    },
  };
}

test('a payment event marks the order paid and answers 200', async () => {
  const work = slowWork();
  const res = await receive({ id: 'evt_1', type: 'payment.succeeded', orderId: 'ord_1' }, work);
  expect(res.status).toBe(200);
  expect(work.paid).toEqual(['ord_1']);
});

test('two deliveries of one event at once do the work once', async () => {
  const work = slowWork();
  const event = { id: 'evt_2', type: 'payment.succeeded', orderId: 'ord_2' };
  await Promise.all([receive(event, work), receive(event, work)]);
  expect(work.paid).toEqual(['ord_2']);
});

test('a later redelivery changes nothing and still answers 200', async () => {
  const work = slowWork();
  const event = { id: 'evt_3', type: 'payment.succeeded', orderId: 'ord_3' };
  await receive(event, work);
  const again = await receive(event, work);
  expect(again.status).toBe(200);
  expect(work.paid).toEqual(['ord_3']);
});

test('other event types are answered and ignored', async () => {
  const work = slowWork();
  const res = await receive({ id: 'evt_4', type: 'customer.created', orderId: 'ord_4' }, work);
  expect(res.status).toBe(200);
  expect(work.paid).toEqual([]);
});

test('failed work answers 500 and lets the retry try again', async () => {
  let calls = 0;
  const flaky = {
    async markPaid() {
      calls = calls + 1;
      if (calls === 1) throw new Error('The shop is down');
    },
  };
  const event = { id: 'evt_5', type: 'payment.succeeded', orderId: 'ord_5' };
  expect((await receive(event, flaky)).status).toBe(500);
  expect((await receive(event, flaky)).status).toBe(200);
  expect(calls).toBe(2);
});
