import { useState } from 'react';

export type Book = { id: string; title: string; read: boolean };
type Filter = 'all' | 'unread' | 'read';

const labels: Record<Filter, string> = { all: 'All', unread: 'To read', read: 'Read' };

function matches(book: Book, filter: Filter): boolean {
  if (filter === 'unread') return !book.read;
  if (filter === 'read') return book.read;
  return true;
}

export function ReadingList({ initialBooks }: { initialBooks: Book[] }) {
  const [books, setBooks] = useState(initialBooks);
  const [filter, setFilter] = useState<Filter>('all');
  // Both come from `books` and `filter`, so they're worked out on every render and can
  // never disagree with them.
  const visible = books.filter((book) => matches(book, filter));
  const left = books.filter((book) => !book.read).length;

  function toggle(id: string) {
    setBooks(books.map((book) => (book.id === id ? { ...book, read: !book.read } : book)));
  }

  return (
    <section>
      <p>{left} left to read</p>
      {(['all', 'unread', 'read'] as const).map((option) => (
        <button key={option} aria-pressed={filter === option} onClick={() => setFilter(option)}>
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
