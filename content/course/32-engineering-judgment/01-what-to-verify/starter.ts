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
  return books
    .filter((book) => book.title!.toLowerCase().includes(query.toLowerCase()))
    .map((book) => ({ ...book, title: book.title! }));
}
