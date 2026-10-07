import { isOpen } from './solution';

const dayShop = { opens: '09:00', closes: '17:00' };
const nightBakery = { opens: '22:00', closes: '06:00' };

test('a day shop is open inside its hours and shut outside', () => {
  expect(isOpen(dayShop, '12:00')).toBe(true);
  expect(isOpen(dayShop, '18:30')).toBe(false);
});

test('the opening minute counts, the closing minute does not', () => {
  expect(isOpen(dayShop, '09:00')).toBe(true);
  expect(isOpen(dayShop, '17:00')).toBe(false);
});

test('night hours run past midnight', () => {
  expect(isOpen(nightBakery, '23:30')).toBe(true);
  expect(isOpen(nightBakery, '00:00')).toBe(true);
  expect(isOpen(nightBakery, '03:15')).toBe(true);
});

test('the night bakery is shut in the daytime', () => {
  expect(isOpen(nightBakery, '12:00')).toBe(false);
  expect(isOpen(nightBakery, '06:00')).toBe(false);
  expect(isOpen(nightBakery, '22:00')).toBe(true);
});

test('equal opening and closing times mean open all day', () => {
  expect(isOpen({ opens: '00:00', closes: '00:00' }, '13:00')).toBe(true);
  expect(isOpen({ opens: '07:00', closes: '07:00' }, '06:59')).toBe(true);
});
