// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Autocomplete } from '../src/autocomplete';

interface Call {
  query: string;
  signal: AbortSignal;
  resolve(items: string[]): void;
  reject(error: unknown): void;
}

/** A search the test answers by hand, so it controls which response arrives first. */
function fakeSearch() {
  const calls: Call[] = [];
  const search = vi.fn(
    (query: string, signal: AbortSignal) =>
      new Promise<string[]>((resolve, reject) => {
        calls.push({ query, signal, resolve, reject });
      }),
  );
  return { search, calls };
}

async function settle(fn: () => void) {
  await act(async () => {
    fn();
  });
}

async function advance(ms: number) {
  await act(() => vi.advanceTimersByTimeAsync(ms));
}

function setup(props: Partial<Parameters<typeof Autocomplete>[0]> = {}) {
  const { search, calls } = fakeSearch();
  const onSelect = vi.fn();
  // delay: null types without waiting between keys, so only the debounce uses the fake clock.
  const user = userEvent.setup({ delay: null });
  render(<Autocomplete label="Country" search={search} onSelect={onSelect} {...props} />);
  const input = screen.getByRole('combobox', { name: 'Country' });
  return { search, calls, onSelect, user, input };
}

async function typeAndLoad(ctx: ReturnType<typeof setup>, text: string, items: string[]) {
  await ctx.user.type(ctx.input, text);
  await advance(250);
  await settle(() => ctx.calls.at(-1)!.resolve(items));
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Autocomplete: combobox semantics', () => {
  it('is a labelled combobox that controls a listbox in the document', () => {
    const { input } = setup();
    expect(input).toHaveAttribute('aria-autocomplete', 'list');
    expect(input).toHaveAttribute('aria-expanded', 'false');
    const listId = input.getAttribute('aria-controls');
    expect(listId).toBeTruthy();
    expect(document.getElementById(listId!)).toHaveAttribute('role', 'listbox');
  });
});

describe('Autocomplete: searching', () => {
  it('waits for a pause in typing, then searches once with the trimmed query', async () => {
    const { user, input, search } = setup();
    await user.type(input, ' fra ');
    await advance(249);
    expect(search).not.toHaveBeenCalled();
    await advance(1);
    expect(search).toHaveBeenCalledTimes(1);
    expect(search.mock.calls[0]![0]).toBe('fra');
  });

  it('does not search below the minimum length', async () => {
    const { user, input, search } = setup({ minChars: 3 });
    await user.type(input, 'fr');
    await advance(1000);
    expect(search).not.toHaveBeenCalled();
  });

  it('shows Searching, then the options, and expands', async () => {
    const ctx = setup();
    await ctx.user.type(ctx.input, 'fr');
    await advance(250);
    expect(screen.getByRole('status')).toHaveTextContent('Searching');
    await settle(() => ctx.calls[0]!.resolve(['France', 'French Guiana']));
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'France',
      'French Guiana',
    ]);
    expect(ctx.input).toHaveAttribute('aria-expanded', 'true');
  });

  it('lets the latest response win and aborts the earlier request', async () => {
    const ctx = setup();
    await ctx.user.type(ctx.input, 'f');
    await advance(250);
    await ctx.user.type(ctx.input, 'r');
    await advance(250);
    expect(ctx.calls.map((c) => c.query)).toEqual(['f', 'fr']);
    expect(ctx.calls[0]!.signal.aborted).toBe(true);

    await settle(() => ctx.calls[1]!.resolve(['France']));
    await settle(() => ctx.calls[0]!.resolve(['Fiji', 'Finland']));
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['France']);
  });

  it('says No results when the search finds nothing', async () => {
    const ctx = setup();
    await typeAndLoad(ctx, 'zz', []);
    expect(screen.getByRole('status')).toHaveTextContent('No results');
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('shows an alert on failure and retries on request', async () => {
    const ctx = setup();
    await ctx.user.type(ctx.input, 'fr');
    await advance(250);
    await settle(() => ctx.calls[0]!.reject(new Error('503')));
    expect(screen.getByRole('alert')).toHaveTextContent('Search failed');

    await ctx.user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(ctx.calls).toHaveLength(2);
    expect(ctx.calls[1]!.query).toBe('fr');
    await settle(() => ctx.calls[1]!.resolve(['France']));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('option')).toHaveTextContent('France');
  });

  it('closes and forgets results when the input is cleared', async () => {
    const ctx = setup();
    await typeAndLoad(ctx, 'fr', ['France']);
    await ctx.user.clear(ctx.input);
    expect(ctx.input).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });
});

describe('Autocomplete: keyboard and selection', () => {
  const countries = ['France', 'French Guiana', 'French Polynesia'];

  function activeOption(input: HTMLElement) {
    const id = input.getAttribute('aria-activedescendant');
    return id ? document.getElementById(id) : null;
  }

  it('moves the active option with the arrows, wrapping at both ends', async () => {
    const ctx = setup();
    await typeAndLoad(ctx, 'fr', countries);
    expect(ctx.input).not.toHaveAttribute('aria-activedescendant');

    await ctx.user.keyboard('{ArrowDown}');
    expect(activeOption(ctx.input)).toHaveTextContent('France');
    expect(activeOption(ctx.input)).toHaveAttribute('aria-selected', 'true');

    await ctx.user.keyboard('{ArrowUp}');
    expect(activeOption(ctx.input)).toHaveTextContent('French Polynesia');

    await ctx.user.keyboard('{ArrowDown}');
    expect(activeOption(ctx.input)).toHaveTextContent('France');
    expect(ctx.input).toHaveFocus();
  });

  it('selects the active option with Enter', async () => {
    const ctx = setup();
    await typeAndLoad(ctx, 'fr', countries);
    await ctx.user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    expect(ctx.input).toHaveValue('French Guiana');
    expect(ctx.onSelect).toHaveBeenCalledWith('French Guiana');
    expect(ctx.input).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes with Escape', async () => {
    const ctx = setup();
    await typeAndLoad(ctx, 'fr', countries);
    await ctx.user.keyboard('{Escape}');
    expect(ctx.input).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryAllByRole('option')).toHaveLength(0);
  });

  it('selects an option on click', async () => {
    const ctx = setup();
    await typeAndLoad(ctx, 'fr', countries);
    await ctx.user.click(screen.getByRole('option', { name: 'French Polynesia' }));
    expect(ctx.input).toHaveValue('French Polynesia');
    expect(ctx.onSelect).toHaveBeenCalledWith('French Polynesia');
  });
});
