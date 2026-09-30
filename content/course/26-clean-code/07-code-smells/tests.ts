import { quote, rules } from './solution';

test('quotes standard delivery as before', () => {
  expect(quote('standard', 1200)).toEqual({ cost: 600, days: 3 });
});

test('quotes express delivery as before', () => {
  expect(quote('express', 500)).toEqual({ cost: 1050, days: 1 });
});

test('quotes collection as free and same day', () => {
  expect(quote('collection', 9000)).toEqual({ cost: 0, days: 0 });
});

test('keeps each method in one rules entry', () => {
  expect(Object.keys(rules).sort()).toEqual(['collection', 'express', 'standard']);
  expect(rules.express.cost(1000)).toBe(1200);
  expect(rules.standard.days).toBe(3);
});

test('rounds a part half-kilo up', () => {
  expect(quote('standard', 501).cost).toBe(500);
});
