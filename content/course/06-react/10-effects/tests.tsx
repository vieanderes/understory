import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PhotoViewer } from './solution';

const shortcuts = () => screen.getByLabelText('Keyboard shortcuts');

test('starts on the first photo', () => {
  render(<PhotoViewer />);
  expect(screen.getByText('Photo 1 of 4')).toBeInTheDocument();
  expect(shortcuts()).toBeChecked();
});

test('the right arrow keeps moving forward', async () => {
  const user = userEvent.setup();
  render(<PhotoViewer />);
  await user.keyboard('{ArrowRight}');
  await user.keyboard('{ArrowRight}');
  expect(screen.getByText('Photo 3 of 4')).toBeInTheDocument();
});

test('the arrows stay between the first and the last photo', async () => {
  const user = userEvent.setup();
  render(<PhotoViewer />);
  await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}');
  expect(screen.getByText('Photo 4 of 4')).toBeInTheDocument();
  await user.keyboard('{ArrowLeft}{ArrowLeft}');
  expect(screen.getByText('Photo 2 of 4')).toBeInTheDocument();
  await user.keyboard('{ArrowLeft}{ArrowLeft}{ArrowLeft}');
  expect(screen.getByText('Photo 1 of 4')).toBeInTheDocument();
});

test('with shortcuts off, the keys do nothing', async () => {
  const user = userEvent.setup();
  render(<PhotoViewer />);
  await user.click(shortcuts());
  expect(shortcuts()).not.toBeChecked();
  await user.keyboard('{ArrowRight}');
  expect(screen.getByText('Photo 1 of 4')).toBeInTheDocument();
});

test('switched back on, the keys work again, once per press', async () => {
  const user = userEvent.setup();
  render(<PhotoViewer />);
  await user.click(shortcuts());
  await user.click(shortcuts());
  await user.keyboard('{ArrowRight}');
  expect(screen.getByText('Photo 2 of 4')).toBeInTheDocument();
});
