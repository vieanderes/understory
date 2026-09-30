import {
  countOutcomes,
  enumerateSchedules,
  type RunConfig,
} from '@/core/labs/overselling-simulator';

/**
 * How many interleavings the page is willing to write out. Listing is exponential:
 * `enumerateSchedules` throws once a case passes the limit, which is the cheap way to ask
 * whether a case could be run one ordering at a time, without hanging on one that cannot.
 */
export const LIST_LIMIT = 1000;

export type Enumeration =
  | {
      readonly kind: 'counted';
      readonly total: bigint;
      readonly oversold: bigint;
      /** Whether every ordering could be written out under the limit. */
      readonly listable: boolean;
    }
  | { readonly kind: 'too-large' };

/** Exact counts for the current strategy and parameters, or an admission that it is too big. */
export function enumerate(config: Required<RunConfig>): Enumeration {
  try {
    const { total, oversold } = countOutcomes(config.strategy, config.buyers, config);
    return { kind: 'counted', total, oversold, listable: listable(config) };
  } catch {
    // Counting walks the same tree as listing, memoised. If even that is beyond this page,
    // say so rather than leaving the learner with a frozen tab.
    return { kind: 'too-large' };
  }
}

function listable(config: Required<RunConfig>): boolean {
  try {
    enumerateSchedules({ ...config, schedule: [] }, LIST_LIMIT);
    return true;
  } catch {
    return false;
  }
}

/** Exact up to a quadrillion, then a power of ten: nobody reads 46 digits. */
export function formatCount(value: bigint): string {
  if (value < 1_000_000_000_000_000n) return value.toLocaleString('en-GB');
  const digits = value.toString();
  return `${digits[0]}.${digits.slice(1, 3)} x 10^${digits.length - 1}`;
}
