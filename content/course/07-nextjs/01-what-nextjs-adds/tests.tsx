import { render, screen } from '@testing-library/react';
import * as page from './solution';

const Page = (page as { default?: () => React.ReactNode }).default;

test('the page is the default export', () => {
  expect(typeof Page).toBe('function');
});

test('shows the heading', () => {
  if (!Page) throw new Error('Export the page with `export default`.');
  render(<Page />);
  expect(screen.getByRole('heading', { name: 'Tide times' })).toBeInTheDocument();
});

test('lists every harbour', () => {
  if (!Page) throw new Error('Export the page with `export default`.');
  render(<Page />);
  const items = screen.getAllByRole('listitem').map((item) => item.textContent);
  expect(items).toEqual(['Whitby', 'Oban', 'Falmouth']);
});

test('links to all harbours', () => {
  if (!Page) throw new Error('Export the page with `export default`.');
  render(<Page />);
  expect(screen.getByRole('link', { name: 'All harbours' })).toHaveAttribute('href', '/harbours');
});
