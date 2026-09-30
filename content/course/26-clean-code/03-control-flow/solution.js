const PRICE_PER_SEAT = new Map([
  ['solo', 5],
  ['team', 4],
  ['business', 3],
]);

function monthlyPrice(plan, seats) {
  if (seats < 1) return null;
  const perSeat = PRICE_PER_SEAT.get(plan);
  if (perSeat === undefined) return null;
  return perSeat * seats;
}
