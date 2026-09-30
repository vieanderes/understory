const order = { customer: "Ada", items: ["tea", "cake"] };

function countItems(list) {
  return list.length;
}

function summary() {
  return order.customer + " ordered " + countItems(order.items) + " things";
}

console.log(summary());
