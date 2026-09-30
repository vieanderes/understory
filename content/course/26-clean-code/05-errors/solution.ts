export class InvalidAgeError extends Error {
  constructor(input: string) {
    super(`Not a valid age: "${input}"`);
    this.name = 'InvalidAgeError';
  }
}

export function parseAge(input: string): number {
  const age = Number(input);
  if (input.trim() === '' || !Number.isInteger(age) || age < 0 || age > 150) {
    throw new InvalidAgeError(input);
  }
  return age;
}
