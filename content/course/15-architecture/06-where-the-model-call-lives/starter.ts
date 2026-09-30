export type Label = 'refund' | 'bug' | 'other';
export type Route = 'billing' | 'engineering' | 'inbox';

// The port: what the rules need from a model.
export interface Classifier {
  classify(ticket: string): Promise<Label>;
}

// Sends a JSON body to a provider's API and resolves with the parsed reply.
export type Send = (body: unknown) => Promise<unknown>;

// Today the rule builds the prompt and reads provider A's reply itself.
export async function routeTicket(ticket: string, send: Send): Promise<Route> {
  const reply = (await send({ prompt: `Label as refund, bug or other: ${ticket}` })) as {
    output: { text: string }[];
  };
  const label = reply.output[0]?.text;
  if (label === 'refund') return 'billing';
  if (label === 'bug') return 'engineering';
  return 'inbox';
}

// Provider A takes { prompt } and replies { output: [{ text: 'refund' }] }.
export function providerA(send: Send): Classifier {
  throw new Error(`write the adapter for ${typeof send}`);
}

// Provider B takes { messages: [{ role: 'user', content }] }
// and replies { choices: [{ message: { content: 'bug' } }] }.
export function providerB(send: Send): Classifier {
  throw new Error(`write the adapter for ${typeof send}`);
}
