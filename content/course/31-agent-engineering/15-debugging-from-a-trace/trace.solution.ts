export type Hit = { doc: string; score: number };

export type Step =
  | { n: number; kind: 'model'; said: string }
  | { n: number; kind: 'search'; query: string; hits: Hit[] }
  | { n: number; kind: 'tool'; tool: string; args: Record<string, unknown> };

export type Expectations = {
  // tool name -> argument name -> the pattern every value must match
  contracts: Record<string, Record<string, RegExp>>;
  // the document that had to reach the model, and how many hits it sees
  mustRetrieve?: { doc: string; k: number };
};

export type Finding = { step: number; cause: 'retrieval' | 'contract'; detail: string };

export function firstBadStep(trace: Step[], expect: Expectations): Finding | null {
  for (const step of trace) {
    if (step.kind === 'search' && expect.mustRetrieve) {
      const { doc, k } = expect.mustRetrieve;
      // copy before sorting: the recorded trace is evidence, never edit it
      const topK = [...step.hits].sort((a, b) => b.score - a.score).slice(0, k);
      if (!topK.some((hit) => hit.doc === doc)) {
        return { step: step.n, cause: 'retrieval', detail: doc };
      }
    }
    if (step.kind === 'tool') {
      const contract = expect.contracts[step.tool] ?? {};
      for (const [arg, pattern] of Object.entries(contract)) {
        const value = step.args[arg];
        if (value === undefined || !pattern.test(String(value))) {
          return { step: step.n, cause: 'contract', detail: arg };
        }
      }
    }
  }
  return null;
}
