// Flags and optional fields let impossible payments through, like a card with no last4.
// Model Payment as a union on `kind`, and make the switch exhaustive.
export type Payment = {
  isCard: boolean;
  isBank: boolean;
  last4?: string;
  accountName?: string;
  code?: string;
};

export function describePayment(payment: Payment): string {
  if (payment.isCard) return 'Card ending ' + payment.last4;
  if (payment.isBank) return 'Bank transfer from ' + payment.accountName;
  return 'Voucher ' + payment.code;
}
