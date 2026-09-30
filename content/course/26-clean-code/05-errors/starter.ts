// Returns -1 when the input isn't an age, and every caller must remember to check.
// Fail fast instead: throw an InvalidAgeError that callers can recognise.
export function parseAge(input: string): number {
  const age = Number(input);
  if (Number.isNaN(age)) return -1;
  return age;
}
