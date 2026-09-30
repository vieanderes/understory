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

// The first answer check that fails, or null. Retrieval is scored apart, in the metrics.
function answerFailure(c: EvalCase, out: SystemOutput): string | null {
  const refused = out.answer.trim() === REFUSAL;
  const shouldRefuse = c.relevant.length === 0;
  if (shouldRefuse && !refused) return 'should refuse';
  if (!shouldRefuse && refused) return 'should answer';
  if (shouldRefuse) return null;
  const answer = out.answer.toLowerCase();
  const missing = c.mustInclude.find((fact) => !answer.includes(fact.toLowerCase()));
  if (missing !== undefined) return `missing: ${missing}`;
  if (out.citations.length === 0) return 'no citation';
  return null;
}

export async function runEvals(cases: EvalCase[], system: System, k: number): Promise<Report> {
  const outputs = await Promise.all(cases.map((c) => system(c.question)));
  let recallSum = 0;
  let rrSum = 0;
  let answerable = 0;
  let refusalsRight = 0;
  const failures: Failure[] = [];
  cases.forEach((c, i) => {
    const out = outputs[i] ?? { retrieved: [], answer: '', citations: [] };
    const refused = out.answer.trim() === REFUSAL;
    if (refused === (c.relevant.length === 0)) refusalsRight++;
    if (c.relevant.length > 0) {
      answerable++;
      const top = out.retrieved.slice(0, k);
      const relevant = new Set(c.relevant);
      recallSum += top.filter((id) => relevant.has(id)).length / relevant.size;
      const rank = top.findIndex((id) => relevant.has(id));
      rrSum += rank === -1 ? 0 : 1 / (rank + 1);
    }
    const reason = answerFailure(c, out);
    if (reason !== null) failures.push({ id: c.id, reason });
  });
  return {
    recallAtK: answerable === 0 ? 0 : recallSum / answerable,
    mrr: answerable === 0 ? 0 : rrSum / answerable,
    refusalAccuracy: cases.length === 0 ? 0 : refusalsRight / cases.length,
    failures,
  };
}
