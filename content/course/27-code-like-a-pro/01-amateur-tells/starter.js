// It works, but every line gives it away. Tidy it the way a reviewer expects:
// orderLine(item), totalLine(items), and a shared lineTotal(item). Print nothing.
function show_order_line(item) {
  console.log("DEBUG item", item);
  const temp = item.price * item.qty;
  return item.name + ": £" + temp.toFixed(2);
}

function showTotalLine(items) {
  let data = 0;
  for (const i of items) data += i.price * i.qty;
  // console.log("total is", data);
  console.log(data);
  return "Total: £" + data.toFixed(2);
}
