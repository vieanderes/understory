function shippingLabel(order) {
  // ?. stops at a missing address instead of throwing, and ?? fills the gap it leaves
  const city = order.address?.city ?? 'no address';
  let fee;
  switch (order.shipping) {
    case 'standard':
      fee = 3;
      break;
    case 'express':
      fee = 8;
      break;
    default:
      fee = 0;
  }
  return `${order.name} - ${city} - ${fee}`;
}
