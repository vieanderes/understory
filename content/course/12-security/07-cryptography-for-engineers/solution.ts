export type SlowHash = (password: string, salt: string) => string;

export function hashPassword(password: string, makeSalt: () => string, slowHash: SlowHash): string {
  const salt = makeSalt();
  return `${salt}:${slowHash(password, salt)}`;
}

export function checkPassword(stored: string, attempt: string, slowHash: SlowHash): boolean {
  const [salt, hash] = stored.split(':');
  if (salt === undefined || hash === undefined) return false;
  return slowHash(attempt, salt) === hash;
}
