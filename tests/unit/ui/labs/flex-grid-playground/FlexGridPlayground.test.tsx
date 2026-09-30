import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import FlexGridPlaygroundLab from '@/features/labs/flex-grid-playground';
import { startFrom } from '@/features/labs/flex-grid-playground/preset';

const predicted = (label: string) =>
  screen.getByRole('row', { name: new RegExp(label) }).querySelector('[data-predicted]');

const stepButton = () => screen.getByRole('button', { name: 'Step' });

async function stepToEnd(user: ReturnType<typeof userEvent.setup>) {
  while (!stepButton().hasAttribute('disabled')) await user.click(stepButton());
}

describe('FlexGridPlaygroundLab', () => {
  it('renders the title, the question and the prediction prompt', () => {
    render(<FlexGridPlaygroundLab />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Flex and grid playground' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Where does the space left over in a row go/)).toBeInTheDocument();
    expect(screen.getByText(/the third with flex-grow 2/)).toBeInTheDocument();
  });

  it('leaves the heading to the lesson when embedded', () => {
    render(<FlexGridPlaygroundLab embedded />);
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });

  it('shares free space by the grow factors rather than by ratio of width', async () => {
    const user = userEvent.setup();
    render(<FlexGridPlaygroundLab />);
    expect(predicted('Inbox')).toHaveAttribute('data-predicted', '96');
    expect(predicted('Archive')).toHaveAttribute('data-predicted', '112');

    await user.click(stepButton());
    expect(screen.getByRole('status')).toHaveTextContent('Each item starts at its flex-basis');
    await stepToEnd(user);
    expect(screen.getByRole('status')).toHaveTextContent('96, 96, 112');
  });

  it('keeps the measurement closed until it is revealed', async () => {
    const user = userEvent.setup();
    render(<FlexGridPlaygroundLab />);
    expect(screen.getAllByText('hidden').length).toBe(3);
    await user.click(screen.getByRole('button', { name: 'Reveal' }));
    expect(screen.queryByText('hidden')).toBeNull();
  });

  it('shrinks by shrink factor times base size, and clamps at a minimum', async () => {
    const user = userEvent.setup();
    render(<FlexGridPlaygroundLab />);
    await user.selectOptions(screen.getByLabelText('Scenario'), 'Price plans');
    expect(Number(predicted('Yearly')?.getAttribute('data-predicted'))).toBeCloseTo(135.915, 3);
    expect(predicted('Monthly')).toHaveAttribute('data-predicted', '100');
    expect(Number(predicted('Weekly')?.getAttribute('data-predicted'))).toBeCloseTo(84.085, 3);
    await stepToEnd(user);
    expect(screen.getByText('Monthly, clamped')).toBeInTheDocument();
  });

  it('follows the grow control', async () => {
    const user = userEvent.setup();
    render(<FlexGridPlaygroundLab />);
    const inbox = screen.getByRole('group', { name: 'Inbox' });
    await user.click(within(inbox).getByRole('button', { name: 'Increase grow' }));
    expect(predicted('Inbox')).toHaveAttribute('data-predicted', '105.6');
  });

  it('turns min-width auto into a length', async () => {
    const user = userEvent.setup();
    render(<FlexGridPlaygroundLab />);
    await user.selectOptions(screen.getByLabelText('Scenario'), 'Cart line');
    const productName = screen.getByRole('group', { name: 'Product name' });
    expect(within(productName).getByLabelText('Minimum, px')).toBeDisabled();
    await user.selectOptions(within(productName).getByLabelText('min-width'), 'px');
    expect(within(productName).getByLabelText('Minimum, px')).toBeEnabled();
  });

  it('resolves the fixed track first and shares the rest between the fr tracks', async () => {
    const user = userEvent.setup();
    render(<FlexGridPlaygroundLab />);
    await user.selectOptions(screen.getByLabelText('Scenario'), 'Photo grid');
    expect(predicted('Column 1')).toHaveAttribute('data-predicted', '96');
    expect(predicted('Column 2')).toHaveAttribute('data-predicted', '69.33333333333333');
    expect(predicted('Column 3')).toHaveAttribute('data-predicted', '138.66666666666666');
    await stepToEnd(user);
    expect(screen.getByText('1fr')).toBeInTheDocument();
  });

  it('collapses an empty repetition under auto-fit and keeps it under auto-fill', async () => {
    const user = userEvent.setup();
    render(<FlexGridPlaygroundLab />);
    await user.selectOptions(screen.getByLabelText('Scenario'), 'Few photos');
    expect(predicted('Column 1')).toHaveAttribute('data-predicted', '101.33333333333333');
    expect(predicted('Column 3')).toHaveAttribute('data-predicted', '101.33333333333333');

    await user.selectOptions(screen.getByLabelText('Mode'), 'auto-fit');
    expect(predicted('Column 1')).toHaveAttribute('data-predicted', '156');
    expect(predicted('Column 3')).toHaveAttribute('data-predicted', '0');
  });

  it('changes a track to another kind', async () => {
    const user = userEvent.setup();
    render(<FlexGridPlaygroundLab />);
    await user.selectOptions(screen.getByLabelText('Scenario'), 'Photo grid');
    const column = screen.getByRole('group', { name: 'Column 2' });
    await user.selectOptions(within(column).getByLabelText('Kind'), 'minmax()');
    expect(within(column).getByLabelText('Minimum, px')).toBeInTheDocument();
    expect(screen.getAllByText(/minmax\(80px, 1fr\)/).length).toBeGreaterThan(0);
  });

  it('names what it leaves out', async () => {
    const user = userEvent.setup();
    render(<FlexGridPlaygroundLab />);
    await user.click(screen.getByText('What this leaves out'));
    expect(screen.getByText(/One flex line/)).toBeInTheDocument();
  });
});

describe('startFrom', () => {
  it('falls back to the default scenario when the preset is not valid', () => {
    const start = startFrom({ scenario: 'nonsense', gap: -4 });
    expect(start.scenario.id).toBe('grow-row');
    expect(start.flex.gap).toBe(8);
    expect(start.hideSwitcher).toBe(false);
  });

  it('applies a valid preset and can hide the switcher', () => {
    const start = startFrom({
      scenario: 'long-text',
      containerWidth: 240,
      items: [{ minWidth: 0 }],
      hideSwitcher: true,
    });
    expect(start.scenario.id).toBe('long-text');
    expect(start.flex.containerWidth).toBe(240);
    expect(start.flex.items[0]?.minWidth).toBe(0);
    expect(start.hideSwitcher).toBe(true);
  });

  it('overrides the repeat track of a grid scenario', () => {
    const start = startFrom({ scenario: 'few-items', repeatMode: 'auto-fit', repeatMin: 120 });
    expect(start.grid.tracks[0]).toMatchObject({ mode: 'auto-fit', min: 120 });
  });

  it('hides the scenario switcher in the view', () => {
    render(<FlexGridPlaygroundLab preset={{ hideSwitcher: true }} />);
    expect(screen.queryByLabelText('Scenario')).toBeNull();
  });
});
