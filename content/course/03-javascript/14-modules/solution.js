// prices.js
// Only what is exported can be imported. pounds stays private to this file.

function pounds(pence) {
  return (pence / 100).toFixed(2);
}

export function formatPrice(pence) {
  return "£" + pounds(pence);
}

export function total(items) {
  let pence = 0;
  for (const item of items) {
    pence += item.pence;
  }
  return formatPrice(pence);
}
