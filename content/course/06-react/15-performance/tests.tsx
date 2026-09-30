import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProductSearch, type Filters, type Product } from './solution';

const products: Product[] = [
  { id: 'p1', name: 'Desk lamp', inStock: true },
  { id: 'p2', name: 'Floor lamp', inStock: false },
  { id: 'p3', name: 'Lamp shade', inStock: true },
  { id: 'p4', name: 'Rug', inStock: true },
];

// Stands in for a slow ranking: it counts how often it runs.
function countingRank() {
  const calls = { count: 0 };
  const rank = (list: Product[], filters: Filters) => {
    calls.count++;
    const query = filters.query.toLowerCase();
    return list.filter(
      (product) => product.name.toLowerCase().includes(query) && (!filters.inStock || product.inStock),
    );
  };
  return { rank, calls };
}

const names = () => screen.queryAllByRole('listitem').map((item) => item.textContent);

test('shows the products in stock', () => {
  const { rank } = countingRank();
  render(<ProductSearch products={products} rank={rank} />);
  expect(screen.getByText('3 results')).toBeInTheDocument();
  expect(names()).toEqual(['Desk lamp', 'Lamp shade', 'Rug']);
});

test('Dark mode does not run the ranking again', async () => {
  const user = userEvent.setup();
  const { rank, calls } = countingRank();
  render(<ProductSearch products={products} rank={rank} />);
  const toggle = screen.getByRole('button', { name: 'Dark mode' });
  await user.click(toggle);
  await user.click(toggle);
  await user.click(toggle);
  expect(toggle).toHaveAttribute('aria-pressed', 'true');
  expect(calls.count).toBe(1);
});

test('typing a search runs it again, with the new query', async () => {
  const user = userEvent.setup();
  const { rank, calls } = countingRank();
  render(<ProductSearch products={products} rank={rank} />);
  await user.type(screen.getByLabelText('Search'), 'lamp');
  expect(calls.count).toBe(5);
  expect(names()).toEqual(['Desk lamp', 'Lamp shade']);
  expect(screen.getByText('2 results')).toBeInTheDocument();
});
