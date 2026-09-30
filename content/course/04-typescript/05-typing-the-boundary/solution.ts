export type Currency = 'GBP' | 'EUR';

export type Price = {
  /** A whole number of pence, 0 or more. */
  amountPence: number;
  currency: Currency;
};

/** A parser's answer: a checked price, or the name of the field that failed. */
export type PriceResult = { ok: true; value: Price } | { ok: false; error: string };

export function parsePrice(input: unknown): PriceResult {
  // `typeof null` is "object", so null needs its own test before `in` is allowed.
  if (typeof input !== 'object' || input === null) {
    return { ok: false, error: 'input' };
  }
  // After the `in` test the property exists with type `unknown`, and `typeof` narrows it.
  if (!('amountPence' in input) || typeof input.amountPence !== 'number') {
    return { ok: false, error: 'amountPence' };
  }
  // `Number.isInteger` is false for NaN, Infinity and fractions.
  if (!Number.isInteger(input.amountPence) || input.amountPence < 0) {
    return { ok: false, error: 'amountPence' };
  }
  if (!('currency' in input) || (input.currency !== 'GBP' && input.currency !== 'EUR')) {
    return { ok: false, error: 'currency' };
  }
  // A new object with the two checked fields: no assertion, and no unchecked extras.
  return { ok: true, value: { amountPence: input.amountPence, currency: input.currency } };
}
