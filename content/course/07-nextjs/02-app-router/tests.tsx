import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as file from './solution';

type Props = { error: Error; retry: () => void };
const ErrorPage = (file as { default?: (props: Props) => React.ReactNode }).default;

function show(retry: () => void = () => {}) {
  if (!ErrorPage) throw new Error('Export the component with `export default`.');
  render(<ErrorPage error={new Error('The kitchen is closed')} retry={retry} />);
}

test('shows the heading', () => {
  show();
  expect(screen.getByRole('heading', { name: "Couldn't load the recipes" })).toBeInTheDocument();
});

test("shows the error's message", () => {
  show();
  expect(screen.getByText('The kitchen is closed')).toBeInTheDocument();
});

test('the button calls retry once per click', async () => {
  let calls = 0;
  show(() => {
    calls += 1;
  });
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(calls).toBe(1);
});
