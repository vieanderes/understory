import { redact } from './redact.solution';

test('masks a password at the top level', () => {
  expect(redact({ user: 'kofi', password: 'hunter2' })).toEqual({ user: 'kofi', password: '[redacted]' });
});

test('masks a token inside a nested object', () => {
  const entry = { event: 'login', auth: { method: 'bearer', token: 'eyJhbGci' } };
  expect(redact(entry)).toEqual({ event: 'login', auth: { method: 'bearer', token: '[redacted]' } });
});

test('masks keys whatever their case, like an Authorization header', () => {
  const entry = { path: '/orders', headers: { Authorization: 'Bearer abc123', Accept: 'application/json' } };
  expect(redact(entry)).toEqual({
    path: '/orders',
    headers: { Authorization: '[redacted]', Accept: 'application/json' },
  });
});

test('keeps harmless values at every depth', () => {
  const entry = { requestId: 'r-7', user: { id: 42, plan: 'free' } };
  expect(redact(entry)).toEqual({ requestId: 'r-7', user: { id: 42, plan: 'free' } });
});

test('leaves the original entry unchanged', () => {
  const entry = { auth: { token: 'eyJhbGci' } };
  redact(entry);
  expect(entry.auth.token).toBe('eyJhbGci');
});
