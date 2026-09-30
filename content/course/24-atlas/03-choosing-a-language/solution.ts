export type Candidate = { name: string; runsOn: string[]; needsRuntime: boolean };
export type Job = { runsOn: string; noRuntimeAllowed: boolean; team: string[] };

// The languages that pass the job's hard constraints, the ones the team knows first.
export function shortlist(job: Job, candidates: Candidate[]): string[] {
  const fits = candidates.filter(
    (c) => c.runsOn.includes(job.runsOn) && !(job.noRuntimeAllowed && c.needsRuntime),
  );
  const known = fits.filter((c) => job.team.includes(c.name));
  const unknown = fits.filter((c) => !job.team.includes(c.name));
  return [...known, ...unknown].map((c) => c.name);
}
