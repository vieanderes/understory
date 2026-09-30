export function buildStages(jobs: string[], deps: [string, string][]): string[][] | null {
  // Target O(jobs + deps). Count unmet dependencies; jobs at zero form the first stage. Finishing a
  // stage lowers the counts of the jobs it unlocks; those reaching zero form the next.
  const stages: string[][] = [];
  return stages;
}
