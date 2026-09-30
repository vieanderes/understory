export function ticketPence(age: number): number {
  if (age < 5) return 0;
  if (age < 18) return 600;
  return 1200;
}

export function testFreeLimit() {
  expect(ticketPence(4)).toBe(0);
  expect(ticketPence(5)).toBe(600);
}

export function testAdultLimit() {
  expect(ticketPence(17)).toBe(600);
  expect(ticketPence(18)).toBe(1200);
}
