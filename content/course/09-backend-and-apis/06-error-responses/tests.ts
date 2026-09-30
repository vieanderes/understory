import { withErrors, NotFoundError } from './solution';

const request = { method: 'GET', path: '/orders/7', body: '' };
const ok = () => ({ status: 200, headers: {}, body: '{"id":7}' });
const missing = () => {
  throw new NotFoundError('No order with id 7');
};
const crash = () => {
  throw new TypeError("Cannot read properties of undefined (reading 'id')");
};
const quiet = () => {};

test('a handler that works is passed through untouched', () => {
  expect(withErrors(ok, quiet)(request)).toEqual(ok());
});

test('a NotFoundError becomes a 404 problem with its message', () => {
  const res = withErrors(missing, quiet)(request);
  expect(res.status).toBe(404);
  expect(JSON.parse(res.body)).toEqual({ title: 'Not Found', status: 404, detail: 'No order with id 7' });
});

test('any other error becomes a 500 problem', () => {
  const res = withErrors(crash, quiet)(request);
  expect(res.status).toBe(500);
  expect(JSON.parse(res.body).title).toBe('Internal Server Error');
});

test('a 500 never shows the client what went wrong inside', () => {
  const res = withErrors(crash, quiet)(request);
  expect(res.body).not.toContain('undefined');
  expect(JSON.parse(res.body).detail).toBe('Something went wrong on our side.');
});

test('errors are sent as problem details', () => {
  expect(withErrors(missing, quiet)(request).headers['Content-Type']).toBe('application/problem+json');
  expect(withErrors(crash, quiet)(request).headers['Content-Type']).toBe('application/problem+json');
});

test('an unexpected error is logged, and an expected one is not', () => {
  const logged: unknown[] = [];
  const log = (error: unknown) => {
    logged.push(error);
  };
  withErrors(missing, log)(request);
  expect(logged).toHaveLength(0);
  withErrors(crash, log)(request);
  expect(logged).toHaveLength(1);
  expect(logged[0]).toBeInstanceOf(TypeError);
});
