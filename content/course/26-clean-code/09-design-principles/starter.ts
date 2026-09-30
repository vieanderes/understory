export class Cart {
  items: number[] = [];
  add(pricePence: number) {
    this.items.push(pricePence);
  }
  addMany(prices: number[]) {
    for (const price of prices) this.add(price);
  }
  total(): number {
    return this.items.reduce((sum, price) => sum + price, 0);
  }
}

// addMany calls add, so every item in addMany is counted twice.
// `override` marks a method that replaces one of the parent's.
export class AuditedCart extends Cart {
  additions = 0;
  override add(pricePence: number) {
    this.additions++;
    super.add(pricePence);
  }
  override addMany(prices: number[]) {
    this.additions += prices.length;
    super.addMany(prices);
  }
}
