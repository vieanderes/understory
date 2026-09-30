import { alertFor } from './solution';

test('one failure out of two at night pages nobody', () => {
  expect(alertFor({ requests: 2, errors: 1 })).toBe('none');
});

test('a quiet minute with no traffic pages nobody', () => {
  expect(alertFor({ requests: 0, errors: 0 })).toBe('none');
});

test('5% of real traffic failing is a page', () => {
  expect(alertFor({ requests: 600, errors: 30 })).toBe('page');
});

test('a full outage with enough traffic is a page', () => {
  expect(alertFor({ requests: 40, errors: 40 })).toBe('page');
});

test('a small, steady error rate is a ticket', () => {
  expect(alertFor({ requests: 1000, errors: 20 })).toBe('ticket');
});

test('a healthy window stays quiet', () => {
  expect(alertFor({ requests: 1000, errors: 3 })).toBe('none');
});

test('exactly 20 requests is enough to judge', () => {
  expect(alertFor({ requests: 20, errors: 1 })).toBe('page');
});
