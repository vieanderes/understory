import { useState } from 'react';

export type Book = { id: string; title: string; read: boolean };
type Filter = 'all' | 'unread' | 'read';

const labels: Record<Filter, string> = { all: 'All', unread: 'To read', read: 'Read' };

function matches(book: Book, filter: Filter): boolean {
  if (filter === 'unread') return !book.read;
  if (filter === 'read') return book.read;
  return true;
}

// Ticking a book doesn't move it between filters, and the count never changes.
// Keep only the state you need, and calculate the rest.
export function ReadingList({ initialBooks }: { initialBooks: Book[] }) {
  const [books, setBooks] = useState(initialBooks);
  const [filter, setFilter] = useState<Filter>('all');
  const [visible, setVisible] = useState(initialBooks);
  const [left] = useState(initialBooks.filter((book) => !book.read).length);

  function choose(next: Filter) {
    setFilter(next);
    setVisible(books.filter((book) => matches(book, next)));
  }

  function toggle(id: string) {
    setBooks(books.map((book) => (book.id === id ? { ...book, read: !book.read } : book)));
  }

  return (
    <section>
      <p>{left} left to read</p>
      {(['all', 'unread', 'read'] as const).map((option) => (
        <button key={option} aria-pressed={filter === option} onClick={() => choose(option)}>
          {labels[option]}
        </button>
      ))}
      <ul>
        {visible.map((book) => (
          <li key={book.id}>
            <label>
              <input type="checkbox" checked={book.read} onChange={() => toggle(book.id)} />
              {book.title}
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
