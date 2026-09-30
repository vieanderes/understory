// Error ratios over two windows: failed requests divided by all valid requests.
export type Rates = { m5: number; h1: number };

export function burnAlert(slo: number, rates: Rates): 'page' | 'none' {
  if (slo <= 0 || slo >= 1) throw new Error('slo must be between 0 and 1');
  const burn = (rate: number) => rate / (1 - slo);
  return burn(rates.h1) > 14.4 && burn(rates.m5) > 14.4 ? 'page' : 'none';
}
