export function priceFor(qty: number, unitPence: number): number {
  if (qty < 1 || unitPence < 0) throw new Error('bad order');
  const full = qty * unitPence;
  const discount = qty >= 10 ? Math.floor(full / 10) : 0;
  return full - discount;
}

export function testFiftyMugsGetTwentyPercentOff() {
  // Red first: fifty mugs at 400 should cost 16000
}
