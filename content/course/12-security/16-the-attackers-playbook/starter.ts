export interface User {
  id: number;
  name: string;
  bio: string;
  role: 'member' | 'admin';
}

export function applyProfileUpdate(user: User, body: Record<string, unknown>): User {
  // Replace this. It copies every field the request sends, role included.
  return { ...user, ...body } as User;
}
