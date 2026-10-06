export interface StoredRecord {
  id: string;
  kind: string;
  memberId: string;
  createdAt: string; // ISO date, 'YYYY-MM-DD'
  legalHold?: boolean;
}

export interface Rule {
  keepDays: number;
  requiredByLaw: boolean;
  afterwards: 'delete' | 'anonymise';
}

export type Action = 'keep' | 'delete' | 'anonymise';

const DAY_MS = 24 * 60 * 60 * 1000;

export function sweep(
  records: StoredRecord[],
  policy: Record<string, Rule>,
  erasureRequests: string[],
  today: string,
): { id: string; action: Action }[] {
  // Keeps everything for ever, which is what most systems do by accident.
  return records.map((record) => ({ id: record.id, action: 'keep' }));
}
