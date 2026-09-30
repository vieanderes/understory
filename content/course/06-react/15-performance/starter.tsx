import { useMemo, useState } from 'react';

export type Product = { id: string; name: string; inStock: boolean };
export type Filters = { query: string; inStock: boolean };

// It's memoised, yet `rank` still runs on every click of Dark mode. Find out why, and fix it.
export function ProductSearch({
  products,
  rank,
}: {
  products: Product[];
  rank: (products: Product[], filters: Filters) => Product[];
}) {
  const [query, setQuery] = useState('');
  const [dark, setDark] = useState(false);
  const filters = { query, inStock: true };
  const results = useMemo(() => rank(products, filters), [products, filters]);

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
