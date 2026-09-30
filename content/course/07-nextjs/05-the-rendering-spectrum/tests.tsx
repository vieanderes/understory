import { render, screen } from '@testing-library/react';
import * as file from './solution';

type Props = { searchParams: Promise<{ q?: string }> };
const FilmsPage = (file as { default?: (props: Props) => Promise<React.ReactNode> }).default;

async function show(query: { q?: string }) {
  if (!FilmsPage) throw new Error('Export the page with `export default`.');
  render(<>{await FilmsPage({ searchParams: Promise.resolve(query) })}</>);
}

const titles = () => screen.queryAllByRole('listitem').map((item) => item.textContent);

test('with no query, shows every film', async () => {
  await show({});
  expect(screen.getByRole('heading', { name: 'All films' })).toBeInTheDocument();
  expect(titles()).toEqual(['The Sea Beast', 'Seabiscuit', 'Paddington', 'Finding Nemo']);
});

test('filters by the query, ignoring case', async () => {
  await show({ q: 'sea' });
  expect(screen.getByRole('heading', { name: 'Results for "sea"' })).toBeInTheDocument();
  expect(titles()).toEqual(['The Sea Beast', 'Seabiscuit']);
});

test('matches in the middle of a title', async () => {
  await show({ q: 'NEMO' });
  expect(titles()).toEqual(['Finding Nemo']);
});

test('shows an empty list when nothing matches', async () => {
  await show({ q: 'zebra' });
  expect(titles()).toEqual([]);
});
