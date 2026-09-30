function setQuantity(cart, ticket, quantity) {
  // Nothing to change, so the same object tells everyone that nothing changed.
  if (!cart.lines.some((line) => line.ticket === ticket)) {
    return cart;
  }

  // Copy the path to the change: the array, and the one line that differs. Every other
  // line is reused as it is.
  let lines;
  if (quantity === 0) {
    lines = cart.lines.filter((line) => line.ticket !== ticket);
  } else {
    lines = cart.lines.map((line) => {
      if (line.ticket === ticket) {
        return { ...line, quantity };
      }
      return line;
    });
  }
  return { ...cart, lines };
}
