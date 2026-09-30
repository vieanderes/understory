export function priceFor(qty: number, unitPence: number): number {
  if (qty < 1 || unitPence < 0) throw new Error('bad order');
  const full = qty * unitPence;
  let discount = 0;
  if (qty >= 50) discount = Math.floor(full / 5);
  else if (qty >= 10) discount = Math.floor(full / 10);
  return full - discount;
}

export function testFiftyMugsGetTwentyPercentOff() {
  expect(priceFor(50, 400)).toBe(16000);
}
