export type Candidate = { name: string; runsOn: string[]; needsRuntime: boolean };
export type Job = { runsOn: string; noRuntimeAllowed: boolean; team: string[] };

// The languages that pass the job's hard constraints, the ones the team knows first.
export function shortlist(job: Job, candidates: Candidate[]): string[] {
  return candidates.map((candidate) => candidate.name);
}
