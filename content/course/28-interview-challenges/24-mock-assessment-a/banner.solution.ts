export function largestBanner(H: number[]): number {
  // The stack holds indices of rising heights. When a lower building arrives, every
  // taller one on the stack has found its right edge, and the index below it on the
  // stack is its left edge. The extra 0 at the end flushes whatever is left.
  const stack: number[] = [];
  let best = 0;
  for (let i = 0; i <= H.length; i++) {
    const height = i === H.length ? 0 : H[i]!;
    while (stack.length > 0 && H[stack[stack.length - 1]!]! >= height) {
      const top = stack.pop()!;
      const left = stack.length === 0 ? -1 : stack[stack.length - 1]!;
      best = Math.max(best, H[top]! * (i - left - 1));
    }
    stack.push(i);
  }
  return best;
}
