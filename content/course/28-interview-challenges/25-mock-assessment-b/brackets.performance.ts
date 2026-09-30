import { firstBreak } from './brackets.solution';

test('large: 100,000 levels of nesting', () => {
  const S = '('.repeat(100_000) + ')'.repeat(100_000);
  expect(firstBreak(S)).toBe(-1);
});

test('large: 200,000 characters that break on the last one', () => {
  const S = '[{()}]'.repeat(33_333) + '[' + ')';
  expect(firstBreak(S)).toBe(S.length - 1);
});

test('large: 200,000 opening brackets left open', () => {
  const S = '{[('.repeat(66_666) + '{[';
  expect(firstBreak(S)).toBe(200_000);
});
