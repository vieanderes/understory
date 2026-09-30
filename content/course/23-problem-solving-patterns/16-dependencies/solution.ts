// Kahn's algorithm, one stage at a time. A job joins the stage after the one that meets
// its last dependency. Jobs never reached sit on a cycle or behind one, so the whole
// plan is impossible. Stages are plain arrays, so no O(n) shift() is ever needed.
export function buildStages(jobs: string[], deps: [string, string][]): string[][] | null {
  const waiting = new Map<string, number>();
  const unlocks = new Map<string, string[]>();
  for (const job of jobs) {
    waiting.set(job, 0);
    unlocks.set(job, []);
  }
  for (const [before, after] of deps) {
    unlocks.get(before)!.push(after);
    waiting.set(after, waiting.get(after)! + 1);
  }

  const stages: string[][] = [];
  let current = jobs.filter((job) => waiting.get(job) === 0);
  let placed = 0;
  while (current.length > 0) {
    current.sort();
    stages.push(current);
    placed += current.length;
    const next: string[] = [];
    for (const job of current) {
      for (const after of unlocks.get(job)!) {
        const left = waiting.get(after)! - 1;
        waiting.set(after, left);
        if (left === 0) next.push(after);
      }
    }
    current = next;
  }
  return placed === jobs.length ? stages : null;
}
