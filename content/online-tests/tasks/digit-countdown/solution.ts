function solution(N: number): number {
  // Each step reads the digits of the current value with % and /, so no string round trip.
  let value = N;
  let steps = 0;
  while (value > 0) {
    let largest = 0;
    for (let rest = value; rest > 0; rest = Math.floor(rest / 10)) {
      largest = Math.max(largest, rest % 10);
    }
    value -= largest;
    steps++;
  }
  return steps;
}
