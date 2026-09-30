// Error ratios over two windows: failed requests divided by all valid requests.
export type Rates = { m5: number; h1: number };

export function burnAlert(slo: number, rates: Rates): 'page' | 'none' {
  if (rates.h1 > 1 - slo) return 'page';
  return 'none';
}
