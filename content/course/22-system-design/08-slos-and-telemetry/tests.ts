import { burnAlert } from './solution';

test('a fast burn in both windows pages', () => {
  expect(burnAlert(0.999, { h1: 0.02, m5: 0.03 })).toBe('page');
});

test('a slow burn does not page', () => {
  expect(burnAlert(0.999, { h1: 0.002, m5: 0.002 })).toBe('none');
});

test('an outage that already ended does not page', () => {
  expect(burnAlert(0.999, { h1: 0.02, m5: 0 })).toBe('none');
});

test('a five-minute blip alone does not page', () => {
  expect(burnAlert(0.999, { h1: 0.001, m5: 0.5 })).toBe('none');
});

test('just under the line does not page', () => {
  expect(burnAlert(0.999, { h1: 0.0143, m5: 0.02 })).toBe('none');
});

test('a looser target needs a higher error rate to page', () => {
  expect(burnAlert(0.99, { h1: 0.02, m5: 0.03 })).toBe('none');
});

test('an impossible target throws', () => {
  expect(() => burnAlert(1, { h1: 0, m5: 0 })).toThrow();
});
