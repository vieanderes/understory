export type Currency = 'GBP' | 'EUR';

export type Price = {
  /** A whole number of pence, 0 or more. */
  amountPence: number;
  currency: Currency;
};

/** A parser's answer: a checked price, or the name of the field that failed. */
export type PriceResult = { ok: true; value: Price } | { ok: false; error: string };

// This compiles, and it checks nothing: `as` is erased before the code runs.
// Replace the assertion with checks that earn the type.
export function parsePrice(input: unknown): PriceResult {
  return { ok: true, value: input as Price };
}
