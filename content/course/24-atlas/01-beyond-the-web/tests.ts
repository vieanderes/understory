import { totalFromForm } from './solution';

test('3 each, 4 of them and 2 delivery come to 14', () => {
  expect(totalFromForm('3', '4', '2')).toBe(14);
});

test('the result is a number, not text', () => {
  expect(typeof totalFromForm('3', '4', '2')).toBe('number');
});

test('prices with pence work', () => {
  expect(totalFromForm('2.5', '2', '1')).toBe(6);
});

test('free delivery adds nothing', () => {
  expect(totalFromForm('10', '1', '0')).toBe(10);
});
