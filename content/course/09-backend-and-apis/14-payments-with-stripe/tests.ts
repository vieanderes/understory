import { markPaid } from './solution';

function shop() {
  return new Map([['ord_1', { id: 'ord_1', totalPence: 4000, status: 'pending' as 'pending' | 'paid' }]]);
}

function event(type: string, paymentStatus: string, amount = 4000, orderId = 'ord_1') {
  return {
    id: 'evt_1',
    type,
    data: { object: { client_reference_id: orderId, payment_status: paymentStatus, amount_total: amount } },
  };
}

test('a completed, paid session marks its order paid', () => {
  const orders = shop();
  expect(markPaid(event('checkout.session.completed', 'paid'), orders)).toBe('paid');
  expect(orders.get('ord_1')?.status).toBe('paid');
});

test('other event types change nothing', () => {
  const orders = shop();
  expect(markPaid(event('checkout.session.expired', 'unpaid'), orders)).toBe('ignored');
  expect(orders.get('ord_1')?.status).toBe('pending');
});

test('a completed session that is not paid yet changes nothing', () => {
  const orders = shop();
  expect(markPaid(event('checkout.session.completed', 'unpaid'), orders)).toBe('ignored');
  expect(orders.get('ord_1')?.status).toBe('pending');
});

test('a repeat of the event reports the order as already paid', () => {
  const orders = shop();
  markPaid(event('checkout.session.completed', 'paid'), orders);
  expect(markPaid(event('checkout.session.completed', 'paid'), orders)).toBe('already paid');
});

test('a session for a different amount does not pay the order', () => {
  const orders = shop();
  expect(markPaid(event('checkout.session.completed', 'paid', 40), orders)).toBe('wrong amount');
  expect(orders.get('ord_1')?.status).toBe('pending');
});

test('an order that does not exist is reported', () => {
  expect(markPaid(event('checkout.session.completed', 'paid', 4000, 'ord_9'), shop())).toBe('unknown order');
});
