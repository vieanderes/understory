import { isAllowed } from './solution';

test('an allowed request stays allowed', async () => {
  expect(await isAllowed(async () => true)).toBe(true);
});

test('a refused request stays refused', async () => {
  expect(await isAllowed(async () => false)).toBe(false);
});

test('a check that throws refuses the request', async () => {
  const check = async () => {
    throw new Error('database unavailable');
  };
  expect(await isAllowed(check)).toBe(false);
});

test('anything but exactly true refuses', async () => {
  expect(await isAllowed(async () => undefined)).toBe(false);
  expect(await isAllowed(async () => 'yes')).toBe(false);
  expect(await isAllowed(async () => 1)).toBe(false);
});
