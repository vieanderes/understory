export type EvalCase = {
  id: string;
  question: string;
  relevant: string[]; // chunk ids that answer it; empty means the system should refuse
  mustInclude: string[]; // facts the answer has to contain
};
export type SystemOutput = { retrieved: string[]; answer: string; citations: string[] };
export type System = (question: string) => Promise<SystemOutput>;
export type Failure = { id: string; reason: string };
export type Report = { recallAtK: number; mrr: number; refusalAccuracy: number; failures: Failure[] };

export const REFUSAL = "I don't have that information.";

export async function runEvals(cases: EvalCase[], system: System, k: number): Promise<Report> {
  // Run the system on every case. Score retrieval over the answerable cases,
  // refusals over all cases, and list the first failing answer check per case.
  return { recallAtK: 0, mrr: 0, refusalAccuracy: 0, failures: [] };
}
