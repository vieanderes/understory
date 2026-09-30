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
  // Target O(n log(total)): binary-search the capacity, from the heaviest parcel to the total.
  return 0;
}
