import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Faq } from './solution';

function Page() {
  return (
    <div>
      <Faq question="Can I return an item?">
        <p>Yes, within 30 days.</p>
        <button>Copy link</button>
      </Faq>
      <Faq question="Do you ship abroad?">
        <p>To most countries.</p>
      </Faq>
    </div>
  );
}

const returns = () => screen.getByRole('button', { name: 'Can I return an item?' });
const shipping = () => screen.getByRole('button', { name: 'Do you ship abroad?' });

test('starts closed', () => {
  render(<Page />);
  expect(returns()).toHaveAttribute('aria-expanded', 'false');
  expect(screen.getByText('Yes, within 30 days.')).not.toBeVisible();
});

test('the button opens and closes its answer', async () => {
  const user = userEvent.setup();
  render(<Page />);
  await user.click(returns());
  expect(returns()).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByText('Yes, within 30 days.')).toBeVisible();
  await user.click(returns());
  expect(screen.getByText('Yes, within 30 days.')).not.toBeVisible();
});

test('each Faq has its own state', async () => {
  const user = userEvent.setup();
  render(<Page />);
  await user.click(shipping());
  expect(shipping()).toHaveAttribute('aria-expanded', 'true');
  expect(returns()).toHaveAttribute('aria-expanded', 'false');
  expect(screen.getByText('Yes, within 30 days.')).not.toBeVisible();
});

test('Escape closes it and puts focus back on its button', async () => {
  const user = userEvent.setup();
  render(<Page />);
  await user.click(returns());
  await user.click(screen.getByRole('button', { name: 'Copy link' }));
  expect(screen.getByRole('button', { name: 'Copy link' })).toHaveFocus();
  await user.keyboard('{Escape}');
  expect(returns()).toHaveAttribute('aria-expanded', 'false');
  expect(returns()).toHaveFocus();
});
