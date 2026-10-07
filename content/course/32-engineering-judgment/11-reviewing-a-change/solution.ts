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
  // sort is stable, so equal findings keep the order the reviewer wrote them in.
  const sorted = [...findings].sort(
    (a, b) =>
      LABEL_ORDER.indexOf(a.label) - LABEL_ORDER.indexOf(b.label) ||
      LENS_ORDER.indexOf(a.lens) - LENS_ORDER.indexOf(b.lens),
  );
  const has = (label: Label) => findings.some((finding) => finding.label === label);
  const decision = has('must-fix') ? 'request changes' : has('question') || has('suggestion') ? 'comment' : 'approve';
  return { decision, lines: sorted.map((f) => `${f.label} (${f.lens}): ${f.note}`) };
}
