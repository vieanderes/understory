import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Autocomplete } from './solution';

const FRUIT = ['Apple', 'Apricot', 'Banana', 'Blueberry', 'Cherry'];

test('the input is a closed combobox with a name', () => {
  render(<Autocomplete label="Fruit" options={FRUIT} />);
  const box = screen.getByRole('combobox', { name: 'Fruit' });
  expect(box).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});

test('typing shows only the options that start with the text', async () => {
  const user = userEvent.setup();
  render(<Autocomplete label="Fruit" options={FRUIT} />);
  await user.type(screen.getByRole('combobox', { name: 'Fruit' }), 'ap');
  const names = screen.getAllByRole('option').map((option) => option.textContent);
  expect(names).toEqual(['Apple', 'Apricot']);
});

test('the arrow keys mark the active option, and Enter picks it', async () => {
  const user = userEvent.setup();
  const picked: string[] = [];
  render(<Autocomplete label="Fruit" options={FRUIT} onSelect={(value) => picked.push(value)} />);
  const box = screen.getByRole('combobox', { name: 'Fruit' });
  await user.type(box, 'b');
  await user.keyboard('{ArrowDown}{ArrowDown}');
  const blueberry = screen.getByRole('option', { name: 'Blueberry' });
  expect(blueberry).toHaveAttribute('aria-selected', 'true');
  expect(box).toHaveAttribute('aria-activedescendant', blueberry.id);
  await user.keyboard('{Enter}');
  expect(picked).toEqual(['Blueberry']);
  expect(box).toHaveValue('Blueberry');
  expect(box).toHaveFocus();
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});

test('Escape closes the list', async () => {
  const user = userEvent.setup();
  render(<Autocomplete label="Fruit" options={FRUIT} />);
  await user.type(screen.getByRole('combobox', { name: 'Fruit' }), 'c');
  expect(screen.getByRole('listbox')).toBeInTheDocument();
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});
