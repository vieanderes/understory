export interface Book {
  id: string;
  title: string;
  updatedAt: string;
}

// The vendor returns books with updatedAt >= updatedSince, sorted by updatedAt then id.
export type FetchPage = (updatedSince: string, limit: number) => Promise<{ books: Book[]; hasMore: boolean }>;

export async function* paginate(fetchPage: FetchPage, since: string, limit = 100): AsyncGenerator<Book> {
  let last: { updatedAt: string; id: string } | null = null;
  let updatedSince = since;
  while (true) {
    const page = await fetchPage(updatedSince, limit);
    let fresh = 0;
    for (const book of page.books) {
      // The filter is inclusive, so the page starts with books we've already yielded.
      const seen =
        last !== null &&
        (book.updatedAt < last.updatedAt || (book.updatedAt === last.updatedAt && book.id <= last.id));
      if (seen) continue;
      last = { updatedAt: book.updatedAt, id: book.id };
      fresh += 1;
      yield book;
    }
    if (!page.hasMore || last === null) return;
    // Only seen books, yet more to come: a whole page shares one timestamp.
    if (fresh === 0) throw new Error(`${limit} or more books share updatedAt ${updatedSince}`);
    updatedSince = last.updatedAt;
  }
}
