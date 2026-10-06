function shrink(items, stillFails) {
  let current = items;
  let i = 0;
  while (i < current.length) {
    const smaller = current.filter((_, j) => j !== i);
    if (stillFails(smaller)) {
      // A removal can make an earlier one possible, so start the pass again.
      current = smaller;
      i = 0;
    } else {
      i = i + 1;
    }
  }
  return current;
}
