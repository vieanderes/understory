import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReadingList } from './list.solution';

const books = [
  { id: '1', title: 'Dune', read: true },
  { id: '2', title: 'Emma', read: false },
  { id: '3', title: 'Beloved', read: false },
];

const titles = () => screen.queryAllByRole('listitem').map((item) => item.textContent);
const filterButton = (name: string) => screen.getByRole('button', { name });

test('shows every book and how many are left to read', () => {
  render(<ReadingList initialBooks={books} />);
  expect(titles()).toEqual(['Dune', 'Emma', 'Beloved']);
  expect(screen.getByText('2 left to read')).toBeInTheDocument();
  expect(screen.getByLabelText('Dune')).toBeChecked();
});

test('the filters pick which books show', async () => {
  const user = userEvent.setup();
  render(<ReadingList initialBooks={books} />);
  await user.click(filterButton('To read'));
  expect(titles()).toEqual(['Emma', 'Beloved']);
  expect(filterButton('To read')).toHaveAttribute('aria-pressed', 'true');
  await user.click(filterButton('Read'));
  expect(titles()).toEqual(['Dune']);
});

test('ticking a book updates the count', async () => {
  const user = userEvent.setup();
  render(<ReadingList initialBooks={books} />);
  await user.click(screen.getByLabelText('Emma'));
  expect(screen.getByLabelText('Emma')).toBeChecked();
  expect(screen.getByText('1 left to read')).toBeInTheDocument();
});

test('a book ticked under To read leaves that list', async () => {
  const user = userEvent.setup();
  render(<ReadingList initialBooks={books} />);
  await user.click(filterButton('To read'));
  await user.click(screen.getByLabelText('Beloved'));
  expect(titles()).toEqual(['Emma']);
  await user.click(filterButton('Read'));
  expect(titles()).toEqual(['Dune', 'Beloved']);
});
