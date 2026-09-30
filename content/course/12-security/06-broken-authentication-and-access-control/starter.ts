export interface TokenRecord {
  email: string;
  expiresAt: number;
  usedAt: number | null;
}

export function checkResetToken(record: TokenRecord | null, now: number): string {
  // Replace this. It waves every token through, expired or already spent.
  return 'ok';
}
