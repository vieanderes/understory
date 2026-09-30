function solution(A: number[], B: number[]): number {
  // A stack of the balls rolling right that nothing has stopped yet. A ball rolling left
  // meets them nearest first, so it fights the top of the stack until one side runs out.
  // Every ball is pushed and popped at most once: O(N).
  const right: number[] = [];
  let escaped = 0;
  for (let i = 0; i < A.length; i++) {
    if (B[i] === 1) {
      right.push(A[i]!);
      continue;
    }
    let size = A[i]!;
    while (right.length > 0) {
      const top = right[right.length - 1]!;
      if (top >= size) {
        right[right.length - 1] = top + size;
        size = 0;
        break;
      }
      size += top;
      right.pop();
    }
    if (size > 0) escaped++;
  }
  return escaped + right.length;
}
