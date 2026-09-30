function cheapestInStock(products) {
  // filter and toSorted both return new arrays, so the caller's array keeps its order.
  // The comparator subtracts, because the default sort would compare prices as strings.
  return products
    .filter((product) => product.stock > 0)
    .toSorted((a, b) => a.price - b.price)
    .map((product) => product.name);
}
