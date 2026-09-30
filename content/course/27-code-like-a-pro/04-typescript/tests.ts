import { describePayment, type Payment } from './solution';

test('describes a card by its last four digits', () => {
  expect(describePayment({ kind: 'card', last4: '4242' })).toBe('Card ending 4242');
});

test('describes a bank transfer by the account name', () => {
  expect(describePayment({ kind: 'bank', accountName: 'Ana Silva' })).toBe(
    'Bank transfer from Ana Silva',
  );
});

test('describes a voucher by its code', () => {
  expect(describePayment({ kind: 'voucher', code: 'SPRING10' })).toBe('Voucher SPRING10');
});

test('throws on a kind the type does not allow', () => {
  const unknownKind = { kind: 'crypto' } as unknown as Payment;
  expect(() => describePayment(unknownKind)).toThrow();
});
