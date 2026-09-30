// The rule is right, but the numbers are unnamed, the comments repeat the code, and an
// old rule lingers. Name the numbers FREE_DELIVERY_THRESHOLD and DELIVERY_FEE, and tidy up.
function deliveryFee(basketTotal) {
  // check if total is 50 or more
  if (basketTotal >= 50) {
    return 0;
  }
  // return 4.99
  return 4.99;
  // old rule: return basketTotal < 20 ? 6.99 : 4.99;
}
