import { sizeLabel } from './sizes.solution';

test('an XL costs 450 and says XL', () => {
  expect(sizeLabel('xl')).toBe('XL: £450');
});

test('the other sizes keep their prices', () => {
  expect(sizeLabel('small')).toBe('S: £45');
  expect(sizeLabel('large')).toBe('L: £300');
});
