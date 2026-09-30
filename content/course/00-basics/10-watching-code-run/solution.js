function warmest(temps) {
  let best = temps[0];
  for (const temp of temps) {
    if (temp > best) {
      best = temp;
    }
  }
  return best;
}

console.log(warmest([-5, -2, -9]));
