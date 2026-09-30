export interface Book {
  id: number;
  title: string;
  authorId: number;
}

// loadAuthors(ids) sends one query and resolves to a Map from author id to name.
export async function attachAuthors(
  books: Book[],
  loadAuthors: (ids: number[]) => Promise<Map<number, string>>,
): Promise<(Book & { author: string })[]> {
  const ids = [...new Set(books.map((book) => book.authorId))];
  const names = await loadAuthors(ids);
  return books.map((book) => ({ ...book, author: names.get(book.authorId) ?? 'Unknown' }));
}
