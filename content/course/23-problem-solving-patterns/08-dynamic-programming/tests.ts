import { bestPay } from './solution';

test('no shifts earn nothing', () => {
  expect(bestPay([])).toBe(0);
});

test('one shift earns its pay', () => {
  expect(bestPay([40])).toBe(40);
});

test('example: never two shifts in a row', () => {
  expect(bestPay([10, 20, 30, 10])).toBe(40);
});

test('skipping two in a row can be best', () => {
  expect(bestPay([20, 70, 90, 30, 10])).toBe(120);
  expect(bestPay([50, 10, 10, 50])).toBe(100);
});

test('shifts that pay nothing are fine', () => {
  expect(bestPay([0, 0, 0])).toBe(0);
});

test('performance: 100,000 shifts', () => {
  const pay: number[] = [];
  for (let i = 0; i < 100000; i++) pay.push(1);
  expect(bestPay(pay)).toBe(50000);
});
