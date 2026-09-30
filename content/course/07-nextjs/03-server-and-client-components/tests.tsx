import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LikeButton } from './solution';

test('starts with the count from the page', () => {
  render(<LikeButton likes={12} />);
  expect(screen.getByRole('button')).toHaveTextContent('Like (12)');
});

test('a click likes it', async () => {
  render(<LikeButton likes={12} />);
  await userEvent.click(screen.getByRole('button'));
  expect(screen.getByRole('button')).toHaveTextContent('Liked (13)');
});

test('a second click takes the like back', async () => {
  render(<LikeButton likes={4} />);
  await userEvent.click(screen.getByRole('button'));
  await userEvent.click(screen.getByRole('button'));
  expect(screen.getByRole('button')).toHaveTextContent('Like (4)');
});
