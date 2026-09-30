function sumNested(list) {
  // This only adds the numbers at the top level. An inner list needs the same treatment.
  let sum = 0;
  for (const item of list) {
    if (typeof item === 'number') {
      sum = sum + item;
    }
  }
  return sum;
}
