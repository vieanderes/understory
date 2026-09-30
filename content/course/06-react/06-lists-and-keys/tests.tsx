import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TaskList } from './solution';

const tasks = [
  { id: 't1', title: 'Milk' },
  { id: 't2', title: 'Bread' },
  { id: 't3', title: 'Eggs' },
];

// Found by label: the text a person reads next to each field.
const box = (title: string) => screen.getByLabelText(title);
const note = (title: string) => screen.getByLabelText(`Note for ${title}`);

test('shows a row for each task', () => {
  render(<TaskList tasks={tasks} />);
  expect(screen.getAllByRole('listitem')).toHaveLength(3);
  expect(box('Milk')).not.toBeChecked();
});

test('a tick stays with its task after Reverse', async () => {
  const user = userEvent.setup();
  render(<TaskList tasks={tasks} />);
  await user.click(box('Milk'));
  await user.click(screen.getByRole('button', { name: 'Reverse' }));
  expect(screen.getAllByRole('checkbox').map((b) => b.closest('label')?.textContent)).toEqual(['Eggs', 'Bread', 'Milk']);
  expect(box('Milk')).toBeChecked();
  expect(box('Eggs')).not.toBeChecked();
});

test('a half-typed note stays with its task after Reverse', async () => {
  const user = userEvent.setup();
  render(<TaskList tasks={tasks} />);
  await user.type(note('Bread'), 'wholemeal');
  await user.type(note('Eggs'), 'six');
  await user.click(screen.getByRole('button', { name: 'Reverse' }));
  expect(note('Bread')).toHaveValue('wholemeal');
  expect(note('Eggs')).toHaveValue('six');
  expect(note('Milk')).toHaveValue('');
});

test('Remove takes out one row, and the others keep their state', async () => {
  const user = userEvent.setup();
  render(<TaskList tasks={tasks} />);
  await user.click(box('Eggs'));
  await user.type(note('Bread'), 'rye');
  await user.click(screen.getByRole('button', { name: 'Remove Milk' }));
  expect(screen.queryByLabelText('Milk')).not.toBeInTheDocument();
  expect(screen.getAllByRole('listitem')).toHaveLength(2);
  expect(box('Eggs')).toBeChecked();
  expect(box('Bread')).not.toBeChecked();
  expect(note('Bread')).toHaveValue('rye');
});
