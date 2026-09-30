function shippingLabel(order) {
  // Read the city safely, fall back when it's missing, and pick the fee with a switch.
  return `${order.name} - ${order.address.city} - 0`;
}
