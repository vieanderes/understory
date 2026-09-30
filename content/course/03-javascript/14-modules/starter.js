// prices.js
// Share formatPrice and total with other files. Keep pounds to this file.

function pounds(pence) {
  return (pence / 100).toFixed(2);
}

function formatPrice(pence) {
  return "£" + pounds(pence);
}

function total(items) {
  // Add up every item's pence and return it as a price, like "£5.70".
}
