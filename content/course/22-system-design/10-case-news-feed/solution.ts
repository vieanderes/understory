export type Post = { id: string; author: string; at: number };

// stored: the follower's pushed feed. pulled: recent posts from each followed celebrity.
export function mergeFeed(stored: Post[], pulled: Post[][], limit: number): Post[] {
  const seen = new Set<string>();
  const all: Post[] = [];
  for (const post of [...stored, ...pulled.flat()]) {
    if (seen.has(post.id)) continue;
    seen.add(post.id);
    all.push(post);
  }
  all.sort((a, b) => b.at - a.at);
  return all.slice(0, Math.max(0, limit));
}
