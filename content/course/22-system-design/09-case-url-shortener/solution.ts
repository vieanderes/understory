export const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

// Turns a counter value into a short code: 0-9, then a-z, then A-Z.
export function toBase62(n: number): string {
  if (!Number.isInteger(n) || n < 0) throw new Error('n must be a whole number from 0');
  if (n === 0) return '0';
  let code = '';
  while (n > 0) {
    code = ALPHABET[n % 62] + code;
    n = Math.floor(n / 62);
  }
  return code;
}
