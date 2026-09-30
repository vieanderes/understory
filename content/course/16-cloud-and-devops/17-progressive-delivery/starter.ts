// Given: turns text into a whole number, the same number for the same text every time.
export function hash(text: string): number {
  let result = 0;
  for (let i = 0; i < text.length; i++) {
    // charCodeAt gives the number behind each character.
    result = (result * 31 + text.charCodeAt(i)) % 1_000_003;
  }
  return result;
}

// True when this user is inside the first `percent` of 100 buckets for this flag.
export function bucketFor(userId: string, flag: string, percent: number): boolean {
  return Math.random() * 100 < percent;
}
