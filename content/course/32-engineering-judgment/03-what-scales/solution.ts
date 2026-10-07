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
    const sql = call.sql.trim().toUpperCase();
    // A first pass, like a review bot: it flags lines for a person to read.
    const oneRow = sql.includes('WHERE ID =') || sql.includes('COUNT(');
    if (sql.startsWith('SELECT') && !sql.includes('LIMIT') && !oneRow) {
      findings.push({ line: call.line, problem: 'unbounded' });
    }
  }
  return findings;
}
