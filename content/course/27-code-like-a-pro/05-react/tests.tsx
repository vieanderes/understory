import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TodoList, type Todo } from './solution';

const todos: Todo[] = [
  { id: 1, title: 'Buy milk', done: false },
  { id: 2, title: 'Book dentist', done: true },
  { id: 3, title: 'Call the bank', done: false },
];
const shown = () => screen.queryAllByRole('listitem').map((item) => item.textContent);

test('shows every to-do at first', () => {
  render(<TodoList todos={todos} />);
  expect(shown()).toEqual(['Buy milk', 'Book dentist', 'Call the bank']);
});

test('the search matches titles in any case', async () => {
  const user = userEvent.setup();
  render(<TodoList todos={todos} />);
  await user.type(screen.getByLabelText('Search'), 'BOOK');
  expect(shown()).toEqual(['Book dentist']);
});

test('ticking Hide done hides the finished to-dos', async () => {
  const user = userEvent.setup();
  render(<TodoList todos={todos} />);
  await user.click(screen.getByLabelText('Hide done'));
  expect(shown()).toEqual(['Buy milk', 'Call the bank']);
});

test('the search and the checkbox work together', async () => {
  const user = userEvent.setup();
  render(<TodoList todos={todos} />);
  await user.click(screen.getByLabelText('Hide done'));
  await user.type(screen.getByLabelText('Search'), 'b');
  expect(shown()).toEqual(['Buy milk', 'Call the bank']);
});

test('a new to-do from the parent shows up', () => {
  const { rerender } = render(<TodoList todos={todos} />);
  rerender(<TodoList todos={[...todos, { id: 4, title: 'Water plants', done: false }]} />);
  expect(shown()).toEqual(['Buy milk', 'Book dentist', 'Call the bank', 'Water plants']);
});
