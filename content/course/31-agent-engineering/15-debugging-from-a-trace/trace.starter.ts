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
  // Walk the steps in order. Check searches against mustRetrieve,
  // and tool calls against their contract. Report the first failure.
  for (const step of trace) {
    if (step.kind === 'model') continue;
  }
  return null;
}
