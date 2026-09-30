export type Line = { sku: string; qty: number };

// The pricing service's client. Each call is one trip over the network.
export interface PricingApi {
  getPrice(sku: string): Promise<number>;
  getPrices(skus: string[]): Promise<Record<string, number>>;
}

// One trip for the whole basket: a network boundary wants coarse calls, not one per line.
export async function basketTotal(lines: Line[], pricing: PricingApi): Promise<number> {
  if (lines.length === 0) return 0;
  const prices = await pricing.getPrices(lines.map((line) => line.sku));
  let pence = 0;
  for (const line of lines) {
    const price = prices[line.sku];
    if (price === undefined) throw new Error(`no price for ${line.sku}`);
    pence = pence + price * line.qty;
  }
  return pence;
}
