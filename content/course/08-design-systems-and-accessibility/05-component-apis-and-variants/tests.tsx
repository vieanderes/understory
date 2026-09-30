import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './solution';

test('renders a real button, named by its text', () => {
  render(<Button>Save</Button>);
  expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
});

test('defaults to the plain variant and the medium size', () => {
  render(<Button>Save</Button>);
  const button = screen.getByRole('button', { name: 'Save' });
  expect(button).toHaveAttribute('data-variant', 'plain');
  expect(button).toHaveAttribute('data-size', 'medium');
});

test('passes the chosen variant and size on', () => {
  render(
    <Button variant="danger" size="small">
      Delete
    </Button>,
  );
  const button = screen.getByRole('button', { name: 'Delete' });
  expect(button).toHaveAttribute('data-variant', 'danger');
  expect(button).toHaveAttribute('data-size', 'small');
});

test('a click calls onClick', async () => {
  const user = userEvent.setup();
  let clicks = 0;
  render(<Button onClick={() => { clicks += 1; }}>Save</Button>);
  await user.click(screen.getByRole('button', { name: 'Save' }));
  expect(clicks).toBe(1);
});

test('Tab then Enter works it from the keyboard', async () => {
  const user = userEvent.setup();
  let clicks = 0;
  render(<Button onClick={() => { clicks += 1; }}>Save</Button>);
  await user.tab();
  expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus();
  await user.keyboard('{Enter}');
  expect(clicks).toBe(1);
});

test('never submits a form by accident', () => {
  render(<Button>Save</Button>);
  expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'button');
});
