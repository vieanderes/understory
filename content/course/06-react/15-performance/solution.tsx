import { useMemo, useState } from 'react';

export type Product = { id: string; name: string; inStock: boolean };
export type Filters = { query: string; inStock: boolean };

export function ProductSearch({
  products,
  rank,
}: {
  products: Product[];
  rank: (products: Product[], filters: Filters) => Product[];
}) {
  const [query, setQuery] = useState('');
  const [dark, setDark] = useState(false);
  // The filters object is built inside the calculation, so the dependencies are the values
  // it's made from. A fresh object in the list would count as a change on every render.
  const results = useMemo(() => rank(products, { query, inStock: true }), [products, query]);

  return (
    <section className={dark ? 'dark' : 'light'}>
      <label>
        Search
        <input value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      <button aria-pressed={dark} onClick={() => setDark(!dark)}>
        Dark mode
      </button>
      <p>{results.length} results</p>
      <ul>
        {results.map((product) => (
          <li key={product.id}>{product.name}</li>
        ))}
      </ul>
    </section>
  );
}
