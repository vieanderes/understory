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
  const erased = new Set(erasureRequests);
  return records.map((record) => {
    const rule = policy[record.kind];
    // A store nobody wrote a rule for must fail loudly, not be kept or deleted by accident.
    if (!rule) throw new Error(`No retention rule for ${record.kind}`);
    if (record.legalHold) return { id: record.id, action: 'keep' };
    const ageDays = (Date.parse(today) - Date.parse(record.createdAt)) / DAY_MS;
    if (ageDays >= rule.keepDays) return { id: record.id, action: rule.afterwards };
    // Erasure can't override a duty to keep, so those records wait out their period.
    if (erased.has(record.memberId) && !rule.requiredByLaw) {
      return { id: record.id, action: rule.afterwards };
    }
    return { id: record.id, action: 'keep' };
  });
}
