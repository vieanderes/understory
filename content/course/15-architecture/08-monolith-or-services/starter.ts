export type Line = { sku: string; qty: number };

// The pricing service's client. Each call is one trip over the network.
export interface PricingApi {
  getPrice(sku: string): Promise<number>;
  getPrices(skus: string[]): Promise<Record<string, number>>;
}

export async function basketTotal(lines: Line[], pricing: PricingApi): Promise<number> {
  let pence = 0;
  for (const line of lines) {
    const price = await pricing.getPrice(line.sku);
    pence = pence + price * line.qty;
  }
  return pence;
}
