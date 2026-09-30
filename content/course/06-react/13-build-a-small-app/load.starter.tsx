import { useState } from 'react';

export type Book = { id: string; title: string; read: boolean };

// The books now come from `load()`, which asks the server. Nothing calls it yet.
export function ReadingList({ load }: { load: () => Promise<Book[]> }) {
  const [books, setBooks] = useState<Book[]>([]);

  function toggle(id: string) {
    setBooks(books.map((book) => (book.id === id ? { ...book, read: !book.read } : book)));
  }

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
