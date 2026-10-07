export interface Book {
  id: string;
  title: string;
  updatedAt: string;
}

// The vendor returns books with updatedAt >= updatedSince, sorted by updatedAt then id.
export type FetchPage = (updatedSince: string, limit: number) => Promise<{ books: Book[]; hasMore: boolean }>;

export async function* paginate(fetchPage: FetchPage, since: string, limit = 100): AsyncGenerator<Book> {
  let updatedSince = since;
  while (true) {
    const page = await fetchPage(updatedSince, limit);
    for (const book of page.books) yield book;
    if (!page.hasMore) return;
    // The next page starts at the last timestamp, so it repeats books that share it.
    updatedSince = page.books[page.books.length - 1]!.updatedAt;
  }
}
