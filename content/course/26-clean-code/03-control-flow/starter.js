// Correct, but three levels deep, and every new plan means another branch.
// Flatten it with guard clauses, and move the prices into a Map called PRICE_PER_SEAT.
function monthlyPrice(plan, seats) {
  if (seats >= 1) {
    if (plan === 'solo') {
      return 5 * seats;
    } else if (plan === 'team') {
      return 4 * seats;
    } else if (plan === 'business') {
      return 3 * seats;
    } else {
      return null;
    }
  } else {
    return null;
  }
}
