import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PackingList } from './solution';

const fresh = () => [
  { id: 'p1', name: 'Passport', packed: false },
  { id: 'p2', name: 'Charger', packed: false },
  { id: 'p3', name: 'Socks', packed: true },
];

test('shows the list and how much is packed', () => {
  render(<PackingList items={fresh()} />);
  expect(screen.getAllByRole('listitem')).toHaveLength(3);
  expect(screen.getByText('1 of 3 packed')).toBeInTheDocument();
});

test('ticking an item packs it', async () => {
  const user = userEvent.setup();
  render(<PackingList items={fresh()} />);
  await user.click(screen.getByLabelText('Passport'));
  expect(screen.getByLabelText('Passport')).toBeChecked();
  expect(screen.getByText('2 of 3 packed')).toBeInTheDocument();
});

test('Remove takes the item off the list', async () => {
  const user = userEvent.setup();
  render(<PackingList items={fresh()} />);
  await user.click(screen.getByRole('button', { name: 'Remove Charger' }));
  expect(screen.queryByLabelText('Charger')).not.toBeInTheDocument();
  expect(screen.getByText('1 of 2 packed')).toBeInTheDocument();
});

test('Add sun cream adds a row at the end', async () => {
  const user = userEvent.setup();
  render(<PackingList items={fresh()} />);
  await user.click(screen.getByRole('button', { name: 'Add sun cream' }));
  const rows = screen.getAllByRole('listitem');
  expect(rows).toHaveLength(4);
  expect(rows[3]).toHaveTextContent('Sun cream');
});

test('the items passed in are never changed', async () => {
  const user = userEvent.setup();
  const items = fresh();
  render(<PackingList items={items} />);
  await user.click(screen.getByLabelText('Passport'));
  await user.click(screen.getByRole('button', { name: 'Remove Socks' }));
  await user.click(screen.getByRole('button', { name: 'Add sun cream' }));
  expect(items).toHaveLength(3);
  expect(items[0]?.packed).toBe(false);
});
