// One pass: the current run grows on a good day and resets on a missed one. Updating
// best on every day, not only on a reset, counts a run that reaches the last day.
function longestStreak(steps, goal) {
  let best = 0;
  let current = 0;
  for (const count of steps) {
    current = count >= goal ? current + 1 : 0;
    best = Math.max(best, current);
  }
  return best;
}
