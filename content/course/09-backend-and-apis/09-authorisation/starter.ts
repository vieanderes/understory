export type Role = 'customer' | 'staff' | 'admin';

export interface User {
  id: number;
  role: Role;
}

export interface Order {
  id: number;
  ownerId: number;
}

export const permissions: Record<Role, string[]> = {
  customer: ['order:read:own', 'order:cancel:own'],
  staff: ['order:read', 'order:refund'],
  admin: ['order:read', 'order:refund', 'order:delete'],
};

export function can(user: User, action: string, order: Order): boolean {
  // Replace this. It lets anyone signed in do anything to any order.
  return true;
}
