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

// Holds a Cart and passes calls on, so Cart's internals can change without breaking it.
export class AuditedCart {
  additions = 0;
  #cart = new Cart();
  add(pricePence: number) {
    this.additions++;
    this.#cart.add(pricePence);
  }
  addMany(prices: number[]) {
    this.additions += prices.length;
    this.#cart.addMany(prices);
  }
  total(): number {
    return this.#cart.total();
  }
}
