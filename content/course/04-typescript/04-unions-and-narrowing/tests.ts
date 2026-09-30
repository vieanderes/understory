import { monthlyRevenuePence, type Subscription } from './solution';

const trial: Subscription = { status: 'trial', endsAt: 1767225600000 };
const active: Subscription = { status: 'active', pricePence: 999 };
const discounted: Subscription = { status: 'discounted', pricePence: 999, discountPence: 600 };
const cancelled: Subscription = { status: 'cancelled', cancelledAt: 1767222000000 };

test('an active subscription pays its full price', () => {
  expect(monthlyRevenuePence([active, active])).toBe(1998);
});

test('a trial and a cancelled subscription pay nothing', () => {
  expect(monthlyRevenuePence([trial, cancelled, active])).toBe(999);
});

test('a discounted subscription pays price minus discount', () => {
  expect(monthlyRevenuePence([active, discounted])).toBe(1398);
});

test('no subscriptions means no revenue', () => {
  expect(monthlyRevenuePence([])).toBe(0);
});

test('an unknown status throws and names the status', () => {
  // A cast stands in for a record written by a newer version. Types can't stop it at run time.
  const paused = { status: 'paused', resumesAt: 1767225600000 } as unknown as Subscription;
  expect(() => monthlyRevenuePence([active, paused])).toThrow('paused');
});
