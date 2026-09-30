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

export function monthlyRevenuePence(subscriptions: Subscription[]): number {
  // Replace this body. The tests expect pence per month, for example 1398.
  return subscriptions.length;
}
