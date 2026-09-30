export function Receipt({ table, prices }: { table: number; prices: number[] }) {
  // Worked out inside the render, from props only: the same prices always give the same total.
  const total = prices.reduce((sum, price) => sum + price, 0);
  return (
    <section>
      <h2>Table {table}</h2>
      <p>Total: £{total.toFixed(2)}</p>
    </section>
  );
}
