import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { TraceTableStep } from '@/features/lesson-player/steps/TraceTableStep';
import { renderStep, traceStep } from './fixtures';

const cell = (name: string) => screen.getByRole('textbox', { name });

async function fill(values: Record<string, string>) {
  const user = userEvent.setup();
  for (const [name, value] of Object.entries(values)) await user.type(cell(name), value);
  return user;
}

const RIGHT = {
  'total after line 2': '"601"',
  'typeof total after line 2': '"string"',
  'total after line 3': '600',
  'typeof total after line 3': '"number"',
};

describe('TraceTableStep', () => {
  it('is a real table: column headers, a row header per line, given rows read as text', () => {
    renderStep(TraceTableStep, traceStep);
    const table = screen.getByRole('table', { name: 'Values after each line' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(['Line', 'total', 'typeof total']);
    expect(within(table).getByRole('rowheader', { name: '1' })).toBeInTheDocument();
    expect(within(table).getByRole('cell', { name: '60' })).toBeInTheDocument();
    // Two open rows of two columns, and nothing to type in the given row.
    expect(screen.getAllByRole('textbox')).toHaveLength(4);
  });

  it('sets up every input for code, not prose, on a phone keyboard', () => {
    renderStep(TraceTableStep, traceStep);
    const input = cell('total after line 2');
    expect(input).toHaveAttribute('inputmode', 'text');
    expect(input).toHaveAttribute('autocapitalize', 'off');
    expect(input).toHaveAttribute('autocorrect', 'off');
    expect(input).toHaveAttribute('spellcheck', 'false');
  });

  it('reports null until every open cell holds something', async () => {
    const view = renderStep(TraceTableStep, traceStep);
    await fill({ 'total after line 2': '"601"', 'typeof total after line 2': '"string"' });
    expect(view.submission()).toBeNull();
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
  });

  it('reports the full grid, which the real grader accepts', async () => {
    const view = renderStep(TraceTableStep, traceStep);
    const user = await fill(RIGHT);
    expect(view.submission()).toEqual({
      type: 'trace-table',
      cells: [
        ['60', '"number"'],
        ['"601"', '"string"'],
        ['600', '"number"'],
      ],
    });
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(view.grade()?.correct).toBe(true);
    expect(screen.getByRole('status')).toHaveTextContent('4 of 4 cells right.');
  });

  it('goes back to null when a cell is emptied', async () => {
    const view = renderStep(TraceTableStep, traceStep);
    const user = await fill(RIGHT);
    await user.clear(cell('total after line 3'));
    expect(view.submission()).toBeNull();
  });

  it('marks the code line of the row in focus', async () => {
    const view = renderStep(TraceTableStep, traceStep);
    const user = userEvent.setup();
    await user.click(cell('total after line 3'));
    const line = (n: number) => view.container.querySelector(`.line[data-line="${n}"]`);
    expect(line(3)).toHaveAttribute('data-picked', 'true');
    expect(line(2)).toHaveAttribute('data-picked', 'false');
    // A highlight only: the lines of a trace are not controls.
    expect(line(3)).not.toHaveAttribute('role');
  });

  it('with a second try on offer, marks the wrong cell and keeps the value back', async () => {
    const view = renderStep(TraceTableStep, traceStep, { reveal: false });
    const user = await fill({ ...RIGHT, 'total after line 2': '61' });
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(view.grade()?.correct).toBe(false);
    expect(cell('total after line 2')).toBeInvalid();
    expect(cell('total after line 3')).not.toBeInvalid();
    expect(cell('total after line 2')).toHaveAttribute('readonly');
    expect(screen.getByRole('status')).toHaveTextContent('3 of 4 cells right.');
    expect(screen.queryByText('"601"')).not.toBeInTheDocument();
    expect(screen.queryByText(/Expected/)).not.toBeInTheDocument();
  });

  it('once the attempt is over, shows the expected value beside the wrong one', async () => {
    renderStep(TraceTableStep, traceStep, { reveal: true });
    const user = await fill({ ...RIGHT, 'total after line 2': '61' });
    await user.click(screen.getByRole('button', { name: 'Check' }));
    expect(cell('total after line 2')).toHaveValue('61');
    expect(screen.getByText('"601"')).toBeInTheDocument();
    expect(screen.getAllByText(/Expected/)).toHaveLength(1);
  });

  it('wraps a four-column table in a focusable region that scrolls by itself', () => {
    const wide = {
      ...traceStep,
      columns: ['a', 'b', 'c', 'd'],
      rows: [{ line: 1, values: ['1', '2', '3', '4'] }],
    };
    renderStep(TraceTableStep, wide);
    expect(screen.getByRole('region', { name: 'Trace table' })).toHaveAttribute('tabindex', '0');
  });
});
