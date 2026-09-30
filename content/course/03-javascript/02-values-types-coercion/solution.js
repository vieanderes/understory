function cartTotal(lines, bookingFee) {
  let total = bookingFee;
  for (const line of lines) {
    // Convert once, here at the edge, so everything below works with numbers.
    const price = Number(line.price);
    const quantity = Number(line.quantity);
    // NaN >= 1 is false, so text that isn't a number is skipped along with 0 and below.
    if (quantity >= 1) {
      total = total + price * quantity;
    }
  }
  return total;
}
