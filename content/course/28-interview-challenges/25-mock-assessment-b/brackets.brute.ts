// Deletes matched pairs until none are left. Correct, but each prefix is rebuilt and
// rescanned from the start, which is at least O(N^2).
function reduce(text: string): string {
  let previous = '';
  let current = text;
  while (current !== previous) {
    previous = current;
    current = current.replace('()', '').replace('[]', '').replace('{}', '');
  }
  return current;
}

export function firstBreak(S: string): number {
  for (let k = 1; k <= S.length; k++) {
    const rest = reduce(S.slice(0, k));
    if (/[)\]}]/.test(rest)) return k - 1;
  }
  return reduce(S) === '' ? -1 : S.length;
}
