function solution(S: string): number {
  // Deletes matched pairs from every prefix until none are left. Correct, but each
  // prefix is rebuilt and rescanned from the start: at least O(N^2).
  const reduce = (text: string): string => {
    let previous = '';
    let current = text;
    while (current !== previous) {
      previous = current;
      current = current.replace('()', '').replace('[]', '').replace('{}', '');
    }
    return current;
  };
  for (let k = 1; k <= S.length; k++) {
    if (/[)\]}]/.test(reduce(S.slice(0, k)))) return k - 1;
  }
  return reduce(S) === '' ? -1 : S.length;
}
