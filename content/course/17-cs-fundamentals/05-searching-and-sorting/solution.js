function firstAtLeast(sorted, value) {
  // Invariant: everything before lo is smaller than value, and everything from hi on is not.
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (sorted[mid] < value) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}
