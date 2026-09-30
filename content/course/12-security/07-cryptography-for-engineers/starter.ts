export type SlowHash = (password: string, salt: string) => string;

export function hashPassword(password: string, makeSalt: () => string, slowHash: SlowHash): string {
  // Replace this. It never salts, so equal passwords get equal hashes.
  return slowHash(password, '');
}

export function checkPassword(stored: string, attempt: string, slowHash: SlowHash): boolean {
  // Replace this. It ignores the stored salt.
  return stored === slowHash(attempt, '');
}
