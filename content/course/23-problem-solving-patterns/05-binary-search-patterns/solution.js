function daysNeeded(weights, capacity) {
  let days = 1;
  let load = 0;
  for (const weight of weights) {
    if (load + weight > capacity) {
      days++;
      load = 0;
    }
    load += weight;
  }
  return days;
}

function minShipCapacity(weights, days) {
  if (weights.length === 0) {
    return 0;
  }
  // One loop, not Math.max(...weights), which throws on very large arrays.
  let lo = 0;
  let hi = 0;
  for (const weight of weights) {
    lo = Math.max(lo, weight);
    hi += weight;
  }
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (daysNeeded(weights, mid) <= days) {
      hi = mid;
    } else {
      lo = mid + 1;
    }
  }
  return lo;
}
