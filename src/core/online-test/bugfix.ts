/*
 * Bug-fix tasks allow a few changed lines ("You can modify at most two lines"). A line
 * counts as changed when it is new, gone or edited; an edit is one removal plus one
 * addition, so the count is the larger of the two sides of a line diff. Blank lines and
 * trailing spaces do not count: they change nothing a reviewer would call a fix.
 */

function meaningful(code: string): string[] {
  return code
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+$/, ''))
    .filter((line) => line.trim().length > 0);
}

/** Length of the longest common subsequence of two line lists. */
function lcs(a: readonly string[], b: readonly string[]): number {
  let prev = new Array<number>(b.length + 1).fill(0);
  for (const line of a) {
    const row = new Array<number>(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j++) {
      row[j] = line === b[j - 1] ? (prev[j - 1] ?? 0) + 1 : Math.max(prev[j] ?? 0, row[j - 1] ?? 0);
    }
    prev = row;
  }
  return prev[b.length] ?? 0;
}

export function changedLines(starter: string, code: string): number {
  const before = meaningful(starter);
  const after = meaningful(code);
  const kept = lcs(before, after);
  return Math.max(before.length - kept, after.length - kept);
}
