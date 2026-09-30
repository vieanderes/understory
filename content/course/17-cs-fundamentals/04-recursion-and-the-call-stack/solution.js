function sumNested(list) {
  // Base case: a number adds itself. Smaller problem: an inner list is summed the same way.
  let sum = 0;
  for (const item of list) {
    if (typeof item === 'number') {
      sum = sum + item;
    } else {
      sum = sum + sumNested(item);
    }
  }
  return sum;
}
