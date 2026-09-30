import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MenuButton } from './menu.solution';

const ITEMS = ['Rename', 'Duplicate', 'Delete'];

function setup() {
  const picked: string[] = [];
  const user = userEvent.setup();
  render(<MenuButton label="File actions" items={ITEMS} onSelect={(item) => picked.push(item)} />);
  const button = screen.getByRole('button', { name: 'File actions' });
  return { picked, user, button };
}

test('closed, the button says it opens a menu', () => {
  const { button } = setup();
  expect(button).toHaveAttribute('aria-haspopup', 'menu');
  expect(button).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});

test('a click opens the menu and focuses the first item', async () => {
  const { user, button } = setup();
  await user.click(button);
  expect(button).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getAllByRole('menuitem')).toHaveLength(3);
  expect(screen.getByRole('menuitem', { name: 'Rename' })).toHaveFocus();
});

test('the arrow keys move focus and wrap round', async () => {
  const { user, button } = setup();
  await user.click(button);
  await user.keyboard('{ArrowDown}');
  expect(screen.getByRole('menuitem', { name: 'Duplicate' })).toHaveFocus();
  await user.keyboard('{ArrowDown}{ArrowDown}');
  expect(screen.getByRole('menuitem', { name: 'Rename' })).toHaveFocus();
  await user.keyboard('{ArrowUp}');
  expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveFocus();
});

test('Enter picks the focused item, closes and returns focus', async () => {
  const { picked, user, button } = setup();
  await user.click(button);
  await user.keyboard('{ArrowDown}{Enter}');
  expect(picked).toEqual(['Duplicate']);
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(button).toHaveFocus();
});

test('a click on an item picks it and closes the menu', async () => {
  const { picked, user, button } = setup();
  await user.click(button);
  await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
  expect(picked).toEqual(['Delete']);
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(button).toHaveFocus();
});

test('Escape closes without picking and returns focus', async () => {
  const { picked, user, button } = setup();
  await user.click(button);
  await user.keyboard('{Escape}');
  expect(picked).toEqual([]);
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  expect(button).toHaveFocus();
});

test('opening again starts at the first item', async () => {
  const { user, button } = setup();
  await user.click(button);
  await user.keyboard('{ArrowDown}{Escape}');
  await user.click(button);
  expect(screen.getByRole('menuitem', { name: 'Rename' })).toHaveFocus();
});
