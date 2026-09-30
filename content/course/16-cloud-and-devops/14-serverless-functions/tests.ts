import { connectionPlan } from './solution';

test('instances times pool size is what the database sees', () => {
  expect(connectionPlan(200, 1, 50, 0).needed).toBe(200);
});

test('200 single connections do not fit a limit of 50', () => {
  expect(connectionPlan(200, 1, 50, 0).fits).toBe(false);
});

test('reserved connections come off the limit', () => {
  expect(connectionPlan(10, 5, 50, 3)).toEqual({ needed: 50, fits: false, maxInstances: 9 });
});

test('exactly filling what is available still fits', () => {
  expect(connectionPlan(47, 1, 50, 3)).toEqual({ needed: 47, fits: true, maxInstances: 47 });
});

test('maxInstances rounds down to whole instances', () => {
  expect(connectionPlan(1, 8, 100, 0).maxInstances).toBe(12);
});

test('a pool size under 1 throws', () => {
  expect(() => connectionPlan(10, 0, 100, 0)).toThrow();
});
