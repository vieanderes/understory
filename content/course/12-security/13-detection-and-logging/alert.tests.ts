import { accountsToAlert } from './alert.solution';

const now = 1_000_000;

test('an account over the threshold is alerted', () => {
  const events = [
    { type: 'login_failed', user: 'ana', at: now - 1000 },
    { type: 'login_failed', user: 'ana', at: now - 2000 },
    { type: 'login_failed', user: 'ana', at: now - 3000 },
  ];
  expect(accountsToAlert(events, 3, 60_000, now)).toEqual(['ana']);
});

test('scattered failures across accounts stay quiet', () => {
  const events = [
    { type: 'login_failed', user: 'ben', at: now - 1000 },
    { type: 'login_failed', user: 'cy', at: now - 2000 },
  ];
  expect(accountsToAlert(events, 3, 60_000, now)).toEqual([]);
});

test('failures older than the window do not count', () => {
  const events = [
    { type: 'login_failed', user: 'dee', at: now - 90_000 },
    { type: 'login_failed', user: 'dee', at: now - 91_000 },
    { type: 'login_failed', user: 'dee', at: now - 92_000 },
  ];
  expect(accountsToAlert(events, 3, 60_000, now)).toEqual([]);
});

test('only failed logins are counted', () => {
  const events = [
    { type: 'login', user: 'eve', at: now - 1000 },
    { type: 'login', user: 'eve', at: now - 2000 },
    { type: 'login_failed', user: 'eve', at: now - 3000 },
  ];
  expect(accountsToAlert(events, 3, 60_000, now)).toEqual([]);
});

test('accounts are returned in first-seen order', () => {
  const events = [
    { type: 'login_failed', user: 'sam', at: now - 500 },
    { type: 'login_failed', user: 'ash', at: now - 400 },
    { type: 'login_failed', user: 'sam', at: now - 300 },
    { type: 'login_failed', user: 'ash', at: now - 200 },
  ];
  expect(accountsToAlert(events, 2, 60_000, now)).toEqual(['sam', 'ash']);
});
