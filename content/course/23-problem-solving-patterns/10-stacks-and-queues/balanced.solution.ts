const PAIRS: Record<string, string> = { ')': '(', ']': '[', '}': '{' };

export function isBalanced(text: string): boolean {
  const stack: string[] = [];
  for (const char of text) {
    if (char === '(' || char === '[' || char === '{') {
      stack.push(char);
    } else if (char in PAIRS) {
      // pop() on an empty stack gives undefined, which never matches an opener.
      if (stack.pop() !== PAIRS[char]) return false;
    }
  }
  return stack.length === 0;
}
