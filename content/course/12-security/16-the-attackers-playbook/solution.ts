export interface User {
  id: number;
  name: string;
  bio: string;
  role: 'member' | 'admin';
}

export function applyProfileUpdate(user: User, body: Record<string, unknown>): User {
  const updated = { ...user };
  if (typeof body.name === 'string') updated.name = body.name;
  if (typeof body.bio === 'string') updated.bio = body.bio;
  return updated;
}
