/** A subscription is in exactly one state, and each state carries only its own fields. */
export type Subscription =
  | { status: 'trial'; endsAt: number }
  | { status: 'active'; pricePence: number }
  | { status: 'discounted'; pricePence: number; discountPence: number }
  | { status: 'cancelled'; cancelledAt: number };

/** Call this after your checks. It compiles only when every status has returned. */
export function assertNever(value: never): never {
  throw new Error(`Unhandled subscription: ${JSON.stringify(value)}`);
}

function paysPence(sub: Subscription): number {
  if (sub.status === 'trial' || sub.status === 'cancelled') {
    return 0;
  }
  if (sub.status === 'active') {
    return sub.pricePence;
  }
  if (sub.status === 'discounted') {
    // Only this member has `discountPence`, and the check has narrowed to it.
    return sub.pricePence - sub.discountPence;
  }
  return assertNever(sub);
}

export function monthlyRevenuePence(subscriptions: Subscription[]): number {
  let total = 0;
  for (const sub of subscriptions) {
    total += paysPence(sub);
  }
  return total;
}
