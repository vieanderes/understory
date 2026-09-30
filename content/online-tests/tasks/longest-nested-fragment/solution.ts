function solution(S: string): number {
  // The stack holds the index just before the current fragment, then every open bracket
  // still waiting for its partner. After a match, the top is where the fragment began.
  const stack: number[] = [-1];
  let best = 0;
  for (let i = 0; i < S.length; i++) {
    if (S[i] === '(') {
      stack.push(i);
    } else {
      stack.pop();
      if (stack.length === 0) stack.push(i);
      else best = Math.max(best, i - stack[stack.length - 1]);
    }
  }
  return best;
}
