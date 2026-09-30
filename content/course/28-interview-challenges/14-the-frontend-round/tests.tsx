import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Autocomplete } from './solution';

type Call = {
  query: string;
  resolve: (results: string[]) => void;
  reject: (error: Error) => void;
};

// Lets an answer's callbacks run, then the render they cause.
async function settle() {
  await waitFor(() => {});
  await waitFor(() => {});
}

// A fake search whose answers arrive only when a test says so, in any order it likes.
function fakeSearch() {
  const calls: Call[] = [];
  const search = (query: string) =>
    new Promise<string[]>((resolve, reject) => {
      calls.push({ query, resolve, reject });
    });
  const call = (index: number): Call => {
    const found = calls[index];
    if (!found) throw new Error(`search was called ${calls.length} times, not ${index + 1}`);
    return found;
  };
  const answer = (index: number, results: string[]) => {
    call(index).resolve(results);
    return settle();
  };
  const fail = (index: number) => {
    call(index).reject(new Error('offline'));
    return settle();
  };
  return { calls, search, answer, fail };
}

const optionNames = () => screen.getAllByRole('option').map((option) => option.textContent);

test('the input is a named combobox, closed at first', () => {
  const api = fakeSearch();
  render(<Autocomplete search={api.search} />);
  const box = screen.getByRole('combobox', { name: 'Search' });
  expect(box).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});

test('typing searches, shows loading, then the options', async () => {
  const user = userEvent.setup();
  const api = fakeSearch();
  render(<Autocomplete search={api.search} />);
  const box = screen.getByRole('combobox', { name: 'Search' });
  await user.type(box, 'ca');
  expect(api.calls.map((c) => c.query)).toEqual(['c', 'ca']);
  expect(screen.getByRole('status')).toHaveTextContent('Loading');
  await api.answer(1, ['Cairo', 'Calgary']);
  expect(optionNames()).toEqual(['Cairo', 'Calgary']);
  expect(box).toHaveAttribute('aria-expanded', 'true');
  expect(box).toHaveAttribute('aria-controls', screen.getByRole('listbox').id);
  expect(screen.getByRole('status')).not.toHaveTextContent('Loading');
});

test('the latest request wins, whatever order the answers arrive in', async () => {
  const user = userEvent.setup();
  const api = fakeSearch();
  render(<Autocomplete search={api.search} />);
  await user.type(screen.getByRole('combobox', { name: 'Search' }), 'ca');
  await api.answer(0, ['Cardiff', 'Chester']);
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Loading');
  await api.answer(1, ['Cairo']);
  expect(optionNames()).toEqual(['Cairo']);

  await user.type(screen.getByRole('combobox'), 'i');
  await api.answer(2, ['Cairo']);
  await api.fail(1);
  expect(optionNames()).toEqual(['Cairo']);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('no results and a failed search each have their own state', async () => {
  const user = userEvent.setup();
  const api = fakeSearch();
  render(<Autocomplete search={api.search} />);
  const box = screen.getByRole('combobox', { name: 'Search' });
  await user.type(box, 'z');
  await api.answer(0, []);
  expect(screen.getByRole('status')).toHaveTextContent('No results');
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  expect(box).toHaveAttribute('aria-expanded', 'false');

  await user.type(box, 'q');
  await api.fail(1);
  expect(screen.getByRole('alert')).toHaveTextContent('Search failed');
  expect(screen.getByRole('status')).not.toHaveTextContent('No results');

  await user.type(box, 'x');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

test('the arrow keys move the active option and wrap round', async () => {
  const user = userEvent.setup();
  const api = fakeSearch();
  render(<Autocomplete search={api.search} />);
  const box = screen.getByRole('combobox', { name: 'Search' });
  await user.type(box, 'b');
  await api.answer(0, ['Bath', 'Berlin', 'Bern']);
  expect(box).not.toHaveAttribute('aria-activedescendant');

  await user.keyboard('{ArrowDown}');
  const bath = screen.getByRole('option', { name: 'Bath' });
  expect(bath).toHaveAttribute('aria-selected', 'true');
  expect(box).toHaveAttribute('aria-activedescendant', bath.id);
  expect(box).toHaveFocus();

  await user.keyboard('{ArrowUp}');
  const bern = screen.getByRole('option', { name: 'Bern' });
  expect(box).toHaveAttribute('aria-activedescendant', bern.id);
  expect(bath).toHaveAttribute('aria-selected', 'false');

  await user.keyboard('{ArrowDown}');
  expect(box).toHaveAttribute('aria-activedescendant', bath.id);
});

test('Enter picks the active option, and so does a click', async () => {
  const user = userEvent.setup();
  const api = fakeSearch();
  render(<Autocomplete search={api.search} />);
  const box = screen.getByRole('combobox', { name: 'Search' });
  await user.type(box, 'ca');
  await api.answer(1, ['Cairo', 'Calgary']);
  await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');
  expect(box).toHaveValue('Calgary');
  expect(box).toHaveFocus();
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  expect(box).toHaveAttribute('aria-expanded', 'false');
  expect(api.calls.length).toBe(2);

  await user.type(box, 'x');
  await api.answer(2, ['Calgary North']);
  await user.click(screen.getByRole('option', { name: 'Calgary North' }));
  expect(box).toHaveValue('Calgary North');
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
});

test('Escape closes the list, and a late answer does not reopen it', async () => {
  const user = userEvent.setup();
  const api = fakeSearch();
  render(<Autocomplete search={api.search} />);
  const box = screen.getByRole('combobox', { name: 'Search' });
  await user.type(box, 'o');
  await api.answer(0, ['Oslo', 'Ottawa']);
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  expect(box).toHaveValue('o');

  await user.type(box, 's');
  await user.keyboard('{Escape}');
  await api.answer(1, ['Oslo']);
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  expect(screen.getByRole('status')).not.toHaveTextContent('Loading');
});

test('clearing the box closes the list without a search', async () => {
  const user = userEvent.setup();
  const api = fakeSearch();
  render(<Autocomplete search={api.search} />);
  const box = screen.getByRole('combobox', { name: 'Search' });
  await user.type(box, 'r');
  await user.clear(box);
  await api.answer(0, ['Rome']);
  expect(api.calls.length).toBe(1);
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toBeEmptyDOMElement();
});
