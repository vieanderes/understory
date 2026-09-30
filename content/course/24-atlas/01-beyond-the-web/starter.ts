export function total(price: number, quantity: number, delivery: number): number {
  return price * quantity + delivery;
}

// Form fields always arrive as text, so every value here is a string.
export function totalFromForm(priceText: string, quantityText: string, deliveryText: string): number {
  return total(priceText, quantityText, deliveryText);
}
