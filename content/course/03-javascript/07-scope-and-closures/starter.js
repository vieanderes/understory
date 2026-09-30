// Every basket shares this one variable. Give each basket its own.
let held = 0;

function makeBasket(limit) {
  function add(quantity) {
    held = held + quantity;
    return held <= limit;
  }
  function count() {
    return held;
  }
  return { add, count };
}
