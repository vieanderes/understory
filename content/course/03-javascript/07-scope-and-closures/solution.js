function makeBasket(limit) {
  // Declared here, the variable is made once per basket, and only the two functions
  // below can reach it.
  let held = 0;
  function add(quantity) {
    if (held + quantity > limit) {
      return false;
    }
    held = held + quantity;
    return true;
  }
  function count() {
    return held;
  }
  return { add, count };
}
