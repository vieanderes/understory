export function ticketPence(age: number): number {
  if (age < 5) return 0;
  if (age < 18) return 600;
  return 1200;
}

export function testFreeLimit() {
  // Check the ages on each side of 5
}

export function testAdultLimit() {
  // Check the ages on each side of 18
}
