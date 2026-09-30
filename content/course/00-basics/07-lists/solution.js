function average(numbers) {
  let total = 0;
  for (const number of numbers) {
    total = total + number;
  }
  return total / numbers.length;
}
