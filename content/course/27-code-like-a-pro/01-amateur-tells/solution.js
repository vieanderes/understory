function lineTotal(item) {
  return item.price * item.qty;
}

function orderLine(item) {
  return `${item.name}: £${lineTotal(item).toFixed(2)}`;
}

function totalLine(items) {
  let total = 0;
  for (const item of items) total += lineTotal(item);
  return `Total: £${total.toFixed(2)}`;
}
