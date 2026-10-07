export interface QueryCall {
  line: number;
  sql: string;
  inLoop: boolean; // true when it runs once per item of a list
}

export interface Finding {
  line: number;
  problem: 'n-plus-one' | 'unbounded';
}

export function scaleRisks(calls: QueryCall[]): Finding[] {
  const findings: Finding[] = [];
  for (const call of calls) {
    if (call.inLoop) findings.push({ line: call.line, problem: 'n-plus-one' });
  }
  return findings;
}
