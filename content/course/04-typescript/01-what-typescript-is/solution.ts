export function addDelivery(total: number): number {
  return total + 3.5;
}

// The value typed into the order form always arrives as text.
export function checkoutTotal(fieldValue: string): number {
  return addDelivery(Number(fieldValue));
}
