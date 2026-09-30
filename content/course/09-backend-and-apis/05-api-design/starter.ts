export interface Post {
  id: number;
  title: string;
}

export interface Page {
  items: Post[];
  nextCursor: string | null;
}

export function paginate(posts: Post[], after: string | null, limit: number): Page {
  // Replace this. It counts by position, so a new post shifts every later page.
  const offset = after === null ? 0 : Number(after);
  const items = posts.slice(offset, offset + limit);
  return { items, nextCursor: String(offset + limit) };
}
