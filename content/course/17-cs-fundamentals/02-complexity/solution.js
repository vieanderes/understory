function repeatCustomers(yesterday, today) {
  // Build the Set once, so each check jumps straight to the answer instead of walking a list.
  const seen = new Set(yesterday);
  return today.filter((email) => seen.has(email));
}
