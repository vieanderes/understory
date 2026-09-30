function receiptLines(items) {
  const lines = [];
  // Work in whole pence, so no rounding creeps in until the amount is shown.
  let total = 0;
  for (const item of items) {
    const pence = item.pence * item.quantity;
    total += pence;
    // toFixed gives a string with two decimals; padStart lines the amounts up on the right
    const pounds = (pence / 100).toFixed(2).padStart(7);
    lines.push(`${item.name} x${item.quantity} ${pounds}`);
  }
  lines.push(`Total ${(total / 100).toFixed(2).padStart(7)}`);
  return lines;
}
