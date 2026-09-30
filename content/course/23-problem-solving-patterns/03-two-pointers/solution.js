function removeDuplicates(sorted) {
  if (sorted.length === 0) {
    return 0;
  }
  let write = 1;
  for (let read = 1; read < sorted.length; read++) {
    if (sorted[read] !== sorted[write - 1]) {
      sorted[write] = sorted[read];
      write++;
    }
  }
  return write;
}
