import { canReadAllOrders } from './solution';

const tokens = ['svc-reports-7f3a9c'];

test('a caller inside the network with no token is refused', () => {
  expect(canReadAllOrders({ ip: '10.0.4.12', headers: {} }, tokens)).toBe(false);
});

test('a caller inside the network with a wrong token is refused', () => {
  const req = { ip: '10.0.4.12', headers: { authorization: 'Bearer guessed-token' } };
  expect(canReadAllOrders(req, tokens)).toBe(false);
});

test('a caller with a valid service token is allowed, wherever it is', () => {
  const req = { ip: '198.51.100.20', headers: { authorization: 'Bearer svc-reports-7f3a9c' } };
  expect(canReadAllOrders(req, tokens)).toBe(true);
});

test('a valid token inside the network is allowed too', () => {
  const req = { ip: '10.0.4.12', headers: { authorization: 'Bearer svc-reports-7f3a9c' } };
  expect(canReadAllOrders(req, tokens)).toBe(true);
});

test('a header without the Bearer prefix is refused', () => {
  const req = { ip: '10.0.4.12', headers: { authorization: 'svc-reports-7f3a9c' } };
  expect(canReadAllOrders(req, tokens)).toBe(false);
});

test('an empty bearer token is refused', () => {
  const req = { ip: '10.0.4.12', headers: { authorization: 'Bearer ' } };
  expect(canReadAllOrders(req, [...tokens, ''])).toBe(false);
});
