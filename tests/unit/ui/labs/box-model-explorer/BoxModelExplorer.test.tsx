import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import BoxModelExplorerLab from '@/features/labs/box-model-explorer';
import { startFrom } from '@/features/labs/box-model-explorer/preset';

const predicted = (label: string) =>
  screen.getByRole('row', { name: new RegExp(label) }).querySelector('[data-predicted]');

const stepButton = () => screen.getByRole('button', { name: 'Step' });

async function stepToEnd(user: ReturnType<typeof userEvent.setup>) {
  while (!stepButton().hasAttribute('disabled')) await user.click(stepButton());
}

describe('BoxModelExplorerLab', () => {
  it('renders the title, the question and the prediction prompt', () => {
    render(<BoxModelExplorerLab />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Box model explorer' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/How wide is this box on screen/)).toBeInTheDocument();
    expect(screen.getByText(/the profile card declares width 200/)).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 6')).toBeInTheDocument();
  });

  it('leaves the heading to the lesson when embedded', () => {
    render(<BoxModelExplorerLab embedded />);
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });

  it('predicts the rendered size of the card and adds the layers one step at a time', async () => {
    const user = userEvent.setup();
    render(<BoxModelExplorerLab />);
    expect(predicted('Content width')).toHaveAttribute('data-predicted', '200');
    expect(predicted('Border box width')).toHaveAttribute('data-predicted', '236');
    expect(predicted('Margin box width')).toHaveAttribute('data-predicted', '268');
    expect(screen.getByText('Step to work it out.')).toBeInTheDocument();

    await user.click(stepButton());
    expect(screen.getByRole('status')).toHaveTextContent('Under content-box the declared size');
    expect(screen.queryByText('Step to work it out.')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Step back' }));
    expect(screen.getByText('Step to work it out.')).toBeInTheDocument();
  });

  it('keeps the measurement closed until it is revealed', async () => {
    const user = userEvent.setup();
    render(<BoxModelExplorerLab />);
    expect(screen.getAllByText('hidden').length).toBe(6);
    await user.click(screen.getByRole('button', { name: 'Reveal' }));
    expect(screen.queryByText('hidden')).toBeNull();
    expect(screen.getByRole('button', { name: 'Reveal' })).toBeDisabled();
    // jsdom lays nothing out, so only the padding, read from the computed style, is real.
    expect(
      screen.getByRole('row', { name: /Padding/ }).querySelector('[data-measured]'),
    ).toHaveAttribute('data-measured', '16');
  });

  it('moves padding and border inside the declared size under border-box', async () => {
    const user = userEvent.setup();
    render(<BoxModelExplorerLab />);
    await user.selectOptions(screen.getByLabelText('box-sizing'), 'border-box');
    expect(predicted('Content width')).toHaveAttribute('data-predicted', '164');
    expect(predicted('Border box width')).toHaveAttribute('data-predicted', '200');
  });

  it('resolves percentage padding against the width of the containing block', async () => {
    const user = userEvent.setup();
    render(<BoxModelExplorerLab />);
    await user.selectOptions(screen.getByLabelText('Scenario'), 'Banner');
    expect(predicted('Padding')).toHaveAttribute('data-predicted', '32');
    await stepToEnd(user);
    expect(screen.getByText(/10% × 320/)).toBeInTheDocument();
  });

  it('collapses the margins of two siblings and takes the sum in a flex parent', async () => {
    const user = userEvent.setup();
    render(<BoxModelExplorerLab />);
    await user.selectOptions(screen.getByLabelText('Scenario'), 'Stacked');
    expect(predicted('Gap between paragraphs')).toHaveAttribute('data-predicted', '24');
    expect(predicted('Parent below the stage top')).toHaveAttribute('data-predicted', '16');

    await user.selectOptions(screen.getByLabelText('Parent'), 'display: flex');
    expect(predicted('Gap between paragraphs')).toHaveAttribute('data-predicted', '40');
    expect(predicted('First paragraph inside parent')).toHaveAttribute('data-predicted', '16');
  });

  it('follows the width control', async () => {
    const user = userEvent.setup();
    render(<BoxModelExplorerLab />);
    await user.click(screen.getByRole('button', { name: 'Increase Width' }));
    expect(predicted('Border box width')).toHaveAttribute('data-predicted', '240');
  });

  it('names what it leaves out', async () => {
    const user = userEvent.setup();
    render(<BoxModelExplorerLab />);
    await user.click(screen.getByText('What this leaves out'));
    expect(screen.getByText(/One figure per property/)).toBeInTheDocument();
  });
});

describe('startFrom', () => {
  it('falls back to the default scenario when the preset is not valid', () => {
    const start = startFrom({ scenario: 'nonsense', width: 9000 });
    expect(start.scenario.id).toBe('profile-card');
    expect(start.box.width).toBe(200);
    expect(start.hideSwitcher).toBe(false);
  });

  it('applies a valid preset and can hide the switcher', () => {
    const start = startFrom({
      scenario: 'stacked-paragraphs',
      marginBottomA: 40,
      parent: 'flow-root',
      hideSwitcher: true,
    });
    expect(start.scenario.id).toBe('stacked-paragraphs');
    expect(start.stack.marginBottomA).toBe(40);
    expect(start.stack.parent).toBe('flow-root');
    expect(start.hideSwitcher).toBe(true);
  });

  it('hides the scenario switcher in the view', () => {
    render(<BoxModelExplorerLab preset={{ hideSwitcher: true }} />);
    expect(screen.queryByLabelText('Scenario')).toBeNull();
  });

  it('starts from the preset scenario', () => {
    render(<BoxModelExplorerLab preset={{ scenario: 'flex-paragraphs' }} />);
    const row = screen.getByRole('row', { name: /Gap between paragraphs/ });
    expect(within(row).getByText('40')).toBeInTheDocument();
  });
});
