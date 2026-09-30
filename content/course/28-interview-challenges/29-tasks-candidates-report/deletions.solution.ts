// Walk once. Each A after some B either goes (one more deletion) or stays, and then every
// B so far must go. Keep the cheaper of the two, so the answer so far is always optimal.
export function minDeletions(letters: string): number {
  let bsSoFar = 0;
  let deletions = 0;
  for (const letter of letters) {
    if (letter === 'B') bsSoFar++;
    else deletions = Math.min(deletions + 1, bsSoFar);
  }
  return deletions;
}
