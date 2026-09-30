import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mountTabs } from './tabs.solution';

function setup() {
  document.body.innerHTML = `
    <div data-tabs>
      <div role="tablist" aria-label="Plan details">
        <button role="tab" id="tab-0" aria-controls="panel-0">Features</button>
        <button role="tab" id="tab-1" aria-controls="panel-1">Pricing</button>
        <button role="tab" id="tab-2" aria-controls="panel-2">Support</button>
      </div>
      <div role="tabpanel" id="panel-0" aria-labelledby="tab-0">Unlimited projects</div>
      <div role="tabpanel" id="panel-1" aria-labelledby="tab-1">Nine pounds a month</div>
      <div role="tabpanel" id="panel-2" aria-labelledby="tab-2">Email within a day</div>
    </div>`;
  mountTabs(document.querySelector<HTMLElement>('[data-tabs]')!);
  const tab = (name: string) => screen.getByRole('tab', { name });
  return { user: userEvent.setup(), tab };
}

test('it starts on the first tab, with only its panel showing', () => {
  const { tab } = setup();
  expect(tab('Features')).toHaveAttribute('aria-selected', 'true');
  expect(tab('Pricing')).toHaveAttribute('aria-selected', 'false');
  expect(screen.getByText('Unlimited projects')).toBeVisible();
  expect(screen.getByText('Nine pounds a month')).not.toBeVisible();
});

test('only the selected tab is a tab stop', async () => {
  const { user, tab } = setup();
  expect(tab('Features')).toHaveAttribute('tabindex', '0');
  expect(tab('Pricing')).toHaveAttribute('tabindex', '-1');
  await user.click(tab('Support'));
  expect(tab('Support')).toHaveAttribute('tabindex', '0');
  expect(tab('Features')).toHaveAttribute('tabindex', '-1');
});

test('ArrowRight selects the next tab and moves focus to it', async () => {
  const { user, tab } = setup();
  await user.click(tab('Features'));
  await user.keyboard('{ArrowRight}');
  expect(tab('Pricing')).toHaveFocus();
  expect(tab('Pricing')).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByText('Nine pounds a month')).toBeVisible();
  expect(screen.getByText('Unlimited projects')).not.toBeVisible();
});

test('the arrows wrap round at both ends', async () => {
  const { user, tab } = setup();
  await user.click(tab('Support'));
  await user.keyboard('{ArrowRight}');
  expect(tab('Features')).toHaveFocus();
  await user.keyboard('{ArrowLeft}');
  expect(tab('Support')).toHaveFocus();
  expect(tab('Support')).toHaveAttribute('aria-selected', 'true');
});

test('Home and End jump to the first and last tab', async () => {
  const { user, tab } = setup();
  await user.click(tab('Pricing'));
  await user.keyboard('{End}');
  expect(tab('Support')).toHaveFocus();
  expect(tab('Support')).toHaveAttribute('aria-selected', 'true');
  await user.keyboard('{Home}');
  expect(tab('Features')).toHaveFocus();
  expect(screen.getByText('Unlimited projects')).toBeVisible();
});

test('a click still selects a tab and shows its panel', async () => {
  const { user, tab } = setup();
  await user.click(tab('Pricing'));
  expect(tab('Pricing')).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByText('Nine pounds a month')).toBeVisible();
  expect(screen.getByText('Email within a day')).not.toBeVisible();
});
