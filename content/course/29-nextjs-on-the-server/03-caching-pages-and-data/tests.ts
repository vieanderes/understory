import { whatToServe } from './solution';

// cacheLife('hours'): revalidate after an hour, expire after a day.
const hours = { revalidate: 3600, expire: 86400 };

test('a young copy is served as it is', () => {
  expect(whatToServe(60, hours)).toBe('serve');
});

test('a copy past revalidate is served, and a refresh starts', () => {
  expect(whatToServe(7200, hours)).toBe('serve-and-refresh');
});

test('a copy exactly at revalidate is due for a refresh', () => {
  expect(whatToServe(3600, hours)).toBe('serve-and-refresh');
});

test('a copy past expire makes the visitor wait', () => {
  expect(whatToServe(90000, hours)).toBe('wait-for-fresh');
});

test('a copy exactly at expire makes the visitor wait', () => {
  expect(whatToServe(86400, hours)).toBe('wait-for-fresh');
});

test('an empty cache makes the visitor wait', () => {
  expect(whatToServe(null, hours)).toBe('wait-for-fresh');
});

test('it follows the lifetime it is given', () => {
  const minutes = { revalidate: 60, expire: 3600 };
  expect(whatToServe(30, minutes)).toBe('serve');
  expect(whatToServe(120, minutes)).toBe('serve-and-refresh');
});
