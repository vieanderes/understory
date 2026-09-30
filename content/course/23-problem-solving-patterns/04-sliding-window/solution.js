function maxSumOfK(values, k) {
  if (k <= 0 || k > values.length) {
    return null;
  }
  let sum = 0;
  for (let i = 0; i < k; i++) {
    sum += values[i];
  }
  let best = sum;
  for (let i = k; i < values.length; i++) {
    sum = sum + values[i] - values[i - k];
    best = Math.max(best, sum);
  }
  return best;
}
