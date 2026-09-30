let total = 0;

// Two receipts on one page share `total`, and every render adds the prices again. Make it pure.
export function Receipt({ table, prices }: { table: number; prices: number[] }) {
  for (const price of prices) {
    total = total + price;
  }
  return (
    <section>
      <h2>Table {table}</h2>
      <p>Total: £{total.toFixed(2)}</p>
    </section>
  );
}
