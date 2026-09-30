import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddBook } from './add.solution';

const field = () => screen.getByLabelText('Title');
const addButton = () => screen.getByRole('button', { name: 'Add' });

test('Add hands the title to the parent', async () => {
  const user = userEvent.setup();
  const added: string[] = [];
  render(<AddBook onAdd={(title) => added.push(title)} />);
  await user.type(field(), 'Middlemarch');
  await user.click(addButton());
  expect(added).toEqual(['Middlemarch']);
});

test('the title is trimmed, and the field empties after Add', async () => {
  const user = userEvent.setup();
  const added: string[] = [];
  render(<AddBook onAdd={(title) => added.push(title)} />);
  await user.type(field(), '  Persuasion ');
  await user.click(addButton());
  expect(added).toEqual(['Persuasion']);
  expect(field()).toHaveValue('');
});

test('a blank title adds nothing', async () => {
  const user = userEvent.setup();
  const added: string[] = [];
  render(<AddBook onAdd={(title) => added.push(title)} />);
  await user.type(field(), '   ');
  await user.click(addButton());
  await user.click(addButton());
  expect(added).toEqual([]);
});
