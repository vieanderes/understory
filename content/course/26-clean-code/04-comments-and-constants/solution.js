// Marketing sets both values each season; change them here only.
const FREE_DELIVERY_THRESHOLD = 50;
const DELIVERY_FEE = 4.99;

function deliveryFee(basketTotal) {
  if (basketTotal >= FREE_DELIVERY_THRESHOLD) return 0;
  return DELIVERY_FEE;
}
