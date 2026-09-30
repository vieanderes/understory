function cheapestInStock(products) {
  // This ignores stock and price. Filter, sort a copy by price, then keep the names.
  return products.map((product) => product.name);
}
