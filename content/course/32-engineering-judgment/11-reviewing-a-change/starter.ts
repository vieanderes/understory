export type Label = 'must-fix' | 'question' | 'suggestion' | 'nit';
export type Lens = 'leaks' | 'breaks' | 'tests' | 'scales' | 'confuses';

export interface Finding {
  label: Label;
  lens: Lens;
  note: string;
}

export interface Verdict {
  decision: 'request changes' | 'comment' | 'approve';
  lines: string[];
}

// Most serious first.
export const LABEL_ORDER: Label[] = ['must-fix', 'question', 'suggestion', 'nit'];
export const LENS_ORDER: Lens[] = ['leaks', 'breaks', 'tests', 'scales', 'confuses'];

export function writeVerdict(findings: Finding[]): Verdict {
  // Approves everything and says nothing.
  return { decision: 'approve', lines: [] };
}
