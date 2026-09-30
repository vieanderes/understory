function solution(S: string): number {
  // Each closing bracket must match the most recent one still open: a stack, O(N).
  const opener: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
  const open: string[] = [];
  for (let i = 0; i < S.length; i++) {
    const char = S[i]!;
    const wanted = opener[char];
    if (wanted === undefined) open.push(char);
    else if (open.pop() !== wanted) return i;
  }
  return open.length === 0 ? -1 : S.length;
}
