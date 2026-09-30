export interface TokenRecord {
  email: string;
  expiresAt: number;
  usedAt: number | null;
}

export function checkResetToken(record: TokenRecord | null, now: number): string {
  if (record === null) return 'unknown';
  if (record.usedAt !== null) return 'used';
  if (now >= record.expiresAt) return 'expired';
  return 'ok';
}
