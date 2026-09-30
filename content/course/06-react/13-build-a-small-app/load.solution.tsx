import { useEffect, useState } from 'react';

export type Book = { id: string; title: string; read: boolean };
type Status = 'loading' | 'error' | 'ready';

export function ReadingList({ load }: { load: () => Promise<Book[]> }) {
  const [books, setBooks] = useState<Book[]>([]);
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    let ignore = false;
    load().then(
      (loaded) => {
        if (ignore) return;
        setBooks(loaded);
        setStatus('ready');
      },
      () => {
        if (!ignore) setStatus('error');
      },
    );
    // If the list leaves the page first, a late answer is dropped.
    return () => {
      ignore = true;
    };
  }, [load]);

  function toggle(id: string) {
    setBooks(books.map((book) => (book.id === id ? { ...book, read: !book.read } : book)));
  }

  if (status === 'loading') return <p>Loading your books</p>;
  if (status === 'error') return <p role="alert">Couldn't load your books</p>;

  return (
    <ul>
      {books.map((book) => (
        <li key={book.id}>
          <label>
            <input type="checkbox" checked={book.read} onChange={() => toggle(book.id)} />
            {book.title}
          </label>
        </li>
      ))}
    </ul>
  );
}
