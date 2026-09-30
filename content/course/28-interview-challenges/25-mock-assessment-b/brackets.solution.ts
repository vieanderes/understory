const OPENER: Record<string, string> = { ')': '(', ']': '[', '}': '{' };

export function firstBreak(S: string): number {
  const open: string[] = [];
  for (let i = 0; i < S.length; i++) {
    const char = S[i]!;
    const wanted = OPENER[char];
    if (wanted === undefined) {
      open.push(char);
    } else if (open.pop() !== wanted) {
      return i;
    }
  }
  return open.length === 0 ? -1 : S.length;
}
