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
  const granted = permissions[user.role];
  if (granted.includes(`order:${action}`)) return true;
  if (granted.includes(`order:${action}:own`)) return order.ownerId === user.id;
  return false;
}
