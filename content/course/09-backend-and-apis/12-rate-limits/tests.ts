import { check } from './solution';

test('the first three requests in a minute go ahead', () => {
  expect(check('ana', 0)).toBe(0);
  expect(check('ana', 1000)).toBe(0);
  expect(check('ana', 2000)).toBe(0);
});

test('the fourth waits until the window ends', () => {
  for (let i = 0; i < 3; i++) check('ben', 0);
  expect(check('ben', 0)).toBe(60);
  expect(check('ben', 30000)).toBe(30);
});

test('a part second rounds up to a whole second', () => {
  for (let i = 0; i < 3; i++) check('cai', 0);
  expect(check('cai', 59500)).toBe(1);
});

test('each caller has their own count', () => {
  for (let i = 0; i < 4; i++) check('dee', 0);
  expect(check('eve', 0)).toBe(0);
});

test('a new window starts after a minute', () => {
  for (let i = 0; i < 4; i++) check('fay', 0);
  expect(check('fay', 60000)).toBe(0);
});
