import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReadingList, type Book } from './load.solution';

const books: Book[] = [
  { id: '1', title: 'Dune', read: true },
  { id: '2', title: 'Emma', read: false },
];

// A load() the test answers by hand, like a server that replies when it's ready.
function manualLoad() {
  let answer: (books: Book[]) => void = () => {};
  let fail: (error: Error) => void = () => {};
  let calls = 0;
  const load = () => {
    calls++;
    return new Promise<Book[]>((resolve, reject) => {
      answer = resolve;
      fail = reject;
    });
  };
  return { load, answer: (list: Book[]) => answer(list), fail: () => fail(new Error('503')), calls: () => calls };
}

test('shows a loading message, then the books', async () => {
  const server = manualLoad();
  render(<ReadingList load={server.load} />);
  expect(screen.getByText('Loading your books')).toBeInTheDocument();
  expect(server.calls()).toBe(1);
  server.answer(books);
  expect(await screen.findByLabelText('Emma')).not.toBeChecked();
  expect(screen.getByLabelText('Dune')).toBeChecked();
  expect(screen.queryByText('Loading your books')).not.toBeInTheDocument();
});

test('says so when the books cannot be loaded', async () => {
  const server = manualLoad();
  render(<ReadingList load={server.load} />);
  server.fail();
  expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load your books");
  expect(screen.queryByText('Loading your books')).not.toBeInTheDocument();
});

test('the loaded books can still be ticked', async () => {
  const user = userEvent.setup();
  const server = manualLoad();
  render(<ReadingList load={server.load} />);
  server.answer(books);
  await user.click(await screen.findByLabelText('Emma'));
  expect(screen.getByLabelText('Emma')).toBeChecked();
});
