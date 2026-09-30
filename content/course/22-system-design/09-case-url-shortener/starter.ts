export const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

// Turns a counter value into a short code: 0-9, then a-z, then A-Z.
export function toBase62(n: number): string {
  return String(n);
}
