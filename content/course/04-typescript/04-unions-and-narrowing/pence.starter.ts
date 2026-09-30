export function toPence(input: string | number | null): number {
  if (typeof input === 'string') {
    return Math.round(Number(input) * 100);
  }
  return input;
}
