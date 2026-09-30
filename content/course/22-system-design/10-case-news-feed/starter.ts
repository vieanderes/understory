export type Post = { id: string; author: string; at: number };

// stored: the follower's pushed feed. pulled: recent posts from each followed celebrity.
export function mergeFeed(stored: Post[], pulled: Post[][], limit: number): Post[] {
  return stored.slice(0, limit);
}
