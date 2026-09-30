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
  const result: (Book & { author: string })[] = [];
  for (const book of books) {
    const names = await loadAuthors([book.authorId]);
    result.push({ ...book, author: names.get(book.authorId) ?? 'Unknown' });
  }
  return result;
}
