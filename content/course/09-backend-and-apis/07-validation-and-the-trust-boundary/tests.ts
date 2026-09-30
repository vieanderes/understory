import { createOrder } from './solution';

const post = (body: string) => createOrder({ method: 'POST', path: '/orders', body });
const detail = (body: string) => JSON.parse(post(body).body).detail;

test('a good order is created with 201', () => {
  const res = post('{"productId":"kettle","quantity":2}');
  expect(res.status).toBe(201);
  expect(JSON.parse(res.body)).toEqual({ productId: 'kettle', quantity: 2 });
});

test('fields nobody named are dropped', () => {
  const res = post('{"productId":"kettle","quantity":1,"price":0.01,"isAdmin":true}');
  expect(JSON.parse(res.body)).toEqual({ productId: 'kettle', quantity: 1 });
});

test('a body that is not JSON is a 400, not a crash', () => {
  expect(post('quantity=2').status).toBe(400);
  expect(detail('quantity=2')).toBe('Body must be JSON');
});

test('JSON that is not an object is a 400', () => {
  expect(post('null').status).toBe(400);
  expect(post('"kettle"').status).toBe(400);
});

test('a missing or empty productId is a 400', () => {
  expect(detail('{"quantity":2}')).toBe('productId must be a non-empty string');
  expect(detail('{"productId":"","quantity":2}')).toBe('productId must be a non-empty string');
});

test('quantity must be a whole number from 1 to 10', () => {
  const message = 'quantity must be a whole number from 1 to 10';
  expect(detail('{"productId":"kettle","quantity":500}')).toBe(message);
  expect(detail('{"productId":"kettle","quantity":"2"}')).toBe(message);
  expect(detail('{"productId":"kettle","quantity":2.5}')).toBe(message);
  expect(detail('{"productId":"kettle","quantity":0}')).toBe(message);
});

test('an error answers with the problem details type', () => {
  expect(post('{}').headers?.['Content-Type']).toBe('application/problem+json');
});
