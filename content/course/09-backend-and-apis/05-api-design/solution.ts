export interface Post {
  id: number;
  title: string;
}

export interface Page {
  items: Post[];
  nextCursor: string | null;
}

export function paginate(posts: Post[], after: string | null, limit: number): Page {
  let start = 0;
  if (after !== null) {
    const position = posts.findIndex((post) => String(post.id) === after);
    if (position === -1) return { items: [], nextCursor: null };
    start = position + 1;
  }
  const items = posts.slice(start, start + limit);
  const more = start + limit < posts.length;
  const last = items[items.length - 1];
  return { items, nextCursor: more && last ? String(last.id) : null };
}
