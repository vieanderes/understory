export type Payment =
  | { kind: 'card'; last4: string }
  | { kind: 'bank'; accountName: string }
  | { kind: 'voucher'; code: string };

export function describePayment(payment: Payment): string {
  switch (payment.kind) {
    case 'card':
      return `Card ending ${payment.last4}`;
    case 'bank':
      return `Bank transfer from ${payment.accountName}`;
    case 'voucher':
      return `Voucher ${payment.code}`;
    default: {
      const unreachable: never = payment;
      throw new Error(`Unknown payment: ${JSON.stringify(unreachable)}`);
    }
  }
}
