import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CapstoneAdr } from '@/core/progress';

const record = vi.fn(() => Promise.resolve());
vi.mock('@/features/store/StoreProvider', () => ({
  useStore: () => ({ record }),
}));

const { AdrForm } = await import('@/features/adr/AdrForm');

const SAVED: CapstoneAdr = {
  partId: 'servers',
  title: 'Sessions in memory',
  context: 'One process.',
  decision: 'A map.',
  firstWrittenOn: '2026-09-17',
  updatedOn: '2026-09-17',
  revisions: 1,
};

beforeEach(() => record.mockClear());

describe('AdrForm', () => {
  it('starts on the title and names every field', () => {
    render(<AdrForm partId="servers" initial={undefined} onDone={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('textbox', { name: 'Title' })).toHaveFocus();
    for (const name of [/Context/, /^Decision$/, /Alternatives considered/, /Consequences/]) {
      expect(screen.getByRole('textbox', { name })).toBeInTheDocument();
    }
  });

  it('asks for a title and a decision, and records nothing without them', async () => {
    const user = userEvent.setup();
    render(<AdrForm partId="servers" initial={undefined} onDone={vi.fn()} onCancel={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Save decision record' }));
    expect(screen.getByText('Give the record a title.')).toBeInTheDocument();
    expect(screen.getByText('Write the decision.')).toBeInTheDocument();
    const title = screen.getByRole('textbox', { name: 'Title' });
    expect(title).toHaveAttribute('aria-invalid', 'true');
    expect(title).toHaveFocus();
    expect(record).not.toHaveBeenCalled();
  });

  it('saves on Enter with blank sections left out, and trims the rest', async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    render(<AdrForm partId="servers" initial={undefined} onDone={onDone} onCancel={vi.fn()} />);
    await user.type(screen.getByRole('textbox', { name: /^Decision$/ }), '  A sessions table. ');
    await user.type(screen.getByRole('textbox', { name: /Context/ }), '   ');
    await user.type(screen.getByRole('textbox', { name: 'Title' }), 'Sessions in a table{Enter}');
    expect(record).toHaveBeenCalledWith('capstone_adr_written', {
      partId: 'servers',
      title: 'Sessions in a table',
      decision: 'A sessions table.',
    });
    expect(onDone).toHaveBeenCalledWith(true);
  });

  it('edits a saved record, and records nothing when nothing changed', async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    render(<AdrForm partId="servers" initial={SAVED} onDone={onDone} onCancel={vi.fn()} />);
    expect(screen.getByRole('form', { name: 'Edit the decision record' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Context/ })).toHaveValue('One process.');
    await user.click(screen.getByRole('button', { name: 'Save decision record' }));
    expect(record).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledWith(false);
  });

  it('cancels without recording', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<AdrForm partId="servers" initial={SAVED} onDone={vi.fn()} onCancel={onCancel} />);
    await user.type(screen.getByRole('textbox', { name: 'Title' }), ' changed');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });
});
