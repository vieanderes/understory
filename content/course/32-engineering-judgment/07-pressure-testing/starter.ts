export type Level = 'low' | 'medium' | 'high';
export type Band = 'act' | 'plan' | 'accept';

export interface Row {
  failure: string;
  likelihood: Level;
  impact: Level;
  detection: string;
}

// Read it as MATRIX[likelihood][impact].
export const MATRIX: Record<Level, Record<Level, Band>> = {
  low: { low: 'accept', medium: 'accept', high: 'plan' },
  medium: { low: 'accept', medium: 'plan', high: 'act' },
  high: { low: 'plan', medium: 'act', high: 'act' },
};

export function triage(rows: Row[]): Record<Band, string[]> {
  const result: Record<Band, string[]> = { act: [], plan: [], accept: [] };
  // Every row lands in 'plan' for now.
  for (const row of rows) result.plan.push(row.failure);
  return result;
}
