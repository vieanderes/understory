export interface Book {
  id: number;
  title?: string;
  author: string;
  borrowerEmail?: string;
}

export interface PublicBook {
  id: number;
  title: string;
  author: string;
}

// The assistant's version. Its one test searched for 'salt' and passed.
export function searchBooks(books: Book[], query: string): PublicBook[] {
  const wanted = query.trim().toLowerCase();
  if (wanted === '') return [];
  const results: PublicBook[] = [];
  for (const book of books) {
    if (book.title === undefined) continue;
    if (!book.title.toLowerCase().includes(wanted)) continue;
    // Name each field: a type never strips extra fields at run time.
    results.push({ id: book.id, title: book.title, author: book.author });
    // Stop at 20, so a short query never walks the whole catalogue.
    if (results.length === 20) break;
  }
  return results;
}
